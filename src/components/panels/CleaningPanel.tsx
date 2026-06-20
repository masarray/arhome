import { Leaf, SlidersHorizontal } from "lucide-react";
import vacuum from "@/assets/robot-cleaner-xiaomi-transparent.webp";
import { PremiumSwitch } from "@/components/controls/PremiumSwitch";
import type { SmartDevice } from "@/domain/smartHomeTypes";

type CleaningPanelProps = {
  device?: SmartDevice;
  onPowerChange: (deviceId: string, power: boolean) => void;
};

export function CleaningPanel({ device, onPowerChange }: CleaningPanelProps) {
  if (!device) return null;

  const battery = Math.round(device.value ?? 64);

  return (
    <section className="panel panel--cleaning compact-panel">
      <div className="panel__header">
        <div>
          <h2>Robot Vacuum Cleaner</h2>
          <p>4 Devices</p>
        </div>
        <PremiumSwitch
          checked={device.power}
          label="Toggle cleaning robot"
          onChange={(checked) => onPowerChange(device.id, checked)}
        />
      </div>

      <div className="vacuum-card-visual">
        <img alt="Robot vacuum cleaner" src={vacuum} />
        <div className="vacuum-card-visual__battery">
          <strong>{battery}%</strong>
          <span>Battery Charge</span>
        </div>
      </div>

      <div className="vacuum-card-meta">
        <div>
          <strong>09:00 AM</strong>
          <span>Next Cleaning</span>
        </div>
        <div className="vacuum-card-meta__mode">
          <Leaf size={16} />
          <span>Eco Mode</span>
        </div>
        <button aria-label="Cleaning settings" className="vacuum-card-meta__settings" type="button">
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </section>
  );
}
