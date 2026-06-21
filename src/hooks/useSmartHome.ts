import { useSyncExternalStore } from "react";
import {
  initialConfiguredDevices,
  initialDevices,
  initialOutletStates,
  initialRoomLighting,
  outletPins,
  rooms,
} from "@/domain/smartHomeData";
import type {
  AutomationEvent,
  AutomationEventTone,
  ConfiguredSmartDevice,
  DeviceMode,
  OutletKey,
  OutletState,
  RoomKey,
  RoomLightingState,
  SmartDevice,
  VacuumCommand,
} from "@/domain/smartHomeTypes";
import { energySim } from "@/services/energySimulator";
import { loadJSON, saveJSON } from "@/services/persistence";
import { buildSmartApartmentDeviceLoads } from "@/services/smartApartmentSimulation";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Position = { x: string; y: string };

type EventInput = {
  message: string;
  detail?: string;
  tone?: AutomationEventTone;
};

type StoreState = {
  devices: SmartDevice[];
  configuredDevices: ConfiguredSmartDevice[];
  roomLighting: Record<RoomKey, RoomLightingState>;
  outletStates: Record<OutletKey, OutletState>;
  roomPositions: Record<RoomKey, Position>;
  outletPositions: Record<OutletKey, Position>;
  lockPosition: Position;
  climatePosition: Position;
  activeRoomIndex: number;
  eventLog: AutomationEvent[];
};

const KEY = "mas.home.v2";
const MAX_EVENTS = 14;

const initialRoomPositions: Record<RoomKey, Position> = {
  bedroom: { x: rooms.find((r) => r.key === "bedroom")?.x ?? "32%", y: rooms.find((r) => r.key === "bedroom")?.y ?? "43%" },
  living: { x: rooms.find((r) => r.key === "living")?.x ?? "53%", y: rooms.find((r) => r.key === "living")?.y ?? "61%" },
  kitchen: { x: rooms.find((r) => r.key === "kitchen")?.x ?? "53%", y: rooms.find((r) => r.key === "kitchen")?.y ?? "28%" },
  dining: { x: rooms.find((r) => r.key === "dining")?.x ?? "74%", y: rooms.find((r) => r.key === "dining")?.y ?? "44%" },
};

const initialOutletPositions: Record<OutletKey, Position> = {
  "living-tv": { x: outletPins.find((p) => p.key === "living-tv")?.x ?? "46%", y: outletPins.find((p) => p.key === "living-tv")?.y ?? "63%" },
  "kitchen-counter": { x: outletPins.find((p) => p.key === "kitchen-counter")?.x ?? "51.5%", y: outletPins.find((p) => p.key === "kitchen-counter")?.y ?? "36%" },
  "dining-wall": { x: outletPins.find((p) => p.key === "dining-wall")?.x ?? "74%", y: outletPins.find((p) => p.key === "dining-wall")?.y ?? "48%" },
  "bedroom-desk": { x: outletPins.find((p) => p.key === "bedroom-desk")?.x ?? "30%", y: outletPins.find((p) => p.key === "bedroom-desk")?.y ?? "38%" },
};

function makeEvent(input: EventInput): AutomationEvent {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    message: input.message,
    detail: input.detail,
    tone: input.tone ?? "info",
  };
}

function defaultState(): StoreState {
  return {
    devices: initialDevices,
    configuredDevices: initialConfiguredDevices,
    roomLighting: initialRoomLighting,
    outletStates: initialOutletStates,
    roomPositions: initialRoomPositions,
    outletPositions: initialOutletPositions,
    lockPosition: { x: "12.8%", y: "79.2%" },
    climatePosition: { x: "50.8%", y: "56.5%" },
    activeRoomIndex: 0,
    eventLog: [
      {
        id: "boot-demo-ready",
        ts: Date.now(),
        message: "Apartment simulator ready",
        detail: "Energy, devices, and billing synchronized",
        tone: "success",
      },
    ],
  };
}

