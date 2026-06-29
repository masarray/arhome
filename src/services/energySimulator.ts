// Singleton energy simulator. Ticks every second, accumulates kWh.
// Persisted to localStorage so refresh keeps the demo "alive".
import { loadJSON, saveJSON } from "./persistence";

export type DeviceLoad = {
  id: string;
  label: string;
  room: string;
  watts: number; // current measured draw after the realtime model is applied
  on: boolean;
  category: string;
};

export type HourBucket = { ts: number; kwh: number; perDevice: Record<string, number> };
export type LiveSample = { ts: number; watts: number; perDevice: Record<string, number> };

type State = {
  lastTick: number;
  hours: HourBucket[]; // rolling 24 * 32 days
  monthlyKwh: Record<string, number>; // "2026-06" -> kWh
  monthlyPerDevice: Record<string, Record<string, number>>;
  liveSamples: LiveSample[]; // rolling realtime power trace in watts
};

type DeviceFactory = (at?: Date) => DeviceLoad[];

// v3 intentionally resets stale demo history created by the older second-only accumulator.
const KEY = "mas.energy.v3";
const MAX_HOURS = 24 * 32;
const MAX_LIVE_SAMPLES = 180;
const PERSIST_INTERVAL_MS = 5000;
const CATCH_UP_STEP_MS = 5 * 60_000;
const LONG_GAP_MS = 10_000;

function emptyState(): State {
  return {
    lastTick: Date.now(),
    hours: [],
    monthlyKwh: {},
    monthlyPerDevice: {},
    liveSamples: [],
  };
}

function normalizeState(raw: Partial<State> | null | undefined): State {
  const base = emptyState();
  return {
    ...base,
    ...raw,
    hours: Array.isArray(raw?.hours) ? raw.hours : base.hours,
    monthlyKwh: raw?.monthlyKwh ?? base.monthlyKwh,
    monthlyPerDevice: raw?.monthlyPerDevice ?? base.monthlyPerDevice,
    liveSamples: Array.isArray(raw?.liveSamples) ? raw.liveSamples.slice(-MAX_LIVE_SAMPLES) : base.liveSamples,
    lastTick: typeof raw?.lastTick === "number" ? raw.lastTick : base.lastTick,
  };
}

function monthKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hourBucketStart(ts: number) {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashId(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) / 10_000;
}

function smoothUnit(ts: number, seed: number, scaleSeconds: number) {
  return 0.5 + 0.5 * Math.sin(ts / (scaleSeconds * 1000) + seed);
}

function seededHourJitter(ts: number, seed: number) {
  return 0.86 + 0.18 * smoothUnit(ts, seed, 3600) + 0.08 * smoothUnit(ts, seed * 1.7, 11_800);
}

function dutyGate(ts: number, seed: number, cycleSeconds: number, duty: number) {
  const cycle = cycleSeconds * 1000;
  const shifted = ts + Math.round(seed * 9973);
  const phase = ((shifted % cycle) + cycle) % cycle;
  return phase / cycle < duty;
}

function wrappedHourDistance(hour: number, target: number) {
  const raw = Math.abs(hour - target);
  return Math.min(raw, 24 - raw);
}

function bell(hour: number, target: number, width: number) {
  const distance = wrappedHourDistance(hour, target);
  return Math.exp(-(distance * distance) / (2 * width * width));
}

function dailyProfiles(ts: number) {
  const d = new Date(ts);
  const hourFloat = d.getHours() + d.getMinutes() / 60;
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const morning = bell(hourFloat, 6.7, 0.8);
  const breakfast = bell(hourFloat, 6.9, 0.55);
  const lunch = bell(hourFloat, 12.2, isWeekend ? 0.9 : 0.48);
  const dinner = bell(hourFloat, 19.0, 0.78);
  const evening = bell(hourFloat, 20.2, 2.45);
  const night = Math.max(bell(hourFloat, 0.4, 3.15), bell(hourFloat, 23.0, 2.15));
  const afternoonWeekend = isWeekend ? bell(hourFloat, 14.7, 2.25) : 0;
  const away = isWeekend ? 0.22 : bell(hourFloat, 12.4, 3.2);
  const daylight = bell(hourFloat, 13, 4.8);
  const occupied = isWeekend ? 0.88 : clamp(1 - away * 0.62 + morning * 0.18 + evening * 0.32, 0.34, 1.0);
  return { d, hourFloat, isWeekend, morning, breakfast, lunch, dinner, evening, night, afternoonWeekend, away, daylight, occupied };
}

