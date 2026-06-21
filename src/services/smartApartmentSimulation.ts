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
  "energy-meter": 1.8,
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
  "energy-meter": "iot",
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
  const nightScore = Math.max(bell(hourFloat, 0.3, 3.1), bell(hourFloat, 22.9, 2.1));
  const eveningScore = bell(hourFloat, 20.1, 2.5);
  const middayScore = bell(hourFloat, 13.2, isWeekend ? 2.2 : 1.0);
  const breakfastScore = bell(hourFloat, 6.7, 0.55);
  const lunchScore = bell(hourFloat, 12.2, isWeekend ? 0.75 : 0.42);
  const dinnerScore = bell(hourFloat, 19.0, 0.72);
  const daylightScore = bell(hourFloat, 13, 4.8);
  const awayScore = isWeekend ? 0.25 : bell(hourFloat, 12.5, 3.4);

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
    awayScore,
  };
}

function buildLightingWatts(state: SmartApartmentSimulationState, now: Date) {
  const { daylightScore, eveningScore, nightScore, awayScore, isWeekend } = getTimeProfile(now);
  const occupancyFactor = isWeekend ? 0.92 : 1 - awayScore * 0.55;
  const roomBoost = Math.max(0.14, (0.34 + eveningScore * 0.92 + nightScore * 0.52 - daylightScore * 0.24) * occupancyFactor);

  return rooms.reduce((sum, room) => {
    const lighting = state.roomLighting[room.key];
    if (!lighting.on) return sum;
    const roomWatt = 4 + (lighting.brightness / 100) * 54;
    return sum + roomWatt * roomBoost;
  }, 0);
}

function configuredAttachedLoad(device: ConfiguredSmartDevice) {
  if (device.category === "energy-meter") return device.power ? 1.8 : 0.4;
  if (device.category === "sensor") return device.power ? 0.45 : 0.08;
  if (device.category === "door-lock") return device.power ? 1.2 : 0.25;
  if (device.category === "camera") return device.power ? 6 : 0.8;
  return device.power ? CONFIGURED_DEVICE_WATTS[device.category] : 1.2;
}

function buildConfiguredLoad(device: ConfiguredSmartDevice): DeviceLoad {
  const watts = configuredAttachedLoad(device);

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
  if (vacuum.status === "docked" || vacuum.status === "standby") return { watts: 4.8, on: false };
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
    awayScore,
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
  const targetAggressiveness = Math.max(0, 25 - targetTemp) * 0.055 + Math.max(0, targetTemp - 26) * -0.025;
  const coolingDemand = Math.max(
    0.08,
    0.16 + nightScore * 0.45 + eveningScore * 0.32 + middayScore * (isWeekend ? 0.42 : 0.18) + targetAggressiveness,
  );
  const homeOccupiedFactor = isWeekend ? 1 : 1 - awayScore * 0.62;
  const acLiving = climateOn
    ? 180 + 910 * coolingDemand * Math.max(0.38, homeOccupiedFactor) + Math.abs(24 - targetTemp) * 34
    : 8;
  const acBedroom = climateOn
    ? 110 + 780 * (nightScore * 0.82 + eveningScore * 0.22 + middayScore * (isWeekend ? 0.24 : 0.08))
    : 7;
  const fridge = 84 + Math.max(0, Math.sin(now.getMinutes() / 5.5)) * 26;
  const lighting = buildLightingWatts(state, now);
  const tv = 8 + (eveningScore + (isWeekend ? bell(now.getHours() + now.getMinutes() / 60, 14.4, 2.1) * 0.62 : 0)) * 118;
  const kitchenProfile = Math.max(breakfastScore * 0.74, lunchScore * (isWeekend ? 0.78 : 0.42), dinnerScore);
  const kitchen = 5 + kitchenProfile * (isWeekend ? 1020 : 820);
  const laundryProfile = (isWeekend || now.getDay() % 3 === 0) ? bell(now.getHours() + now.getMinutes() / 60, isWeekend ? 10.4 : 8.6, 0.82) : 0;
  const laundry = laundryProfile > 0.18 ? 1180 * laundryProfile : 0;
  const activeOutlets = Object.values(state.outletStates).filter((outlet) => outlet.on).length;
  const outletWatts = activeOutlets > 0 ? activeOutlets * (54 + eveningScore * 45 + (isWeekend ? middayScore * 26 : 0)) + 4 : 1;
  const robotVacuumLoad = vacuumWatts(vacuum);

  const builtInLoads: DeviceLoad[] = [
    { id: "ac-bedroom", label: "AC Bedroom", room: "Bedroom", category: "climate", watts: acBedroom, on: climateOn },
    { id: "ac-living", label: "AC Living", room: "Living", category: "climate", watts: acLiving, on: climateOn },
    { id: "fridge", label: "Kulkas", room: "Kitchen", category: "appliance", watts: fridge, on: true },
    { id: "lighting", label: "Lampu apartemen", room: "All", category: "lighting", watts: lighting, on: lighting > 2 },
    { id: "tv-living", label: "TV & Hiburan", room: "Living", category: "appliance", watts: tv, on: tv > 20 },
    { id: "kitchen", label: "Dapur", room: "Kitchen", category: "appliance", watts: kitchen, on: kitchen > 10 },
    { id: "wm-dryer", label: "Mesin Cuci & Dryer", room: "Utility", category: "appliance", watts: laundry, on: laundry > 0 },
    { id: "router-iot", label: "Router & IoT", room: "Hall", category: "iot", watts: 21, on: true },
    {
      id: "humidifier",
      label: "Humidifier",
      room: "Living",
      category: "appliance",
      watts: humidifier?.power ? 34 : 1.2,
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
    { id: "door-lock", label: "Door lock", room: "Entry", category: "security", watts: doorLock?.power ? 1.6 : 0.5, on: Boolean(doorLock?.power) },
    { id: "energy-meter", label: "Smart energy meter", room: "Panel", category: "iot", watts: energyMeter?.power ? 1.8 : 0.4, on: Boolean(energyMeter?.power) },
  ];

  return [...builtInLoads, ...state.configuredDevices.map(buildConfiguredLoad)];
}