function normalizeState(raw: Partial<StoreState>): StoreState {
  const fallback = defaultState();
  return {
    ...fallback,
    ...raw,
    devices: raw.devices ?? fallback.devices,
    configuredDevices: raw.configuredDevices ?? fallback.configuredDevices,
    roomLighting: { ...fallback.roomLighting, ...(raw.roomLighting ?? {}) },
    outletStates: { ...fallback.outletStates, ...(raw.outletStates ?? {}) },
    roomPositions: { ...fallback.roomPositions, ...(raw.roomPositions ?? {}) },
    outletPositions: { ...fallback.outletPositions, ...(raw.outletPositions ?? {}) },
    lockPosition: raw.lockPosition ?? fallback.lockPosition,
    climatePosition: raw.climatePosition ?? fallback.climatePosition,
    activeRoomIndex: clamp(raw.activeRoomIndex ?? fallback.activeRoomIndex, 0, rooms.length - 1),
    eventLog: (raw.eventLog ?? fallback.eventLog).slice(0, MAX_EVENTS),
  };
}

let state: StoreState = normalizeState(loadJSON<Partial<StoreState>>(KEY, defaultState()));
const listeners = new Set<() => void>();

energySim.setDeviceFactory(() => buildSmartApartmentDeviceLoads(state));
if (typeof window !== "undefined") energySim.start();

function persist() {
  saveJSON(KEY, state);
}

function notify() {
  persist();
  for (const fn of listeners) fn();
}

function update(
  patch: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>),
  event?: EventInput,
) {
  const next = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...next };
  if (event) {
    state = { ...state, eventLog: [makeEvent(event), ...state.eventLog].slice(0, MAX_EVENTS) };
  }
  notify();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function roomLabel(roomKey: RoomKey) {
  return rooms.find((r) => r.key === roomKey)?.label ?? roomKey;
}

function outletLabel(outletKey: OutletKey) {
  return outletPins.find((pin) => pin.key === outletKey)?.label ?? outletKey;
}

function statusForPower(device: SmartDevice, power: boolean): SmartDevice["status"] {
  if (device.type === "lock") return power ? "locked" : "standby";
  if (device.type === "vacuum") return power ? "cleaning" : "docked";
  return power ? "active" : "standby";
}

function vacuumEvent(command: VacuumCommand, device: SmartDevice): EventInput {
  const detail = `${device.room} · cleaning robot`;
  switch (command) {
    case "start":
      return { message: "Robot vacuum started", detail, tone: "success" };
    case "pause":
      return { message: "Robot vacuum paused", detail: "Resume or dock when ready", tone: "info" };
    case "dock":
      return { message: "Robot vacuum returning to dock", detail, tone: "info" };
    case "spot":
      return { message: "Spot clean started", detail, tone: "success" };
    case "locate":
      return { message: "Robot vacuum locator ping", detail: "Beep signal sent", tone: "info" };
  }
}

