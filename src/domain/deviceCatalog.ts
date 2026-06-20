// Realistic smart-device catalog used by the Add Device wizard.
// Each entry mimics a real product with sensible power draw figures.
import type { ConfiguredSmartDevice, ControlLayerKey, IntegrationAdapter, SmartDeviceCategory } from "./smartHomeTypes";

export type Protocol = "tuya" | "matter" | "ble" | "wifi" | "zigbee";

export type CatalogProduct = {
  sku: string;
  brand: string;
  model: string;
  category: SmartDeviceCategory;
  layer: ControlLayerKey;
  protocols: Protocol[];
  adapter: IntegrationAdapter;
  ratedWatts: number; // peak/typical
  standbyWatts: number;
  capabilities: string[];
  description: string;
  accent: string; // hex tint for chip
};

export const PROTOCOLS: Record<Protocol, { label: string; tagline: string; tone: string }> = {
  tuya: { label: "Tuya Cloud", tagline: "Smart Life / Tuya Smart app", tone: "#ff6b35" },
  matter: { label: "Matter over Wi-Fi", tagline: "Vendor-agnostic standard (CSA)", tone: "#22c55e" },
  ble: { label: "Bluetooth LE", tagline: "Local pairing within 10 m", tone: "#3b82f6" },
  wifi: { label: "Wi-Fi Direct", tagline: "SoftAP provisioning", tone: "#a855f7" },
  zigbee: { label: "Zigbee 3.0", tagline: "via Aqara / SLZB-06 hub", tone: "#eab308" },
};

export const CATALOG: CatalogProduct[] = [
  {
    sku: "TUYA-WB3-RGBW",
    brand: "Tuya",
    model: "WB3 9W RGBW E27",
    category: "smart-bulb",
    layer: "lighting",
    protocols: ["tuya", "wifi"],
    adapter: "Tuya",
    ratedWatts: 9,
    standbyWatts: 0.4,
    capabilities: ["Power", "Brightness", "RGB color", "Color temperature", "Scene"],
    description: "Tuya certified RGBW bulb. 806 lm, 16M colors, scene & schedule.",
    accent: "#ff6b35",
  },
  {
    sku: "PHILIPS-HUE-A19",
    brand: "Philips Hue",
    model: "White & Color A19",
    category: "smart-bulb",
    layer: "lighting",
    protocols: ["zigbee", "matter"],
    adapter: "Matter",
    ratedWatts: 10.5,
    standbyWatts: 0.5,
    capabilities: ["Power", "Brightness", "Color", "CCT", "Sync Box"],
    description: "Hue gen-5 bulb with Matter bridge. 1100 lm, 50k color range.",
    accent: "#22c55e",
  },
  {
    sku: "YEELIGHT-1S",
    brand: "Yeelight",
    model: "Smart Bulb 1S Color",
    category: "smart-bulb",
    layer: "lighting",
    protocols: ["wifi", "matter"],
    adapter: "Matter",
    ratedWatts: 8.5,
    standbyWatts: 0.4,
    capabilities: ["Power", "Brightness", "RGB", "Music sync"],
    description: "Yeelight color bulb, 800 lm, music-rhythm mode.",
    accent: "#a855f7",
  },
  {
    sku: "TUYA-SP10-16A",
    brand: "Tuya",
    model: "SP10 16A Smart Plug",
    category: "smart-outlet",
    layer: "energy",
    protocols: ["tuya", "wifi"],
    adapter: "Tuya",
    ratedWatts: 3520,
    standbyWatts: 0.7,
    capabilities: ["Power", "Energy meter", "Schedule", "Overload protection"],
    description: "Tuya 16A plug, real-time wattage meter, EU / ID schuko.",
    accent: "#ff6b35",
  },
  {
    sku: "SONOFF-S31-LITE",
    brand: "Sonoff",
    model: "S31 Lite Plug",
    category: "smart-outlet",
    layer: "energy",
    protocols: ["wifi", "matter"],
    adapter: "Matter",
    ratedWatts: 1800,
    standbyWatts: 0.4,
    capabilities: ["Power", "Schedule", "Inching"],
    description: "Compact 15A plug, Matter-over-Wi-Fi.",
    accent: "#22c55e",
  },
  {
    sku: "AQARA-T1-IR",
    brand: "Aqara",
    model: "Smart IR Remote (Cube T1)",
    category: "ac-controller",
    layer: "climate",
    protocols: ["zigbee", "matter"],
    adapter: "Matter",
    ratedWatts: 1.5,
    standbyWatts: 0.4,
    capabilities: ["IR learn", "AC profile", "Temperature", "Schedule"],
    description: "Aqara universal IR blaster for AC, TV, audio.",
    accent: "#eab308",
  },
  {
    sku: "BROADLINK-RM4",
    brand: "Broadlink",
    model: "RM4 Pro IR/RF",
    category: "ac-controller",
    layer: "climate",
    protocols: ["wifi"],
    adapter: "Home Assistant",
    ratedWatts: 1,
    standbyWatts: 0.3,
    capabilities: ["IR", "RF 315/433", "AC mode", "Cloud + local"],
    description: "Broadlink IR + RF bridge, popular for AC retrofit.",
    accent: "#3b82f6",
  },
  {
    sku: "XIAOMI-G1",
    brand: "Xiaomi",
    model: "Robot Vacuum G1",
    category: "robot-cleaner",
    layer: "cleaning",
    protocols: ["wifi"],
    adapter: "Home Assistant",
    ratedWatts: 28,
    standbyWatts: 2.4,
    capabilities: ["Vacuum", "Mop", "Schedule", "Room clean"],
    description: "Xiaomi Mi G1, 2200 Pa, LDS-free navigation.",
    accent: "#ff6b35",
  },
  {
    sku: "AQARA-N100",
    brand: "Aqara",
    model: "Smart Door Lock N100",
    category: "door-lock",
    layer: "security",
    protocols: ["zigbee", "ble"],
    adapter: "Matter",
    ratedWatts: 2,
    standbyWatts: 0.2,
    capabilities: ["Fingerprint", "PIN", "BLE key", "Log"],
    description: "Aqara N100 fingerprint lock, Matter bridge ready.",
    accent: "#eab308",
  },
  {
    sku: "AQARA-MOTION-P1",
    brand: "Aqara",
    model: "Motion Sensor P1",
    category: "sensor",
    layer: "security",
    protocols: ["zigbee", "matter"],
    adapter: "Matter",
    ratedWatts: 0.1,
    standbyWatts: 0.05,
    capabilities: ["Motion", "Illuminance", "Battery"],
    description: "Aqara P1 PIR + LUX. 5 years CR2450.",
    accent: "#3b82f6",
  },
  {
    sku: "EWELINK-CURTAIN",
    brand: "eWeLink",
    model: "Curtain Motor Pro",
    category: "wall-switch",
    layer: "lighting",
    protocols: ["wifi", "matter"],
    adapter: "Matter",
    ratedWatts: 40,
    standbyWatts: 0.5,
    capabilities: ["Open", "Close", "Position", "Schedule"],
    description: "Track motor with Matter, 1.5 m/s, anti-pinch.",
    accent: "#22c55e",
  },
];

