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

function wrappedHourDistance(hour: number, target: number) {
  const raw = Math.abs(hour - target);
  return Math.min(raw, 24 - raw);
}

function bell(hour: number, target: number, width: number) {
  const distance = wrappedHourDistance(hour, target);
  return Math.exp(-(distance * distance) / (2 * width * width));
}

function getTimeProfile(now: Date) {
  const hour = now.getHours();
  const hourFloat = hour + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  const nightScore = Math.max(bell(hourFloat, 0.5, 3.2), bell(hourFloat, 23, 2.2));
  const eveningScore = bell(hourFloat, 20.2, 2.4);
  const middayScore = bell(hourFloat, 13, 1.2);
  const breakfastScore = bell(hourFloat, 7.1, 0.42);
  const lunchScore = bell(hourFloat, 12.3, 0.48);
  const dinnerScore = bell(hourFloat, 19.1, 0.62);
  const daylightScore = bell(hourFloat, 13, 4.6);

  return {
    hour,
    hourFloat,
    isWeekend,
    nightScore,
    eveningScore,
    middayScore,
    breakfastScore,
    lunchScore,
    dinnerScore,
    daylightScore,
  };
}

function buildLightingWatts(state: SmartApartmentSimulationState, now: Date) {
  const { daylightScore, eveningScore, nightScore } = getTimeProfile(now);
  const roomBoost = 0.36 + eveningScore * 0.92 + nightScore * 0.55 - daylightScore * 0.22;

  return rooms.reduce((sum, room) => {
    const lighting = state.roomLighting[room.key];
    if (!lighting.on) return sum;
    return sum + (4 + (lighting.brightness / 100) * 54) * Math.max(0.2, roomBoost);
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

function vacuumWatts(vacuum?: SmartDevice) {
  if (!vacuum) return { watts: 2.2, on: false };
  if (vacuum.status === "docked" || vacuum.status === "standby") return { watts: 2.2, on: false };
  if (vacuum.status === "paused") return { watts: 6, on: false };
  if (vacuum.status === "returning") return { watts: 18, on: true };
  if (vacuum.status === "spot") return { watts: 34, on: true };

  if (!vacuum.power) return { watts: 2.2, on: false };
  if (vacuum.mode === "manual") return { watts: 42, on: true };
  if (vacuum.mode === "comfort") return { watts: 31, on: true };
  return { watts: 24, on: true };
}

export function buildSmartApartmentDeviceLoads(
  state: SmartApartmentSimulationState,
  now = new Date(),
): DeviceLoad[] {
  const {
    isWeekend,
    nightScore,
    eveningScore,
    middayScore,
    breakfastScore,
    lunchScore,
    dinnerScore,
  } = getTimeProfile(now);
  const climate = getDevice(state, "climate-hall");
  const humidifier = getDevice(state, "humidifier-living");
  const vacuum = getDevice(state, "vacuum-bedroom");
  const camera = getDevice(state, "camera-living");
  const doorbell = getDevice(state, "doorbell");
  const doorLock = getDevice(state, "door-lock");
  const energyMeter = getDevice(state, "energy-meter");

  const climateOn = Boolean(climate?.power);
  const targetTemp = Number(climate?.value ?? 24);
  const coolingDemand = 0.18 + nightScore * 0.42 + eveningScore * 0.34 + middayScore * 0.28;
  const acLiving = climateOn
    ? 270 + 980 * coolingDemand + Math.abs(24 - targetTemp) * 42
    : 9;
  const acBedroom = climateOn
    ? 120 + 840 * (nightScore * 0.78 + eveningScore * 0.28 + middayScore * 0.18)
    : 8;
  const fridge = 85 + Math.max(0, Math.sin(now.getMinutes() / 5.5)) * 24;
  const lighting = buildLightingWatts(state, now);
  const tv = 10 + (eveningScore + (isWeekend ? bell(now.getHours() + now.getMinutes() / 60, 14, 1.8) * 0.55 : 0)) * 125;
  const kitchenProfile = Math.max(breakfastScore * 0.82, lunchScore * 0.68, dinnerScore);
  const kitchen = 6 + kitchenProfile * 950;
  const laundryProfile = now.getDay() % 3 === 0 ? bell(now.getHours() + now.getMinutes() / 60, 8.6, 0.72) : 0;
  const laundry = laundryProfile > 0.18 ? 1200 * laundryProfile : 0;
  const activeOutlets = Object.values(state.outletStates).filter((outlet) => outlet.on).length;
  const outletWatts = activeOutlets > 0 ? activeOutlets * (70 + eveningScore * 35) + 4 : 1;
  const robotVacuumLoad = vacuumWatts(vacuum);

  const builtInLoads: DeviceLoad[] = [
    { id: "ac-bedroom", label: "AC Bedroom", room: "Bedroom", category: "climate", watts: acBedroom, on: climateOn },
    { id: "ac-living", label: "AC Living", room: "Living", category: "climate", watts: acLiving, on: climateOn },
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
      watts: robotVacuumLoad.watts,
      on: robotVacuumLoad.on,
    },
    { id: "outlets", label: "Smart outlets", room: "All", category: "appliance", watts: outletWatts, on: activeOutlets > 0 },
    { id: "camera", label: "Camera", room: "Living", category: "iot", watts: camera?.power ? 6 : 0.6, on: Boolean(camera?.power) },
    { id: "doorbell", label: "Door bell", room: "Entry", category: "iot", watts: doorbell?.power ? 3 : 0.8, on: Boolean(doorbell?.power) },
    { id: "door-lock", label: "Door lock", room: "Entry", category: "security", watts: doorLock?.power ? 2 : 0.7, on: Boolean(doorLock?.power) },
    { id: "energy-meter", label: "Energy meter", room: "Panel", category: "iot", watts: energyMeter?.power ? 1.8 : 0.4, on: Boolean(energyMeter?.power) },
  ];

  return [...builtInLoads, ...state.configuredDevices.map(buildConfiguredLoad)];
}