const actions = {
  setDevicePower(deviceId: string, power: boolean) {
    const device = state.devices.find((d) => d.id === deviceId);
    update(
      (s) => ({
        devices: s.devices.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                power,
                status: statusForPower(d, power),
              }
            : d,
        ),
      }),
      device
        ? {
            message: `${device.name} ${power ? "ON" : "OFF"}`,
            detail: device.room,
            tone: power ? "success" : "info",
          }
        : undefined,
    );
  },
  setDeviceValue(deviceId: string, value: number) {
    const device = state.devices.find((d) => d.id === deviceId);
    update(
      (s) => ({
        devices: s.devices.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                value,
                power: d.type === "climate" ? true : d.power,
                status: d.type === "climate" ? "active" : d.status,
              }
            : d,
        ),
      }),
      device
        ? {
            message: `${device.name} set to ${value}${device.unit ?? ""}`,
            detail: "Energy load recalculated",
            tone: "success",
          }
        : undefined,
    );
  },
  setDeviceMode(deviceId: string, mode: DeviceMode) {
    const device = state.devices.find((d) => d.id === deviceId);
    update(
      (s) => ({
        devices: s.devices.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                mode,
                power: d.type === "climate" ? true : d.power,
                status: d.type === "climate" ? "active" : d.status,
              }
            : d,
        ),
      }),
      device
        ? {
            message: `${device.name} mode ${mode}`,
            detail: dLabelForMode(device, mode),
            tone: "success",
          }
        : undefined,
    );
  },
  controlVacuum(deviceId: string, command: VacuumCommand) {
    const device = state.devices.find((d) => d.id === deviceId);
    if (!device) return;

    update(
      (s) => ({
        devices: s.devices.map((d) => {
          if (d.id !== deviceId) return d;
          if (command === "locate") return d;
          if (command === "pause") return { ...d, power: false, status: "paused" };
          if (command === "dock") return { ...d, power: false, status: "returning" };
          if (command === "spot") return { ...d, power: true, status: "spot" };
          return { ...d, power: true, status: "cleaning" };
        }),
      }),
      vacuumEvent(command, device),
    );
  },
  toggleDoorLock() {
    const lock = state.devices.find((d) => d.id === "door-lock");
    if (!lock) return;
    actions.setDevicePower(lock.id, !lock.power);
  },
  setActiveRoomLighting(patch: Partial<RoomLightingState>) {
    const activeRoom = rooms[state.activeRoomIndex];
    const detail = activeRoom.label;
    const message =
      patch.on !== undefined
        ? `${activeRoom.label} lighting ${patch.on ? "ON" : "OFF"}`
        : patch.brightness !== undefined
          ? `${activeRoom.label} brightness ${clamp(patch.brightness, 0, 100)}%`
          : `${activeRoom.label} lighting updated`;
    update(
      (s) => {
        const room = rooms[s.activeRoomIndex];
        const current = s.roomLighting[room.key];
        return {
          roomLighting: {
            ...s.roomLighting,
            [room.key]: {
              ...current,
              ...patch,
              brightness:
                patch.brightness === undefined
                  ? current.brightness
                  : clamp(patch.brightness, 0, 100),
            },
          },
        };
      },
      { message, detail, tone: patch.on === false ? "info" : "success" },
    );
  },
  setRoomPower(roomKey: RoomKey, power: boolean) {
    update(
      (s) => ({
        roomLighting: {
          ...s.roomLighting,
          [roomKey]: { ...s.roomLighting[roomKey], on: power },
        },
      }),
      {
        message: `${roomLabel(roomKey)} lighting ${power ? "ON" : "OFF"}`,
        detail: "Apartment load updated",
        tone: power ? "success" : "info",
      },
    );
  },
  selectRoom(roomKey: RoomKey) {
    const idx = rooms.findIndex((r) => r.key === roomKey);
    if (idx >= 0) update({ activeRoomIndex: idx });
  },
  cycleRoom(direction: number) {
    update((s) => ({
      activeRoomIndex: (s.activeRoomIndex + direction + rooms.length) % rooms.length,
    }));
  },
  toggleOutlet(outletKey: OutletKey) {
    const nextPower = !state.outletStates[outletKey].on;
    update(
      (s) => ({
        outletStates: { ...s.outletStates, [outletKey]: { on: !s.outletStates[outletKey].on } },
      }),
      {
        message: `${outletLabel(outletKey)} ${nextPower ? "ON" : "OFF"}`,
        detail: "Smart outlet layer",
        tone: nextPower ? "success" : "info",
      },
    );
  },
  updateRoomPosition(roomKey: RoomKey, x: string, y: string) {
    update((s) => ({ roomPositions: { ...s.roomPositions, [roomKey]: { x, y } } }));
  },
  updateOutletPosition(outletKey: OutletKey, x: string, y: string) {
    update((s) => ({ outletPositions: { ...s.outletPositions, [outletKey]: { x, y } } }));
  },
  updateBasePosition(type: "lock" | "climate", x: string, y: string) {
    if (type === "lock") update({ lockPosition: { x, y } });
    else update({ climatePosition: { x, y } });
  },
  saveConfiguredDevice(device: ConfiguredSmartDevice) {
    update(
      (s) => {
        const exists = s.configuredDevices.some((d) => d.id === device.id);
        return {
          configuredDevices: exists
            ? s.configuredDevices.map((d) => (d.id === device.id ? device : d))
            : [...s.configuredDevices, device],
        };
      },
      {
        message: `${device.name} paired`,
        detail: `${roomLabel(device.roomKey)} · ${device.adapter}`,
        tone: "success",
      },
    );
  },
  updateConfiguredDevicePosition(deviceId: string, x: string, y: string) {
    update((s) => ({
      configuredDevices: s.configuredDevices.map((d) =>
        d.id === deviceId ? { ...d, x, y } : d,
      ),
    }));
  },
  toggleConfiguredDevice(deviceId: string) {
    const device = state.configuredDevices.find((d) => d.id === deviceId);
    const nextPower = !device?.power;
    update(
      (s) => ({
        configuredDevices: s.configuredDevices.map((d) =>
          d.id === deviceId ? { ...d, power: !d.power } : d,
        ),
      }),
      device
        ? {
            message: `${device.name} ${nextPower ? "ON" : "OFF"}`,
            detail: `${roomLabel(device.roomKey)} · ${device.layer}`,
            tone: nextPower ? "success" : "info",
          }
        : undefined,
    );
  },
  deleteConfiguredDevice(deviceId: string) {
    const device = state.configuredDevices.find((d) => d.id === deviceId);
    update(
      (s) => ({ configuredDevices: s.configuredDevices.filter((d) => d.id !== deviceId) }),
      device
        ? {
            message: `${device.name} removed`,
            detail: "Device library updated",
            tone: "warning",
          }
        : undefined,
    );
  },
};

