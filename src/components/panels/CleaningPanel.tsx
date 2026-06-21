import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BatteryCharging, Home, MapPin, Pause, Play, Radar, Sparkles } from "lucide-react";
import vacuum from "@/assets/robot-cleaner-xiaomi-transparent.webp";
import type { DeviceMode, SmartDevice, VacuumCommand } from "@/domain/smartHomeTypes";

type CleaningPanelProps = {
  device?: SmartDevice;
  onCommand: (deviceId: string, command: VacuumCommand) => void;
  onModeChange: (deviceId: string, mode: DeviceMode) => void;
};

type TipButtonProps = {
  className?: string;
  label: string;
  tip: string;
  onClick: () => void;
  children: ReactNode;
};

const modeOptions: Array<{ mode: DeviceMode; label: string; tip: string }> = [
  { mode: "eco", label: "Quiet", tip: "Quiet suction for night cleaning" },
  { mode: "comfort", label: "Daily", tip: "Balanced daily cleaning mode" },
  { mode: "manual", label: "Turbo", tip: "High suction for dusty areas" },
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function TipButton({ className = "", label, tip, onClick, children }: TipButtonProps) {
  return (
    <button
      aria-label={label}
      className={`smart-control-button ${className}`}
      data-smart-tip={tip}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function batteryDeltaPerMinute(status: string, mode: DeviceMode) {
  if (status === "docked" || status === "standby") return 0.34;
  if (status === "returning") return -0.08;
  if (status === "paused") return -0.015;
  if (status === "spot") return -0.24;
  if (status === "cleaning" || status === "active") {
    if (mode === "manual") return -0.23;
    if (mode === "comfort") return -0.16;
    return -0.11;
  }
  return -0.02;
}

function batteryStateLabel(status: string) {
  if (status === "docked" || status === "standby") return "Charging";
  if (status === "returning") return "Returning";
  if (status === "paused") return "Paused";
  if (status === "spot") return "Spot clean";
  return "Live battery";
}

function VacuumBattery({ level, charging }: { level: number; charging: boolean }) {
  const tone = level < 25 ? "is-low" : level > 78 ? "is-high" : "";
  const style = { "--battery-level": `${level}%` } as CSSProperties;

  return (
    <span className={`phone-battery-pill ${tone} ${charging ? "is-charging" : ""}`} aria-label={`Battery ${level}%`}>
      <span className="phone-battery" aria-hidden style={style}>
        <span className="phone-battery__fill" />
      </span>
      <strong>{level}%</strong>
      {charging ? <BatteryCharging size={12} aria-hidden /> : null}
    </span>
  );
}

export function CleaningPanel({ device, onCommand, onModeChange }: CleaningPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const batterySession = useRef({ signature: "", startedAt: Date.now(), base: 64 });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1600);
    return () => window.clearInterval(timer);
  }, []);

  if (!device) return null;

  const currentMode = (device.mode ?? "eco") as DeviceMode;
  const cleaning = device.power && (device.status === "cleaning" || device.status === "active" || device.status === "spot");
  const status = statusLabel[device.status] ?? (device.power ? "Cleaning" : "Docked");
  const primaryCommand: VacuumCommand = cleaning ? "pause" : "start";
  const batteryBase = clamp(Number(device.value ?? 64), 8, 100);
  const signature = `${device.status}-${currentMode}-${Math.round(batteryBase)}`;

  if (batterySession.current.signature !== signature) {
    batterySession.current = { signature, startedAt: now, base: batteryBase };
  }

  const elapsedMinutes = Math.max(0, (now - batterySession.current.startedAt) / 60000);
  const microPulse = Math.sin(now / 4200) * 0.35;
  const liveBattery = clamp(
    batterySession.current.base + batteryDeltaPerMinute(device.status, currentMode) * elapsedMinutes + microPulse,
    5,
    100,
  );
  const battery = Math.round(liveBattery);
  const charging = device.status === "docked" || device.status === "standby";
  const nextRun = cleaning
    ? "Room scan active"
    : device.status === "returning"
      ? "Docking path locked"
      : "09:00 AM · Next cleaning";

  return (
    <section className="panel panel--cleaning compact-panel smart-device-card">
      <div className="panel__header smart-card-header vacuum-header">
        <div className="vacuum-title">
          <h2>Robot Vacuum</h2>
          <p>{status} · {device.room}</p>
        </div>
        <VacuumBattery level={battery} charging={charging} />
      </div>

      <div className="vacuum-compact-body vacuum-compact-body--actions-right">
        <div className="vacuum-robot-stage">
          <img alt="" aria-hidden src={vacuum} />
          <span className="vacuum-substatus vacuum-substatus--stage">
            {batteryStateLabel(device.status)} · {nextRun}
          </span>
        </div>

        <div className="vacuum-command-stack" aria-label="Robot vacuum controls">
          <TipButton
            className="smart-control-button--primary vacuum-primary-action"
            label={cleaning ? "Pause cleaning" : "Start cleaning"}
            tip={cleaning ? "Pause the current cleaning run" : "Start or resume room cleaning"}
            onClick={() => onCommand(device.id, primaryCommand)}
          >
            {cleaning ? <Pause size={14} /> : <Play size={14} />}
            <span>{cleaning ? "Pause" : "Start"}</span>
          </TipButton>

          <div className="vacuum-icon-actions" aria-label="Robot quick actions">
            <TipButton label="Return robot to dock" tip="Send robot to the charging dock" onClick={() => onCommand(device.id, "dock")}>
              <Home size={14} />
            </TipButton>
            <TipButton label="Spot clean" tip="Clean a small focused area" onClick={() => onCommand(device.id, "spot")}>
              <MapPin size={14} />
            </TipButton>
            <TipButton label="Locate robot" tip="Play a ping sound to find the robot" onClick={() => onCommand(device.id, "locate")}>
              <Radar size={14} />
            </TipButton>
          </div>

          <div className="vacuum-mode-row smart-segment-row" aria-label="Robot suction mode">
            <Sparkles size={13} aria-hidden />
            <div className="vacuum-mode-grid">
              {modeOptions.map((option) => (
                <button
                  aria-label={`${option.label} suction mode`}
                  aria-pressed={currentMode === option.mode}
                  className={`vacuum-mode-chip ${currentMode === option.mode ? "is-active" : ""}`}
                  data-smart-tip={option.tip}
                  key={option.mode}
                  type="button"
                  onClick={() => onModeChange(device.id, option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