export const CATEGORY_LABEL: Record<SmartDeviceCategory, string> = {
  "smart-bulb": "Smart Bulb",
  "smart-outlet": "Smart Plug / Outlet",
  "wall-switch": "Switch / Curtain",
  "ac-controller": "AC Controller (IR)",
  "robot-cleaner": "Robot Vacuum",
  "door-lock": "Smart Lock",
  camera: "IP Camera",
  sensor: "Sensor",
};

// Pseudo-discovery: produce 1-2 fake found devices for a chosen product.
export function pseudoDiscover(product: CatalogProduct) {
  const mac = () =>
    Array.from({ length: 6 })
      .map(() =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0"),
      )
      .join(":")
      .toUpperCase();
  const rssi = () => -(35 + Math.floor(Math.random() * 50));
  const count = 1 + Math.floor(Math.random() * 2);
  return Array.from({ length: count }).map((_, i) => ({
    id: `${product.sku.toLowerCase()}-${i + 1}-${Date.now().toString(36)}`,
    label: `${product.brand} ${product.model.split(" ")[0]} #${1000 + Math.floor(Math.random() * 8999)}`,
    mac: mac(),
    rssi: rssi(),
  }));
}

// Convert a catalog product + discovered slot into a ConfiguredSmartDevice.
export function instantiateDevice(
  product: CatalogProduct,
  name: string,
  roomKey: ConfiguredSmartDevice["roomKey"],
  position: { x: string; y: string },
): ConfiguredSmartDevice {
  return {
    id: `cfg-${product.sku.toLowerCase()}-${Date.now().toString(36)}`,
    name,
    category: product.category,
    roomKey,
    layer: product.layer,
    adapter: product.adapter,
    brand: product.brand,
    model: product.model,
    x: position.x,
    y: position.y,
    power: true,
    capabilities: [...product.capabilities],
  };
}
