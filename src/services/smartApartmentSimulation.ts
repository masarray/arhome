import { rooms } from "@/domain/smartHomeData";
import type {
  ConfiguredSmartDevice,
  OutletKey,
  OutletState,
  RoomKey,
  RoomLightingState,
  SmartDevice,
  SmartDeviceCategory,
} from "@/domain/smartHomeTypes";
import type { DeviceLoad } from "@/services/energySimulator";

type SmartApartmentSimulationState = {
  devices: SmartDevice[];
  configuredDevices: ConfiguredSmartDevice[];
  roomLighting: Record<RoomKey, RoomLightingState>;
  outletStates: Record<OutletKey, OutletState>;
};

const CONFIGURED_DEVICE_WATTS: Record<SmartDeviceCategory, number> = {
  "smart-bulb": 9,
  "smart-outlet": 90,
  "wall-switch": 8,
  "ac-controller": 42,
  "robot-cleaner": 28,
  "door-lock": 2,
  camera: 6,
  sensor: 0.5,
};

const CATEGORY_TO_LOAD: Record<SmartDeviceCategory, DeviceLoad["category"]> = {
  "smart-bulb": "lighting",
  "smart-outlet": "appliance",
  "wall-switch": "lighting",
  "ac-controller": "climate",
  "robot-cleaner": "appliance",
  "door-lock": "security",
  camera: "iot",
  sensor: "iot",
};

function getDevice(state: SmartApartmentSimulationState, id: string) {
  return state.devices.find((device) => device.id === id);
}

function getTimeProfile(now: Date) {
  const hour = now.getHours();
  const isPeak = hour >= 18 && hour <= 22;
  const isNight = hour >= 22 || hour <= 5;
  const isMidday = hour >= 12 && hour <= 14;
  return { hour, isPeak, isNight, isMidday };
}

function buildLightingWatts(state: SmartApartmentSimulationState, now: Date) {
  const { hour, isNight } = getTimeProfile(now);
  const roomBoost = isNight || hour < 7 || hour > 18 ? 1.12 : 0.42;

  return rooms.reduce((sum, room) => {
    const lighting = state.roomLighting[room.key];
    if (!lighting.on) return sum;
    return sum + (4 + (lighting.brightness / 100) * 54) * roomBoost;
  }, 0);
}

function buildConfiguredLoad(device: ConfiguredSmartDevice): DeviceLoad {
  const standbyWatts = device.category === "sensor" ? 0.2 : 1.5;
  const watts = device.power ? CONFIGURED_DEVICE_WATTS[device.category] : standbyWatts;

  return {
    id: `configured-${device.id}`,
    label: device.name,
    room: device.roomKey,
    category: CATEGORY_TO_LOAD[device.category],
    watts,
    on: device.power,
  };
}

export function buildSmartApartmentDeviceLoads(
  state: SmartApartmentSimulationState,
  now = new Date(),
): DeviceLoad[] {
  const { hour, isPeak, isNight, isMidday } = getTimeProfile(now);
  const climate = getDevice(state, "climate-hall");
  const humidifier = getDevice(state, "humidifier-living");
  const vacuum = getDevice(state, "vacuum-bedroom");
  const camera = getDevice(state, "camera-living");
  const doorbell = getDevice(state, "doorbell");
  const doorLock = getDevice(state, "door-lock");
  const energyMeter = getDevice(state, "energy-meter");

  const acFactor = isNight || isPeak ? 0.85 : isMidday ? 0.55 : 0.18;
  const targetTemp = Number(climate?.value ?? 24);
  const acLiving = climate?.power
    ? 1100 * acFactor + Math.abs(24 - targetTemp) * 40
    : 35;
  const acBedroom = 950 * (isNight ? 0.78 : isPeak ? 0.42 : 0.14);
  const fridge = 95 + (Math.sin(now.getMinutes() / 6) + 1) * 18;
  const lighting = buildLightingWatts(state, now);
  const tv = isPeak ? 130 : 12;
  const kitchen = hour === 7 ? 800 : hour === 12 ? 600 : hour === 19 ? 950 : 6;
  const laundry = hour === 8 && now.getDay() % 3 === 0 ? 1200 : 0;
  const activeOutlets = Object.values(state.outletStates).filter((outlet) => outlet.on).length;
  const outletWatts = activeOutlets > 0 ? activeOutlets * 90 + 4 : 1;

  const builtInLoads: DeviceLoad[] = [
    { id: "ac-bedroom", label: "AC Bedroom", room: "Bedroom", category: "climate", watts: acBedroom, on: true },
    { id: "ac-living", label: "AC Living", room: "Living", category: "climate", watts: acLiving, on: true },
    { id: "fridge", label: "Kulkas", room: "Kitchen", category: "appliance", watts: fridge, on: true },
    { id: "lighting", label: "Lampu apartemen", room: "All", category: "lighting", watts: lighting, on: lighting > 2 },
    { id: "tv-living", label: "TV & Hiburan", room: "Living", category: "appliance", watts: tv, on: tv > 20 },
    { id: "kitchen", label: "Dapur", room: "Kitchen", category: "appliance", watts: kitchen, on: kitchen > 10 },
    { id: "wm-dryer", label: "Mesin Cuci & Dryer", room: "Utility", category: "appliance", watts: laundry, on: laundry > 0 },
    { id: "router-iot", label: "Router & IoT", room: "Hall", category: "iot", watts: 22, on: true },
    {
      id: "humidifier",
      label: "Humidifier",
      room: "Living",
      category: "appliance",
      watts: humidifier?.power ? 38 : 1.5,
      on: Boolean(humidifier?.power),
    },
    {
      id: "vacuum",
      label: "Robot vacuum",
      room: "Bedroom",
      category: "appliance",
      watts: vacuum?.power ? 28 : 2.2,
      on: Boolean(vacuum?.power),
    },
    { id: "outlets", label: "Smart outlets", room: "All", category: "appliance", watts: outletWatts, on: activeOutlets > 0 },
    { id: "camera", label: "Camera", room: "Living", category: "iot", watts: camera?.power ? 6 : 0.6, on: Boolean(camera?.power) },
    { id: "doorbell", label: "Door bell", room: "Entry", category: "iot", watts: doorbell?.power ? 3 : 0.8, on: Boolean(doorbell?.power) },
    { id: "door-lock", label: "Door lock", room: "Entry", category: "security", watts: doorLock?.power ? 2 : 0.7, on: Boolean(doorLock?.power) },
    { id: "energy-meter", label: "Energy meter", room: "Panel", category: "iot", watts: energyMeter?.power ? 1.8 : 0.4, on: Boolean(energyMeter?.power) },
  ];

  return [...builtInLoads, ...state.configuredDevices.map(buildConfiguredLoad)];
}
