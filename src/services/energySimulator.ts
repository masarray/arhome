// Singleton energy simulator. Ticks every second, accumulates kWh.
// Persisted to localStorage so refresh keeps the demo "alive".
import { loadJSON, saveJSON } from "./persistence";

export type DeviceLoad = {
  id: string;
  label: string;
  room: string;
  watts: number; // current instantaneous draw
  on: boolean;
  category: string;
};

export type HourBucket = { ts: number; kwh: number; perDevice: Record<string, number> };

type State = {
  lastTick: number;
  hours: HourBucket[]; // rolling 24 * 30 days
  monthlyKwh: Record<string, number>; // "2026-06" -> kWh
  monthlyPerDevice: Record<string, Record<string, number>>;
};

const KEY = "mas.energy.v2";
const MAX_HOURS = 24 * 32;

function emptyState(): State {
  return { lastTick: Date.now(), hours: [], monthlyKwh: {}, monthlyPerDevice: {} };
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

function noise(t: number, seed: number) {
  // smooth pseudo-noise 0..1
  return (
    0.5 +
    0.25 * Math.sin(t / 9000 + seed) +
    0.15 * Math.sin(t / 2300 + seed * 1.7) +
    0.10 * Math.sin(t / 700 + seed * 3.1)
  );
}

class EnergySimulator {
  private state: State;
  private listeners = new Set<(snapshot: Snapshot) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private deviceFactory: (() => DeviceLoad[]) | null = null;

  constructor() {
    this.state = loadJSON<State>(KEY, emptyState());
    if (this.state.hours.length === 0) this.backfill();
  }

  setDeviceFactory(fn: () => DeviceLoad[]) {
    this.deviceFactory = fn;
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
    // generate 30 days of realistic hourly history for an apartment
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
      const d = new Date(ts);
      const hour = d.getHours();
      const isNight = hour >= 22 || hour <= 5;
      const isPeak = hour >= 18 && hour <= 22;
      const isMidday = hour >= 12 && hour <= 14;
      const perDevice: Record<string, number> = {};
      let kwh = 0;
      for (const dev of baseDevices) {
        let factor = dev.weight;
        if (dev.id.startsWith("ac")) factor *= isNight || isPeak ? 0.95 : isMidday ? 0.8 : 0.25;
        if (dev.id === "lighting") factor *= isNight || hour < 7 || hour > 18 ? 1.2 : 0.15;
        if (dev.id === "tv-living") factor *= isPeak ? 1.1 : 0.2;
        if (dev.id === "kitchen") factor *= hour === 7 || hour === 12 || hour === 19 ? 1.0 : 0.05;
        if (dev.id === "wm-dryer") factor *= hour === 8 && d.getDay() % 3 === 0 ? 1.0 : 0;
        const jitter = 0.85 + Math.random() * 0.3;
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

  private tick() {
    if (!this.deviceFactory) return;
    const now = Date.now();
    const elapsedMs = Math.min(2000, now - this.state.lastTick);
    this.state.lastTick = now;
    if (elapsedMs <= 0) return;
    const devices = this.deviceFactory();
    const bucketTs = hourBucketStart(now);
    let bucket = this.state.hours[this.state.hours.length - 1];
    if (!bucket || bucket.ts !== bucketTs) {
      bucket = { ts: bucketTs, kwh: 0, perDevice: {} };
      this.state.hours.push(bucket);
      if (this.state.hours.length > MAX_HOURS) this.state.hours.shift();
    }
    const mk = monthKey(now);
    const mpd = (this.state.monthlyPerDevice[mk] ??= {});
    const dt = elapsedMs / 3_600_000; // hours
    for (const d of devices) {
      const draw = d.on ? d.watts : Math.min(d.watts, 2.5); // standby
      const energy = (draw / 1000) * dt; // kWh
      bucket.perDevice[d.id] = (bucket.perDevice[d.id] ?? 0) + energy;
      bucket.kwh += energy;
      mpd[d.id] = (mpd[d.id] ?? 0) + energy;
      this.state.monthlyKwh[mk] = (this.state.monthlyKwh[mk] ?? 0) + energy;
    }
    if (now % 5 < 2) this.persist();
    this.broadcast(devices);
  }

  private persist() {
    saveJSON(KEY, this.state);
  }

  snapshot(devicesOverride?: DeviceLoad[]): Snapshot {
    const devices = devicesOverride ?? this.deviceFactory?.() ?? [];
    const now = Date.now();
    const liveWatts = devices.reduce((sum, d) => sum + (d.on ? d.watts : Math.min(d.watts, 2.5)), 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayKwh = this.state.hours
      .filter((b) => b.ts >= todayStart.getTime() && b.ts <= now)
      .reduce((s, b) => s + b.kwh, 0);
    const mk = monthKey(now);
    return {
      now,
      liveWatts,
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
    this.persist();
    this.broadcast(this.deviceFactory?.() ?? []);
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
