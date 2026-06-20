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
  hours: HourBucket[]; // rolling 24 * 30 days
  monthlyKwh: Record<string, number>; // "2026-06" -> kWh
  monthlyPerDevice: Record<string, Record<string, number>>;
  liveSamples: LiveSample[]; // rolling realtime power trace in watts
};

const KEY = "mas.energy.v2";
const MAX_HOURS = 24 * 32;
const MAX_LIVE_SAMPLES = 180;
const PERSIST_INTERVAL_MS = 5000;

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

function historyUsageFactor(ts: number, id: string, baseWeight: number) {
  const d = new Date(ts);
  const hourFloat = d.getHours() + d.getMinutes() / 60;
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const night = Math.max(bell(hourFloat, 0.5, 3.2), bell(hourFloat, 23, 2.2));
  const evening = bell(hourFloat, 20.2, 2.4);
  const midday = bell(hourFloat, 13, 1.2);
  const breakfast = bell(hourFloat, 7.1, 0.42);
  const lunch = bell(hourFloat, 12.3, 0.48);
  const dinner = bell(hourFloat, 19.1, 0.62);
  const daylight = bell(hourFloat, 13, 4.6);

  let factor = baseWeight;
  if (id.startsWith("ac")) factor *= 0.18 + night * 0.58 + evening * 0.38 + midday * 0.28;
  if (id === "lighting") factor *= Math.max(0.1, 0.35 + evening * 0.85 + night * 0.55 - daylight * 0.24);
  if (id === "tv-living") factor *= 0.12 + evening * 0.95 + (isWeekend ? bell(hourFloat, 14, 1.8) * 0.46 : 0);
  if (id === "kitchen") factor *= 0.04 + Math.max(breakfast * 0.82, lunch * 0.68, dinner);
  if (id === "wm-dryer") factor *= d.getDay() % 3 === 0 ? bell(hourFloat, 8.6, 0.72) : 0;
  return Math.max(0, factor);
}

function standbyWatts(device: DeviceLoad, ts: number) {
  const seed = hashId(device.id);
  const base =
    device.category === "security" ? 0.7 :
      device.category === "iot" ? 0.8 :
        device.category === "climate" ? 2.8 : 1.2;
  return base + smoothUnit(ts, seed, 17) * 0.8;
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
  private deviceFactory: (() => DeviceLoad[]) | null = null;
  private lastPersistAt = 0;

  constructor() {
    this.state = normalizeState(loadJSON<State>(KEY, emptyState()));
    if (this.state.hours.length === 0) this.backfill();
    this.lastPersistAt = Date.now();
  }

  setDeviceFactory(fn: () => DeviceLoad[]) {
    this.deviceFactory = fn;
    const now = Date.now();
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
    // Generate 30 days of deterministic, apartment-like hourly history.
    const now = Date.now();
    const startHour = hourBucketStart(now) - 24 * 30 * 3600_000;
    const baseDevices = [
      { id: "ac-bedroom", watts: 950, weight: 0.65 },
      { id: "ac-living", watts: 1100, weight: 0.55 },
      { id: "fridge", watts: 110, weight: 1.0 },
      { id: "lighting", watts: 80, weight: 0.5 },
      { id: "tv-living", watts: 120, weight: 0.35 },
      { id: "kitchen", watts: 600, weight: 0.18 },
      { id: "wm-dryer", watts: 1400, weight: 0.04 },
      { id: "router-iot", watts: 22, weight: 1.0 },
    ];
    for (let i = 0; i < 24 * 30; i += 1) {
      const ts = startHour + i * 3600_000;
      const perDevice: Record<string, number> = {};
      let kwh = 0;
      for (const dev of baseDevices) {
        const seed = hashId(dev.id);
        const factor = historyUsageFactor(ts, dev.id, dev.weight);
        const jitter = seededHourJitter(ts, seed);
        const energy = (dev.watts * factor * jitter) / 1000; // kWh in 1 hour
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
    const nominal = this.deviceFactory?.() ?? [];
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
    const elapsedMs = Math.min(2000, now - this.state.lastTick);
    this.state.lastTick = now;
    if (elapsedMs <= 0) return;
    const devices = this.getMeasuredDevices(now);
    const bucketTs = hourBucketStart(now);
    let bucket = this.state.hours[this.state.hours.length - 1];
    let bucketCreated = false;
    if (!bucket || bucket.ts !== bucketTs) {
      bucket = { ts: bucketTs, kwh: 0, perDevice: {} };
      this.state.hours.push(bucket);
      bucketCreated = true;
      if (this.state.hours.length > MAX_HOURS) this.state.hours.shift();
    }
    const mk = monthKey(now);
    const mpd = (this.state.monthlyPerDevice[mk] ??= {});
    const dt = elapsedMs / 3_600_000; // hours
    for (const d of devices) {
      const energy = (d.watts / 1000) * dt; // kWh
      bucket.perDevice[d.id] = (bucket.perDevice[d.id] ?? 0) + energy;
      bucket.kwh += energy;
      mpd[d.id] = (mpd[d.id] ?? 0) + energy;
      this.state.monthlyKwh[mk] = (this.state.monthlyKwh[mk] ?? 0) + energy;
    }
    this.pushLiveSample(now, devices);
    if (bucketCreated || now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.persist();
      this.lastPersistAt = now;
    }
    this.broadcast(devices);
  }

  private persist() {
    saveJSON(KEY, this.state);
  }

  snapshot(devicesOverride?: DeviceLoad[]): Snapshot {
    const now = Date.now();
    const devices = devicesOverride ?? this.getMeasuredDevices(now);
    const sample = this.makeLiveSample(now, devices);
    const liveSamples = this.state.liveSamples.length > 0
      ? this.state.liveSamples.slice(-MAX_LIVE_SAMPLES)
      : [sample];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayKwh = this.state.hours
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
      hours: this.state.hours.slice(),
      monthlyKwh: { ...this.state.monthlyKwh },
      monthlyPerDevice: this.state.monthlyPerDevice[mk] ?? {},
      devices,
    };
  }

  private broadcast(devices: DeviceLoad[]) {
    const snap = this.snapshot(devices);
    for (const fn of this.listeners) fn(snap);
  }

  // Helpers
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
  // Auto-start once mounted in browser.
  energySim.start();
}
