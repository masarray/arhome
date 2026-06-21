import { Activity, Boxes, Home, Play, Scan } from "lucide-react";
import type {
  MapCallout,
  OutletKey,
  Room,
  RoomKey,
  SidebarItem,
  SmartDevice,
  ConfiguredSmartDevice,
} from "./smartHomeTypes";

export const sidebarItems: SidebarItem[] = [
  { icon: Home, label: "Home" },
  { icon: Scan, label: "Live" },
  { icon: Boxes, label: "Devices" },
  { icon: Play, label: "Scenes" },
  { icon: Activity, label: "Logs" },
];

export const rooms: Room[] = [
  {
    key: "bedroom",
    label: "Bedroom",
    shortLabel: "Bed",
    x: "32%",
    y: "43%",
    warmWash:
      "radial-gradient(ellipse at 27% 42%, rgba(255, 205, 105, 0.88) 0%, rgba(255, 205, 105, 0.34) 20%, transparent 40%)",
  },
  {
    key: "living",
    label: "Living room",
    shortLabel: "Living",
    x: "53%",
    y: "61%",
    warmWash:
      "radial-gradient(ellipse at 58% 69%, rgba(255, 205, 105, 0.88) 0%, rgba(255, 205, 105, 0.30) 24%, transparent 48%)",
  },
  {
    key: "kitchen",
    label: "Kitchen",
    shortLabel: "Kitchen",
    x: "53%",
    y: "28%",
    warmWash:
      "radial-gradient(ellipse at 58% 34%, rgba(255, 205, 105, 0.80) 0%, rgba(255, 205, 105, 0.28) 18%, transparent 38%)",
  },
  {
    key: "dining",
    label: "Dining room",
    shortLabel: "Dining",
    x: "74%",
    y: "44%",
    warmWash:
      "radial-gradient(ellipse at 80% 55%, rgba(255, 205, 105, 0.78) 0%, rgba(255, 205, 105, 0.28) 18%, transparent 36%)",
  },
];

export const outletPins: Array<{ key: OutletKey; label: string; x: string; y: string }> = [
  { key: "living-tv", label: "Living room outlet", x: "46%", y: "63%" },
  { key: "kitchen-counter", label: "Kitchen counter outlet", x: "51.5%", y: "36%" },
  { key: "dining-wall", label: "Dining area outlet", x: "74%", y: "48%" },
  { key: "bedroom-desk", label: "Bedroom desk outlet", x: "30%", y: "38%" },
];

export const initialOutletStates: Record<OutletKey, { on: boolean }> = {
  "living-tv": { on: true },
  "kitchen-counter": { on: true },
  "dining-wall": { on: false },
  "bedroom-desk": { on: true },
};

export const initialRoomLighting: Record<RoomKey, { on: boolean; brightness: number }> = {
  bedroom: { on: true, brightness: 64 },
  living: { on: true, brightness: 82 },
  kitchen: { on: false, brightness: 38 },
  dining: { on: true, brightness: 56 },
};

export const initialDevices: SmartDevice[] = [
  {
    id: "vacuum-bedroom",
    name: "Cleaning robot",
    room: "Bedroom",
    type: "vacuum",
    status: "cleaning",
    power: true,
    value: 64,
    unit: "%",
    mode: "eco",
  },
  {
    id: "climate-hall",
    name: "Climate control",
    room: "Hall",
    type: "climate",
    status: "standby",
    power: false,
    value: 22,
    unit: "°C",
    mode: "cool",
  },
  {
    id: "humidifier-living",
    name: "Air humidifier",
    room: "Living room",
    type: "humidifier",
    status: "active",
    power: true,
    value: 48,
    unit: "%",
    mode: "eco",
  },
  {
    id: "door-lock",
    name: "Door locks",
    room: "Main entry",
    type: "lock",
    status: "locked",
    power: true,
  },
  {
    id: "doorbell",
    name: "Door bell",
    room: "Main entry",
    type: "doorbell",
    status: "muted",
    power: false,
  },
  {
    id: "camera-living",
    name: "Live camera",
    room: "Living room",
    type: "camera",
    status: "standby",
    power: false,
  },
  {
    id: "energy-meter",
    name: "Energy guard",
    room: "Panel",
    type: "energy",
    status: "online",
    power: true,
    value: 3.2,
    unit: "kW",
    mode: "away",
  },
];

export const mapLocation: MapCallout = {
  city: "Bogor",
  country: "Indonesia",
  detail: "Mas Ari smart home · synchronized location pin",
};

export const integrationAdapters = [
  "Matter",
  "Tuya",
  "Home Assistant",
  "MQTT",
  "IR Hub",
  "Simulator",
] as const;

export const deviceCategoryCatalog = [
  {
    category: "smart-bulb",
    label: "Smart bulb",
    layer: "lighting",
    capabilities: ["Power", "Brightness", "Color temperature", "Scene"],
    adapters: ["Matter", "Tuya", "Home Assistant", "MQTT", "Simulator"],
  },
  {
    category: "smart-outlet",
    label: "Smart outlet",
    layer: "energy",
    capabilities: ["Power", "Energy meter", "Auto off", "Load limit"],
    adapters: ["Matter", "Tuya", "Home Assistant", "MQTT", "Simulator"],
  },
  {
    category: "ac-controller",
    label: "AC controller",
    layer: "climate",
    capabilities: ["Power", "Temperature", "Mode", "Fan", "Swing"],
    adapters: ["Matter", "Tuya", "Home Assistant", "IR Hub", "Simulator"],
  },
  {
    category: "robot-cleaner",
    label: "Robot cleaner",
    layer: "cleaning",
    capabilities: ["Start", "Pause", "Dock", "Schedule", "Room clean"],
    adapters: ["Home Assistant", "Tuya", "MQTT", "Simulator"],
  },
  {
    category: "door-lock",
    label: "Door lock",
    layer: "security",
    capabilities: ["Lock", "Unlock", "Battery", "Access log"],
    adapters: ["Matter", "Tuya", "Home Assistant", "MQTT", "Simulator"],
  },
] as const;

export const initialConfiguredDevices: ConfiguredSmartDevice[] = [];