function historyUsageFactor(ts: number, id: string, baseWeight: number) {
  const { d, hourFloat, isWeekend, morning, breakfast, lunch, dinner, evening, night, afternoonWeekend, daylight, occupied } = dailyProfiles(ts);
  let factor = baseWeight;

  if (id === "ac-bedroom") {
    factor *= 0.03 + night * 0.62 + evening * 0.18 + (isWeekend ? afternoonWeekend * 0.08 : 0);
  } else if (id === "ac-living") {
    factor *= 0.02 + evening * 0.42 + afternoonWeekend * 0.48 + (isWeekend ? lunch * 0.16 : 0.05 * occupied);
  } else if (id === "fridge") {
    factor *= 0.42 + 0.08 * Math.max(0, Math.sin(hourFloat / 3.4)) + (isWeekend ? 0.04 : 0);
  } else if (id === "lighting") {
    factor *= Math.max(0.04, (0.22 + morning * 0.26 + evening * 0.78 + night * 0.34 - daylight * 0.18) * occupied);
  } else if (id === "tv-living") {
    factor *= 0.03 + evening * 0.78 + afternoonWeekend * 0.48;
  } else if (id === "kitchen") {
    factor *= 0.02 + breakfast * 0.48 + lunch * (isWeekend ? 0.58 : 0.28) + dinner * 0.92;
  } else if (id === "wm-dryer") {
    const laundryDay = isWeekend || d.getDay() === 3;
    factor *= laundryDay ? bell(hourFloat, isWeekend ? 10.4 : 8.6, 0.82) : 0;
  } else if (id === "humidifier") {
    factor *= 0.05 + evening * 0.28 + night * 0.38;
  } else if (id === "vacuum") {
    factor *= bell(hourFloat, isWeekend ? 11.0 : 9.4, 0.55) * (isWeekend ? 0.8 : 0.42);
  } else if (id === "outlets") {
    factor *= 0.12 + evening * 0.35 + afternoonWeekend * 0.22;
  } else if (id === "camera" || id === "doorbell" || id === "door-lock" || id === "energy-meter" || id === "router-iot") {
    factor *= 1;
  }

  return Math.max(0, factor);
}

function standbyWatts(device: DeviceLoad, ts: number) {
  const seed = hashId(device.id);
  const base =
    device.category === "security" ? 0.55 :
      device.category === "iot" ? 0.75 :
        device.category === "climate" ? 2.2 : 1.0;
  return base + smoothUnit(ts, seed, 17) * 0.65;
}

function measuredDeviceWatts(device: DeviceLoad, ts: number) {
  const base = Math.max(0, device.watts);
  const seed = hashId(device.id);
  const waveSlow = smoothUnit(ts, seed, 54);
  const waveFast = smoothUnit(ts, seed * 2.1, 7.5);

  if (!device.on || base <= 0.05) return standbyWatts(device, ts);

  if (device.id.includes("fridge") || device.label.toLowerCase().includes("kulkas")) {
    const compressorOn = dutyGate(ts, seed, 34 * 60, 0.46);
    return compressorOn ? 92 + waveSlow * 34 + waveFast * 10 : 7 + waveFast * 5;
  }

  if (device.id.startsWith("ac-") || device.category === "climate") {
    const compressorPulse = dutyGate(ts, seed, 7 * 60, 0.72) ? 0.12 : -0.08;
    const inverterDrift = 0.78 + waveSlow * 0.28 + waveFast * 0.06 + compressorPulse;
    return base * clamp(inverterDrift, 0.58, 1.18);
  }

  if (device.id.includes("kitchen") || device.label.toLowerCase().includes("dapur")) {
    const burst = dutyGate(ts, seed, 95, 0.34) ? 1.2 : 0.64;
    const simmer = dutyGate(ts, seed * 1.3, 210, 0.22) ? 0.18 : 0;
    return base * clamp(burst + simmer + (waveFast - 0.5) * 0.12, 0.18, 1.35);
  }

  if (device.id.includes("wm-dryer") || device.label.toLowerCase().includes("dryer")) {
    const motorCycle = 0.45 + Math.abs(Math.sin(ts / 41_000 + seed)) * 0.48;
    const heaterPulse = dutyGate(ts, seed, 5 * 60, 0.38) ? 0.22 : 0;
    return base * clamp(motorCycle + heaterPulse, 0.35, 1.16);
  }

  if (device.id.includes("outlet") || device.id.includes("plug")) {
    const chargerPulse = dutyGate(ts, seed, 125, 0.20) ? 0.18 : 0;
    return base * clamp(0.76 + waveSlow * 0.26 + chargerPulse, 0.48, 1.2);
  }

  if (device.category === "lighting") {
    return base * (0.97 + waveFast * 0.045);
  }

  if (device.category === "iot" || device.category === "security") {
    return base * (0.96 + waveSlow * 0.06);
  }

  if (device.category === "appliance") {
    const intermittent = dutyGate(ts, seed, 180, 0.28) ? 0.12 : 0;
    return base * clamp(0.82 + waveSlow * 0.22 + intermittent, 0.55, 1.16);
  }

  return base * (0.9 + waveSlow * 0.18);
}

