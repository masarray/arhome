import type { LucideIcon } from "lucide-react";

export type RoomKey = "bedroom" | "living" | "kitchen" | "dining";
export type OutletKey = "living-tv" | "kitchen-counter" | "dining-wall" | "bedroom-desk";
export type DeviceType = "light" | "climate" | "lock" | "camera" | "vacuum" | "humidifier" | "doorbell" | "energy";
export type DeviceStatus =
  | "online"
  | "offline"
  | "active"
  | "standby"
  | "locked"
  | "muted"
  | "cleaning"
  | "paused"
  | "returning"
  | "docked"
  | "spot";
export type DeviceMode = "eco" | "comfort" | "away" | "night" | "manual" | "cool" | "dry" | "fan" | "auto";

export type Room = {
  key: RoomKey;
  label: string;
  shortLabel: string;
  x: string;
  y: string;
  warmWash: string;
};

export type MapCallout = {
  city: string;
  country: string;
  detail: string;
};

export type RoomLightingState = {
  on: boolean;
  brightness: number;
};

export type OutletState = {
  on: boolean;
};

export type SmartDevice = {
  id: string;
  name: string;
  room: string;
  type: DeviceType;
  status: DeviceStatus;
  power: boolean;
  value?: number;
  unit?: string;
  mode?: DeviceMode;
};

export type SidebarItem = {
  label: string;
  icon: LucideIcon;
};

export type SmartDeviceCategory =
  | "smart-bulb"
  | "smart-outlet"
  | "wall-switch"
  | "ac-controller"
  | "robot-cleaner"
  | "door-lock"
  | "camera"
  | "sensor";

export type IntegrationAdapter =
  | "Matter"
  | "Tuya"
  | "Home Assistant"
  | "MQTT"
  | "IR Hub"
  | "Simulator";

export type ConfiguredSmartDevice = {
  id: string;
  name: string;
  category: SmartDeviceCategory;
  roomKey: RoomKey;
  layer: ControlLayerKey;
  adapter: IntegrationAdapter;
  brand: string;
  model: string;
  x: string;
  y: string;
  power: boolean;
  capabilities: string[];
};

export type AutomationEventTone = "info" | "success" | "warning" | "danger";

export type AutomationEvent = {
  id: string;
  ts: number;
  message: string;
  detail?: string;
  tone: AutomationEventTone;
};

export type VacuumCommand = "start" | "pause" | "dock" | "spot" | "locate";

export type ControlLayerKey = "lighting" | "energy" | "climate" | "cleaning" | "security" | "camera";
