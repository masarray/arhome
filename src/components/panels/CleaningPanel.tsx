import { BatteryMedium, Home, MapPin, Pause, Play, Radar, Sparkles } from "lucide-react";
import vacuum from "@/assets/robot-cleaner-xiaomi-transparent.webp";
import type { DeviceMode, SmartDevice, VacuumCommand } from "@/domain/smartHomeTypes";

type CleaningPanelProps = {
  device?: SmartDevice;
  onCommand: (deviceId: string, command: VacuumCommand) => void;
  onModeChange: (deviceId: string, mode: DeviceMode) => void;
};

const modeOptions: Array<{ mode: DeviceMode; label: string }> = [
  { mode: "eco", label: "Quiet" },
  { mode: "comfort", label: "Daily" },
  { mode: "manual", label: "Turbo" },
];

const statusLabel: Record<string, string> = {
  active: "Cleaning",
  cleaning: "Cleaning",
  spot: "Spot clean",
  paused: "Paused",
  returning: "Returning",
  docked: "Docked",
  standby: "Docked",
};

export function CleaningPanel({ device, onCommand, onModeChange }: CleaningPanelProps) {
  if (!device) return null;

  const battery = Math.round(device.value ?? 64);
  const currentMode = (device.mode ?? "eco") as DeviceMode;
  const cleaning = device.power && (device.status === "cleaning" || device.status === "active" || device.status === "spot");
  const status = statusLabel[device.status] ?? (device.power ? "Cleaning" : "Docked");
  const primaryCommand: VacuumCommand = cleaning ? "pause" : "start";

  return (
    <section className="panel panel--cleaning compact-panel">
      <div className="panel__header">
        <div>
          <h2>Robot Vacuum</h2>
          <p>{status} · {device.room}</p>
        </div>
        <span className={`vacuum-status-pill ${cleaning ? "is-cleaning" : ""}`}>{status}</span>
      </div>

      <div className="vacuum-card-visual">
        <img alt="Robot vacuum cleaner" src={vacuum} />
        <div className="vacuum-card-visual__battery">
          <BatteryMedium size={14} />
          <strong>{battery}%</strong>
          <span>Battery</span>
        </div>
      </div>

      <div className="vacuum-action-row" aria-label="Robot vacuum controls">
        <button
          className="vacuum-action-button vacuum-action-button--primary"
          type="button"
          onClick={() => onCommand(device.id, primaryCommand)}
        >
          {cleaning ? <Pause size={15} /> : <Play size={15} />}
          {cleaning ? "Pause" : "Start"}
        </button>
        <button className="vacuum-action-button" type="button" onClick={() => onCommand(device.id, "dock")}>
          <Home size={15} /> Dock
        </button>
        <button className="vacuum-action-button" type="button" onClick={() => onCommand(device.id, "spot")}>
          <MapPin size={15} /> Spot
        </button>
        <button className="vacuum-action-button vacuum-action-button--icon" type="button" aria-label="Locate robot" onClick={() => onCommand(device.id, "locate")}>
          <Radar size={15} />
        </button>
      </div>

      <div className="vacuum-mode-row" aria-label="Robot suction mode">
        <Sparkles size={14} />
        {modeOptions.map((option) => (
          <button
            aria-pressed={currentMode === option.mode}
            className={`vacuum-mode-chip ${currentMode === option.mode ? "is-active" : ""}`}
            key={option.mode}
            type="button"
            onClick={() => onModeChange(device.id, option.mode)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