class EnergySimulator {
  private state: State;
  private listeners = new Set<(snapshot: Snapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private deviceFactory: DeviceFactory | null = null;
  private lastPersistAt = 0;

  constructor() {
    this.state = normalizeState(loadJSON<State>(KEY, emptyState()));
    if (this.state.hours.length === 0) this.backfill();
    this.lastPersistAt = Date.now();
  }

  setDeviceFactory(fn: DeviceFactory) {
    this.deviceFactory = fn;
    const now = Date.now();
    this.repairCurrentDayIfClearlyEmpty(now);
    const latest = this.state.liveSamples[this.state.liveSamples.length - 1];
    if (!latest || now - latest.ts > 10_000 || this.state.liveSamples.length < 30) {
      this.primeLiveSamples(now);
    }
    this.broadcast(this.getMeasuredDevices(now));
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(fn: (snapshot: Snapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private backfill() {
    const now = Date.now();
    const startHour = hourBucketStart(now) - 24 * 30 * 3600_000;
    const baseDevices = [
      { id: "ac-bedroom", watts: 850, weight: 1.0 },
      { id: "ac-living", watts: 980, weight: 1.0 },
      { id: "fridge", watts: 110, weight: 1.0 },
      { id: "lighting", watts: 78, weight: 1.0 },
      { id: "tv-living", watts: 118, weight: 1.0 },
      { id: "kitchen", watts: 920, weight: 1.0 },
      { id: "wm-dryer", watts: 1280, weight: 0.78 },
      { id: "router-iot", watts: 21, weight: 1.0 },
      { id: "humidifier", watts: 34, weight: 0.7 },
      { id: "vacuum", watts: 32, weight: 0.75 },
      { id: "outlets", watts: 135, weight: 0.85 },
      { id: "camera", watts: 1.1, weight: 1.0 },
      { id: "doorbell", watts: 0.8, weight: 1.0 },
      { id: "door-lock", watts: 0.7, weight: 1.0 },
      { id: "energy-meter", watts: 1.8, weight: 1.0 },
    ];
    for (let i = 0; i < 24 * 30; i += 1) {
      const ts = startHour + i * 3600_000;
      const perDevice: Record<string, number> = {};
      let kwh = 0;
      for (const dev of baseDevices) {
        const seed = hashId(dev.id);
        const factor = historyUsageFactor(ts, dev.id, dev.weight);
        const jitter = seededHourJitter(ts, seed);
        const energy = (dev.watts * factor * jitter) / 1000;
        perDevice[dev.id] = energy;
        kwh += energy;
      }
      this.state.hours.push({ ts, kwh, perDevice });
      const mk = monthKey(ts);
      this.state.monthlyKwh[mk] = (this.state.monthlyKwh[mk] ?? 0) + kwh;
      const mpd = (this.state.monthlyPerDevice[mk] ??= {});
      for (const [id, v] of Object.entries(perDevice)) mpd[id] = (mpd[id] ?? 0) + v;
    }
    this.persist();
  }

  private getMeasuredDevices(now: number) {
    const nominal = this.deviceFactory?.(new Date(now)) ?? [];
    return nominal.map((device) => ({
      ...device,
      watts: Number(measuredDeviceWatts(device, now).toFixed(2)),
    }));
  }

  private makeLiveSample(ts: number, devices: DeviceLoad[]): LiveSample {
    const perDevice: Record<string, number> = {};
    let watts = 0;
    for (const d of devices) {
      perDevice[d.id] = Number(d.watts.toFixed(1));
      watts += d.watts;
    }
    return { ts, watts: Math.round(watts), perDevice };
  }

  private trimHours() {
    this.state.hours.sort((a, b) => a.ts - b.ts);
    while (this.state.hours.length > MAX_HOURS) this.state.hours.shift();
  }

  private addEnergy(sampleTs: number, elapsedMs: number, devices: DeviceLoad[]) {
    const bucketTs = hourBucketStart(sampleTs);
    let bucket = this.state.hours.find((h) => h.ts === bucketTs);
    if (!bucket) {
      bucket = { ts: bucketTs, kwh: 0, perDevice: {} };
      this.state.hours.push(bucket);
      this.trimHours();
    }
    const mk = monthKey(sampleTs);
    const mpd = (this.state.monthlyPerDevice[mk] ??= {});
    this.state.monthlyKwh[mk] = this.state.monthlyKwh[mk] ?? 0;
    const dt = elapsedMs / 3_600_000;
    for (const d of devices) {
      const energy = (d.watts / 1000) * dt;
      bucket.perDevice[d.id] = (bucket.perDevice[d.id] ?? 0) + energy;
      bucket.kwh += energy;
      mpd[d.id] = (mpd[d.id] ?? 0) + energy;
      this.state.monthlyKwh[mk] += energy;
    }
  }

  private catchUpEnergy(from: number, to: number) {
    if (!this.deviceFactory || to <= from) return;
    let cursor = Math.max(from, to - MAX_HOURS * 3600_000);
    while (cursor < to) {
      const next = Math.min(to, cursor + CATCH_UP_STEP_MS);
      const sampleTs = cursor + (next - cursor) / 2;
      this.addEnergy(sampleTs, next - cursor, this.getMeasuredDevices(sampleTs));
      cursor = next;
    }
    this.trimHours();
  }

  private removeBucketsFrom(startTs: number, endTs: number) {
    const kept: HourBucket[] = [];
    for (const bucket of this.state.hours) {
      if (bucket.ts < startTs || bucket.ts > endTs) {
        kept.push(bucket);
        continue;
      }
      const mk = monthKey(bucket.ts);
      this.state.monthlyKwh[mk] = Math.max(0, (this.state.monthlyKwh[mk] ?? 0) - bucket.kwh);
      const mpd = this.state.monthlyPerDevice[mk];
      if (mpd) {
        for (const [id, value] of Object.entries(bucket.perDevice)) {
          const next = (mpd[id] ?? 0) - value;
          if (next <= 0.000001) delete mpd[id];
          else mpd[id] = next;
        }
      }
    }
    this.state.hours = kept;
  }

  private repairCurrentDayIfClearlyEmpty(now: number) {
    if (!this.deviceFactory) return;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const startTs = todayStart.getTime();
    const elapsedMs = now - startTs;
    if (elapsedMs < 30 * 60_000) return;
    const todayKwh = this.state.hours
      .filter((b) => b.ts >= startTs && b.ts <= now)
      .reduce((sum, b) => sum + b.kwh, 0);
    const liveWatts = this.makeLiveSample(now, this.getMeasuredDevices(now)).watts;
    const minimumPlausible = Math.max(0.08, (liveWatts / 1000) * (elapsedMs / 3_600_000) * 0.16);
    if (todayKwh >= minimumPlausible) return;
    this.removeBucketsFrom(startTs, hourBucketStart(now));
    this.catchUpEnergy(startTs, now);
    this.state.lastTick = now;
    this.persist();
  }

  private primeLiveSamples(now: number) {
    if (!this.deviceFactory) return;
    const samples: LiveSample[] = [];
    for (let i = MAX_LIVE_SAMPLES - 1; i >= 0; i -= 1) {
      const ts = now - i * 1000;
      samples.push(this.makeLiveSample(ts, this.getMeasuredDevices(ts)));
    }
    this.state.liveSamples = samples;
    this.persist();
  }

  private pushLiveSample(ts: number, devices: DeviceLoad[]) {
    const sample = this.makeLiveSample(ts, devices);
    const last = this.state.liveSamples[this.state.liveSamples.length - 1];
    if (!last || sample.ts - last.ts >= 850) {
      this.state.liveSamples.push(sample);
      if (this.state.liveSamples.length > MAX_LIVE_SAMPLES) {
        this.state.liveSamples = this.state.liveSamples.slice(-MAX_LIVE_SAMPLES);
      }
    } else {
      this.state.liveSamples[this.state.liveSamples.length - 1] = sample;
    }
  }

  private tick() {
    if (!this.deviceFactory) return;
    const now = Date.now();
    const elapsedMs = now - this.state.lastTick;
    if (elapsedMs <= 0) return;
    if (elapsedMs > LONG_GAP_MS) {
      this.catchUpEnergy(this.state.lastTick, now);
    } else {
      this.addEnergy(now, elapsedMs, this.getMeasuredDevices(now));
    }
    this.state.lastTick = now;
    const devices = this.getMeasuredDevices(now);
    this.pushLiveSample(now, devices);
    if (elapsedMs > LONG_GAP_MS || now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.persist();
      this.lastPersistAt = now;
    }
    this.broadcast(devices);
  }

  private persist() {
    saveJSON(KEY, this.state);
  }

  private snapshotHours(now: number) {
    const currentHour = hourBucketStart(now);
    const hours = this.state.hours.slice();
    if (!hours.some((bucket) => bucket.ts === currentHour)) {
      hours.push({ ts: currentHour, kwh: 0, perDevice: {} });
    }
    return hours.sort((a, b) => a.ts - b.ts).slice(-MAX_HOURS);
  }

  snapshot(devicesOverride?: DeviceLoad[]): Snapshot {
    const now = Date.now();
    const devices = devicesOverride ?? this.getMeasuredDevices(now);
    const sample = this.makeLiveSample(now, devices);
    const liveSamples = this.state.liveSamples.length > 0
      ? this.state.liveSamples.slice(-MAX_LIVE_SAMPLES)
      : [sample];
    const hours = this.snapshotHours(now);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayKwh = hours
      .filter((b) => b.ts >= todayStart.getTime() && b.ts <= now)
      .reduce((s, b) => s + b.kwh, 0);
    const mk = monthKey(now);
    return {
      now,
      liveWatts: sample.watts,
      liveSamples: liveSamples[liveSamples.length - 1]?.ts === sample.ts
        ? liveSamples
        : [...liveSamples, sample].slice(-MAX_LIVE_SAMPLES),
      todayKwh,
      hours,
      monthlyKwh: { ...this.state.monthlyKwh },
      monthlyPerDevice: this.state.monthlyPerDevice[mk] ?? {},
      devices,
    };
  }

  private broadcast(devices: DeviceLoad[]) {
    const snap = this.snapshot(devices);
    for (const fn of this.listeners) fn(snap);
  }

  resetAll() {
    this.state = emptyState();
    this.backfill();
    this.primeLiveSamples(Date.now());
    const devices = this.getMeasuredDevices(Date.now());
    this.pushLiveSample(Date.now(), devices);
    this.persist();
    this.lastPersistAt = Date.now();
    this.broadcast(devices);
  }

  consumeMonthForInvoice(mk: string) {
    return {
      kwh: this.state.monthlyKwh[mk] ?? 0,
      perDevice: this.state.monthlyPerDevice[mk] ?? {},
    };
  }
}

export type Snapshot = {
  now: number;
  liveWatts: number;
  liveSamples: LiveSample[];
  todayKwh: number;
  hours: HourBucket[];
  monthlyKwh: Record<string, number>;
  monthlyPerDevice: Record<string, number>;
  devices: DeviceLoad[];
};

export const energySim = new EnergySimulator();

if (typeof window !== "undefined") {
  energySim.start();
}
