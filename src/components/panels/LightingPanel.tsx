import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Lightbulb } from "lucide-react";
import lamp from "@/assets/lamp.png";
import { PremiumSwitch } from "@/components/controls/PremiumSwitch";
import { rooms } from "@/domain/smartHomeData";
import type { Room, RoomKey, RoomLightingState } from "@/domain/smartHomeTypes";

const SCHEDULE_KEY = "mas.home.lightingSchedules.v1";

type LightingSchedule = {
  enabled: boolean;
  onTime: string;
  offTime: string;
};

type ScheduleMap = Record<RoomKey, LightingSchedule>;

type LightingPanelProps = {
  activeRoom: Room;
  activeLighting: RoomLightingState;
  roomLighting: Record<RoomKey, RoomLightingState>;
  onCycleRoom: (direction: number) => void;
  onPowerChange: (checked: boolean) => void;
  onBrightnessChange: (brightness: number) => void;
  onRoomPowerChange: (roomKey: RoomKey, checked: boolean) => void;
  onSelectRoom: (roomKey: Room["key"]) => void;
};

const defaultSchedule: ScheduleMap = {
  bedroom: { enabled: false, onTime: "18:30", offTime: "22:30" },
  living: { enabled: false, onTime: "17:45", offTime: "23:00" },
  kitchen: { enabled: false, onTime: "05:45", offTime: "08:00" },
  dining: { enabled: false, onTime: "18:00", offTime: "21:30" },
};

function parseTime(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Math.min(1439, Math.max(0, Number(hour) * 60 + Number(minute)));
}

function shouldLightBeOn(schedule: LightingSchedule, now = new Date()) {
  if (!schedule.enabled) return null;
  const on = parseTime(schedule.onTime);
  const off = parseTime(schedule.offTime);
  const current = now.getHours() * 60 + now.getMinutes();

  if (on === off) return false;
  if (on < off) return current >= on && current < off;
  return current >= on || current < off;
}

function loadSchedules(): ScheduleMap {
  if (typeof window === "undefined") return defaultSchedule;
  try {
    const raw = JSON.parse(window.localStorage.getItem(SCHEDULE_KEY) ?? "{}");
    return rooms.reduce((acc, room) => {
      const saved = raw?.[room.key];
      acc[room.key] = {
        ...defaultSchedule[room.key],
        ...(saved && typeof saved === "object" ? saved : {}),
      };
      return acc;
    }, {} as ScheduleMap);
  } catch {
    return defaultSchedule;
  }
}

function saveSchedules(schedules: ScheduleMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
}

export function LightingPanel({
  activeRoom,
  activeLighting,
  onBrightnessChange,
  onCycleRoom,
  onPowerChange,
  onRoomPowerChange,
  onSelectRoom,
  roomLighting,
}: LightingPanelProps) {
  const [schedules, setSchedules] = useState<ScheduleMap>(() => loadSchedules());
  const lastAppliedRef = useRef<Record<string, string>>({});
  const brightness = activeLighting.brightness;
  const lightingOn = activeLighting.on;
  const schedule = schedules[activeRoom.key] ?? defaultSchedule[activeRoom.key];
  const schedulePreview = useMemo(() => shouldLightBeOn(schedule), [schedule]);
  const scheduleStateLabel = schedule.enabled ? (schedulePreview ? "Auto active, next off" : "Auto active, next on") : "Manual lighting schedule";

  useEffect(() => saveSchedules(schedules), [schedules]);

  useEffect(() => {
    const applySchedules = () => {
      const now = new Date();
      const minuteKey = `${now.getHours()}:${now.getMinutes()}`;
      for (const room of rooms) {
        const roomSchedule = schedules[room.key] ?? defaultSchedule[room.key];
        const target = shouldLightBeOn(roomSchedule, now);
        if (target === null) continue;
        if (roomLighting[room.key]?.on === target) continue;

        const signature = `${room.key}-${target ? "on" : "off"}-${minuteKey}`;
        if (lastAppliedRef.current[room.key] === signature) continue;
        lastAppliedRef.current[room.key] = signature;
        onRoomPowerChange(room.key, target);
      }
    };

    applySchedules();
    const timer = window.setInterval(applySchedules, 30_000);
    return () => window.clearInterval(timer);
  }, [onRoomPowerChange, roomLighting, schedules]);

  const updateSchedule = (patch: Partial<LightingSchedule>) => {
    setSchedules((current) => ({
      ...current,
      [activeRoom.key]: {
        ...defaultSchedule[activeRoom.key],
        ...(current[activeRoom.key] ?? {}),
        ...patch,
      },
    }));
  };

  return (
    <section className="panel panel--lighting smart-device-card">
      <div className="panel__header smart-card-header">
        <div>
          <h2>Lighting</h2>
          <p>{activeRoom.label}</p>
        </div>
        <PremiumSwitch checked={lightingOn} label="Toggle room lighting" onChange={onPowerChange} />
      </div>

      <div className="lighting-card-body">
        <div className="lighting-main-area">
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
        </div>

        <aside className="lighting-scheduler" aria-label={`${activeRoom.label} lighting schedule`}>
          <div className="lighting-scheduler__topline lighting-scheduler__topline--icon-only">
            <button
              aria-label={scheduleStateLabel}
              aria-pressed={schedule.enabled}
              className={`lighting-scheduler__clock-toggle ${schedule.enabled ? "is-on" : ""}`}
              data-smart-tip={schedule.enabled ? "Auto schedule is ON" : "Enable auto ON/OFF"}
              type="button"
              onClick={() => updateSchedule({ enabled: !schedule.enabled })}
            >
              <Clock3 size={15} />
            </button>
          </div>

          <label className="lighting-time-field">
            <span>On</span>
            <input
              aria-label={`${activeRoom.label} lights on time`}
              type="time"
              value={schedule.onTime}
              onChange={(event) => updateSchedule({ onTime: event.target.value })}
            />
          </label>
          <label className="lighting-time-field">
            <span>Off</span>
            <input
              aria-label={`${activeRoom.label} lights off time`}
              type="time"
              value={schedule.offTime}
              onChange={(event) => updateSchedule({ offTime: event.target.value })}
            />
          </label>
        </aside>
      </div>
    </section>
  );
}
