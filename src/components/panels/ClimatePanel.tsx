import { Snowflake, Droplets, Wind, Waves } from "lucide-react";
import { CircularGauge } from "@/components/controls/CircularGauge";
import { PremiumSwitch } from "@/components/controls/PremiumSwitch";
import type { DeviceMode, SmartDevice } from "@/domain/smartHomeTypes";

type ClimatePanelProps = {
  device?: SmartDevice;
  selected?: boolean;
  onPowerChange: (deviceId: string, power: boolean) => void;
  onTemperatureChange: (deviceId: string, temperature: number) => void;
  onModeChange: (deviceId: string, mode: DeviceMode) => void;
};

const climateModes: Array<{ key: DeviceMode; label: string; tip: string; icon: typeof Snowflake }> = [
  { key: "cool", label: "Cool", tip: "Cool mode lowers room temperature", icon: Snowflake },
  { key: "dry", label: "Dry", tip: "Dry mode reduces humidity", icon: Droplets },
  { key: "fan", label: "Fan", tip: "Fan mode circulates air only", icon: Wind },
  { key: "auto", label: "Auto", tip: "Auto mode balances cooling and fan speed", icon: Waves },
];

export function ClimatePanel({
  device,
  selected = false,
  onPowerChange,
  onTemperatureChange,
  onModeChange,
}: ClimatePanelProps) {
  if (!device) return null;

  const min = 16;
  const max = 32;
  const temperature = Math.min(max, Math.max(min, Number(device.value ?? 24)));
  const currentMode = (device.mode ?? "cool") as DeviceMode;

  return (
    <section className={`panel panel--climate compact-panel smart-device-card ${selected ? "is-selected" : ""}`}>
      <div className="panel__header smart-card-header">
        <div>
          <h2>Climate Control</h2>
          <p>{device.room} · 9.000 BTU inverter</p>
        </div>
        <PremiumSwitch
          checked={device.power}
          label="Toggle climate control"
          onChange={(checked) => onPowerChange(device.id, checked)}
        />
      </div>

      <div className="climate-gauge-wrap">
        <CircularGauge
          value={temperature}
          min={min}
          max={max}
          step={0.5}
          label="Set temperature"
          unit="°C"
          mode={currentMode}
          on={device.power}
          onChange={(next) => onTemperatureChange(device.id, next)}
        />
      </div>

      <div
        className="climate-mode-row smart-segment-row"
        aria-label="Climate modes"
        onPointerDown={(event) => event.stopPropagation()}
      >
        {climateModes.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              aria-label={`${mode.label} AC mode`}
              aria-pressed={currentMode === mode.key}
              className={`climate-mode-chip ${currentMode === mode.key ? "is-active" : ""}`}
              data-smart-tip={mode.tip}
              key={mode.key}
              type="button"
              onClick={() => onModeChange(device.id, mode.key)}
            >
              <span className="climate-mode-chip__icon">
                <Icon size={16} />
              </span>
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
