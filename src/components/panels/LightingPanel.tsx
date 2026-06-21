import { ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import lamp from "@/assets/lamp.png";
import { PremiumSwitch } from "@/components/controls/PremiumSwitch";
import { rooms } from "@/domain/smartHomeData";
import type { Room, RoomLightingState } from "@/domain/smartHomeTypes";

type LightingPanelProps = {
  activeRoom: Room;
  activeLighting: RoomLightingState;
  onCycleRoom: (direction: number) => void;
  onPowerChange: (checked: boolean) => void;
  onBrightnessChange: (brightness: number) => void;
  onSelectRoom: (roomKey: Room["key"]) => void;
};

export function LightingPanel({
  activeRoom,
  activeLighting,
  onBrightnessChange,
  onCycleRoom,
  onPowerChange,
  onSelectRoom,
}: LightingPanelProps) {
  const brightness = activeLighting.brightness;
  const lightingOn = activeLighting.on;

  return (
    <section className="panel panel--lighting smart-device-card">
      <div className="panel__header smart-card-header">
        <div>
          <h2>Lighting</h2>
          <p>{activeRoom.label}</p>
        </div>
        <PremiumSwitch checked={lightingOn} label="Toggle room lighting" onChange={onPowerChange} />
      </div>

      <div className="lighting-visual">
        <button
          aria-label="Previous room"
          className="plain-icon smart-nav-icon"
          data-smart-tip="Previous room"
          type="button"
          onClick={() => onCycleRoom(-1)}
        >
          <ChevronLeft size={21} />
        </button>
        <div className="lamp-stage">
          <div
            className="lamp-stage__glow"
            style={{ opacity: lightingOn ? 0.24 + brightness / 100 : 0, transform: `scale(${lightingOn ? 1 + brightness / 210 : 0.6})` }}
          />
          <img
            alt="Pendant lamp"
            src={lamp}
            style={{
              filter: lightingOn
                ? `brightness(${0.88 + brightness / 180}) saturate(${0.92 + brightness / 170}) drop-shadow(0 18px ${8 + brightness / 4}px rgba(247, 183, 70, ${0.18 + brightness / 240}))`
                : "grayscale(1) brightness(0.58)",
            }}
          />
        </div>
        <button
          aria-label="Next room"
          className="plain-icon smart-nav-icon"
          data-smart-tip="Next room"
          type="button"
          onClick={() => onCycleRoom(1)}
        >
          <ChevronRight size={21} />
        </button>
      </div>

      <div className="room-dots" aria-label="Room selector">
        {rooms.map((room) => (
          <button
            aria-label={`Select ${room.label}`}
            className={room.key === activeRoom.key ? "is-active" : ""}
            data-smart-tip={room.label}
            key={room.key}
            type="button"
            onClick={() => onSelectRoom(room.key)}
          />
        ))}
      </div>

      <div className="range-shell">
        <div className="range-shell__fill" style={{ width: `${Math.max(lightingOn ? brightness : 0, 12)}%` }}>
          <Lightbulb size={15} />
        </div>
        <span className="range-shell__value">{brightness}%</span>
        <input
          aria-label="Lighting brightness"
          max={100}
          min={0}
          type="range"
          value={brightness}
          onChange={(event) => onBrightnessChange(Number(event.target.value))}
        />
      </div>
    </section>
  );
}
