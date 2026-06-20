import { Bell, Droplets, Lock, ShieldCheck, Unlock, Zap } from "lucide-react";
import { PremiumSwitch } from "@/components/controls/PremiumSwitch";
import type { SmartDevice } from "@/domain/smartHomeTypes";

type BottomStatusBarProps = {
  humidifier?: SmartDevice;
  doorbell?: SmartDevice;
  doorLock?: SmartDevice;
  energyLevel: number;
  onPowerChange: (deviceId: string, power: boolean) => void;
  onToggleLock: () => void;
};

export function BottomStatusBar({
  humidifier,
  doorbell,
  doorLock,
  energyLevel,
  onPowerChange,
  onToggleLock,
}: BottomStatusBarProps) {
  const isLocked = Boolean(doorLock?.power);

  return (
    <section className="bottom-status" aria-label="Home status summary">
      <button className="bottom-status__item bottom-status__item--lock" type="button" onClick={onToggleLock}>
        <span className="bottom-status__icon">
          {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
        </span>
        <span><strong>Door locks</strong><small>{isLocked ? "Locked" : "Unlocked"}</small></span>
      </button>

      <article className="bottom-status__item bottom-status__item--center">
        <span className={`bottom-status__pulse ${isLocked ? "" : "is-warning"}`}>
          <ShieldCheck size={17} />
        </span>
        <span><strong>{isLocked ? "Guarded" : "Entry open"}</strong><small>{isLocked ? "All zones normal" : "Secure before leaving"}</small></span>
      </article>

      {humidifier ? (
        <article className="bottom-status__item bottom-status__item--switch">
          <Droplets size={18} />
          <span><strong>Humidifier</strong><small>{humidifier.power ? "Eco-mode" : "Standby"}</small></span>
          <PremiumSwitch checked={humidifier.power} label="Toggle humidifier" onChange={(checked) => onPowerChange(humidifier.id, checked)} />
        </article>
      ) : null}

      {doorbell ? (
        <article className="bottom-status__item bottom-status__item--switch">
          <Bell size={18} />
          <span><strong>Door bell</strong><small>{doorbell.power ? "Audible" : "Muted"}</small></span>
          <PremiumSwitch checked={doorbell.power} label="Toggle doorbell" onChange={(checked) => onPowerChange(doorbell.id, checked)} />
        </article>
      ) : null}

      <article className="bottom-status__item bottom-status__item--energy">
        <Zap size={18} />
        <span><strong>{energyLevel.toFixed(1)} kW</strong><small>Live load</small></span>
      </article>
    </section>
  );
}