function dLabelForMode(device: SmartDevice, mode: DeviceMode) {
  if (device.type === "vacuum") {
    if (mode === "eco") return "Quiet suction";
    if (mode === "comfort") return "Daily cleaning suction";
    if (mode === "manual") return "Turbo suction";
  }
  return "Automation profile updated";
}

function getSnapshot() {
  return state;
}

export function useSmartHome() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const activeRoom = rooms[snap.activeRoomIndex];
  const activeLighting = snap.roomLighting[activeRoom.key];
  const climateDevice = snap.devices.find((d) => d.id === "climate-hall");
  const vacuumDevice = snap.devices.find((d) => d.id === "vacuum-bedroom");
  const humidifierDevice = snap.devices.find((d) => d.id === "humidifier-living");
  const doorbellDevice = snap.devices.find((d) => d.id === "doorbell");
  const doorLockDevice = snap.devices.find((d) => d.id === "door-lock");
  const cameraDevice = snap.devices.find((d) => d.id === "camera-living");
  const energyDevice = snap.devices.find((d) => d.id === "energy-meter");

  const onlineDevices = snap.devices.filter((d) => d.status !== "offline").length;
  const activeDevices = snap.devices.filter((d) => d.power || d.status === "active" || d.status === "cleaning" || d.status === "spot").length;

  const enabledRooms = rooms.filter((r) => snap.roomLighting[r.key].on);
  const avgBrightness =
    enabledRooms.length === 0
      ? 0
      : enabledRooms.reduce((s, r) => s + snap.roomLighting[r.key].brightness, 0) /
        enabledRooms.length /
        100;

  const lightingLoad = rooms.reduce(
    (t, r) => t + (snap.roomLighting[r.key].on ? snap.roomLighting[r.key].brightness : 0),
    0,
  );
  const outletLoad = Object.values(snap.outletStates).filter((o) => o.on).length * 0.32;
  const activeLoad = snap.devices.filter((d) => d.power).length * 0.18;
  const energyLevel = Number((1.8 + lightingLoad / 150 + outletLoad + activeLoad).toFixed(1));

  return {
    ...snap,
    activeRoom,
    activeLighting,
    climateDevice,
    vacuumDevice,
    humidifierDevice,
    doorbellDevice,
    doorLockDevice,
    cameraDevice,
    energyDevice,
    onlineDevices,
    activeDevices,
    avgBrightness,
    energyLevel,
    ...actions,
  };
}
