import type { PointerEventHandler } from "react";
import { Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Room, RoomKey, RoomLightingState } from "@/domain/smartHomeTypes";

type DevicePinProps = {
  icon: LucideIcon;
  x: string;
  y: string;
  label: string;
  dark?: boolean;
  active?: boolean;
  layoutSelected?: boolean;
  className?: string;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
};

export function DevicePin({
  icon: Icon,
  x,
  y,
  label,
  dark = false,
  active = false,
  layoutSelected = false,
  className = "",
  onClick,
  onPointerDown,
}: DevicePinProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`device-pin ${dark ? "device-pin--dark" : ""} ${active ? "is-active" : ""} ${layoutSelected ? "is-layout-selected" : ""} ${className}`.trim()}
      style={{ left: x, top: y }}
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
    >
      <Icon size={19} strokeWidth={2.25} />
    </button>
  );
}

type RoomLampPinProps = {
  room: Room;
  lighting: RoomLightingState;
  active: boolean;
  layoutSelected?: boolean;
  onSelect: (roomKey: RoomKey) => void;
  onToggle: (roomKey: RoomKey, nextPower: boolean) => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
};

export function RoomLampPin({
  room,
  lighting,
  active,
  layoutSelected = false,
  onSelect,
  onToggle,
  onPointerDown,
}: RoomLampPinProps) {
  const handleClick = () => {
    if (active) {
      onToggle(room.key, !lighting.on);
      return;
    }
    onSelect(room.key);
  };

  return (
    <button
      aria-label={`${room.label} lighting ${lighting.on ? "on" : "off"}`}
      aria-pressed={active}
      className={`device-pin lamp-pin ${active ? "is-active" : ""} ${lighting.on ? "is-on" : ""} ${layoutSelected ? "is-layout-selected" : ""}`}
      style={{ left: room.x, top: room.y }}
      type="button"
      onClick={handleClick}
      onPointerDown={onPointerDown}
    >
      <Lightbulb size={19} strokeWidth={2.25} />
      {lighting.on ? <span className="lamp-pin__glow" /> : null}
    </button>
  );
}
