import {
  Bot,
  Camera,
  Lightbulb,
  Lock,
  Unlock,
  MapPin,
  Maximize2,
  Minimize2,
  PlugZap,
  ShieldCheck,
  Thermometer,
  Video,
  Volume2,
  Wind,
} from "lucide-react";
import { useRef, useState } from "react";
import apartment from "@/assets/apartment-modern-base.webp";
import person from "@/assets/person.jpg";
import { IconButton } from "@/components/controls/IconButton";
import { mapLocation, outletPins, rooms } from "@/domain/smartHomeData";
import type {
  ConfiguredSmartDevice,
  OutletKey,
  OutletState,
  RoomKey,
  RoomLightingState,
} from "@/domain/smartHomeTypes";
import { DevicePin, RoomLampPin } from "./DevicePin";

export type ControlLayer = "climate" | "lighting" | "energy" | "camera" | "security";
type LayoutTarget = `room:${RoomKey}` | `outlet:${OutletKey}` | `configured:${string}` | "base:lock" | "base:climate";

type ApartmentCanvasProps = {
  activeRoomKey: RoomKey;
  avgBrightness: number;
  roomLighting: Record<RoomKey, RoomLightingState>;
  roomPositions: Record<RoomKey, { x: string; y: string }>;
  outletStates: Record<OutletKey, OutletState>;
  outletPositions: Record<OutletKey, { x: string; y: string }>;
  configuredDevices: ConfiguredSmartDevice[];
  climateOn: boolean;
  climatePosition: { x: string; y: string };
  lockPosition: { x: string; y: string };
  doorLocked: boolean;
  showCamera: boolean;
  selectedLayer: ControlLayer | null;
  isExpanded?: boolean;
  layoutEditMode?: boolean;
  onSelectRoom: (roomKey: RoomKey) => void;
  onToggleRoom: (roomKey: RoomKey, nextPower: boolean) => void;
  onToggleOutlet: (outletKey: OutletKey) => void;
  onToggleConfiguredDevice: (deviceId: string) => void;
  onToggleDoorLock: () => void;
  onSelectLayer: (layer: ControlLayer | null) => void;
  onToggleCamera: () => void;
  onToggleExpand: () => void;
  onUpdateRoomPosition: (roomKey: RoomKey, x: string, y: string) => void;
  onUpdateOutletPosition: (outletKey: OutletKey, x: string, y: string) => void;
  onUpdateConfiguredDevicePosition: (deviceId: string, x: string, y: string) => void;
  onUpdateBasePosition: (type: "lock" | "climate", x: string, y: string) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ApartmentCanvas({
  activeRoomKey,
  avgBrightness,
  roomLighting,
  roomPositions,
  outletStates,
  outletPositions,
  configuredDevices,
  climateOn,
  climatePosition,
  lockPosition,
  doorLocked,
  showCamera,
  selectedLayer,
  isExpanded = false,
  layoutEditMode = false,
  onSelectRoom,
  onToggleRoom,
  onToggleOutlet,
  onToggleConfiguredDevice,
  onToggleDoorLock,
  onSelectLayer,
  onToggleCamera,
  onToggleExpand,
  onUpdateRoomPosition,
  onUpdateOutletPosition,
  onUpdateConfiguredDevicePosition,
  onUpdateBasePosition,
}: ApartmentCanvasProps) {
  const [showLocation, setShowLocation] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<LayoutTarget | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<LayoutTarget | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);

  const activeLayer = selectedLayer ?? "lighting";
  const showLightingPins = activeLayer === "lighting";
  const showEnergyPins = activeLayer === "energy";
  const showClimatePin = activeLayer === "climate";
  const hasConfiguredClimate = configuredDevices.some((device) => device.layer === "climate");
  const imageBrightness = 0.72 + avgBrightness * 0.38;
  const imageSaturation = 0.86 + avgBrightness * 0.22;
  const overlayOpacity = Math.max(0.10, 0.42 - avgBrightness * 0.28);

  const roomLightOpacity = (roomKey: RoomKey) => {
    const lighting = roomLighting[roomKey];
    if (!lighting.on || lighting.brightness <= 0) return 0;
    return Math.min(0.50, 0.05 + Math.pow(lighting.brightness / 100, 1.45) * 0.38);
  };

  const getConfiguredIcon = (category: ConfiguredSmartDevice["category"]) => {
    if (category === "smart-outlet") return PlugZap;
    if (category === "ac-controller") return Thermometer;
    if (category === "robot-cleaner") return Bot;
    if (category === "door-lock") return ShieldCheck;
    if (category === "camera") return Camera;
    return Lightbulb;
  };

  const layerVisible = (layer: ConfiguredSmartDevice["layer"]) => {
    if (layer === "cleaning") return false;
    if (layer === "camera") return false;
    return activeLayer === layer;
  };

  const toggleLayer = (layer: ControlLayer) => {
    onSelectLayer(activeLayer === layer && selectedLayer !== null ? null : layer);
  };

  const beginDrag = (target: LayoutTarget, event: React.PointerEvent<HTMLButtonElement>) => {
    if (!layoutEditMode) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectedTarget(target);
    setDraggingTarget(target);
    // Capture on the canvas SECTION so pointermove/up land on the canvas handlers.
    try {
      canvasRef.current?.setPointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
  };

  const updateTargetPosition = (target: LayoutTarget, x: string, y: string) => {
    if (target.startsWith("room:")) {
      onUpdateRoomPosition(target.replace("room:", "") as RoomKey, x, y);
      return;
    }
    if (target.startsWith("outlet:")) {
      onUpdateOutletPosition(target.replace("outlet:", "") as OutletKey, x, y);
      return;
    }
    if (target.startsWith("configured:")) {
      onUpdateConfiguredDevicePosition(target.replace("configured:", ""), x, y);
      return;
    }
    if (target === "base:lock") {
      onUpdateBasePosition("lock", x, y);
      return;
    }
    onUpdateBasePosition("climate", x, y);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!layoutEditMode || !draggingTarget || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 6, 94);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 10, 90);
    updateTargetPosition(draggingTarget, `${x.toFixed(1)}%`, `${y.toFixed(1)}%`);
  };

  const stopDragging = () => {
    setDraggingTarget(null);
  };

  const handleCameraClick = () => {
    if (layoutEditMode) return;
    onToggleCamera();
  };

  const handleDeviceAction = (target: LayoutTarget, action: () => void) => {
    if (layoutEditMode) {
      setSelectedTarget(target);
      return;
    }
    action();
  };

  return (
    <section
      ref={canvasRef}
      className={`apartment-card ${isExpanded ? "is-expanded" : ""} ${layoutEditMode ? "is-layout-editing" : ""}`}
      aria-label="Live apartment canvas"
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerLeave={stopDragging}
    >
      <div className="apartment-card__scene">
        <div className="apartment-card__viewport">
          <img
            alt="3D apartment overview"
            className="apartment-card__image"
            src={apartment}
            style={{ filter: `brightness(${imageBrightness}) saturate(${imageSaturation})` }}
          />
          <div className="apartment-card__dim" style={{ opacity: overlayOpacity }} />

          {rooms.map((room) => (
            <div
              className={`apartment-card__warm-wash apartment-card__warm-wash--${room.key}`}
              key={room.key}
              style={{
                background: room.warmWash,
                opacity: roomLightOpacity(room.key),
              }}
            />
          ))}

          {showCamera ? (
            <div className="live-camera-card">
              <img alt="Live camera preview" src={person} />
              <span className="live-camera-card__badge">Live</span>
              <button aria-label="Camera audio" className="live-camera-card__audio" type="button">
                <Volume2 size={15} />
              </button>
            </div>
          ) : null}

          <DevicePin
            active={doorLocked}
            className={`door-lock-pin ${doorLocked ? "is-locked" : "is-unlocked"}`}
            dark={doorLocked}
            layoutSelected={selectedTarget === "base:lock"}
            icon={doorLocked ? Lock : Unlock}
            label={doorLocked ? "Main door lock locked" : "Main door lock unlocked"}
            x={lockPosition.x}
            y={lockPosition.y}
            onClick={() => handleDeviceAction("base:lock", onToggleDoorLock)}
            onPointerDown={(event) => beginDrag("base:lock", event)}
          />

          {showClimatePin && !hasConfiguredClimate ? (
            <DevicePin
              dark={climateOn}
              active={climateOn}
              layoutSelected={selectedTarget === "base:climate"}
              icon={Wind}
              label="Climate airflow"
              x={climatePosition.x}
              y={climatePosition.y}
              onClick={() => handleDeviceAction("base:climate", () => toggleLayer("climate"))}
              onPointerDown={(event) => beginDrag("base:climate", event)}
            />
          ) : null}

          {showEnergyPins
            ? outletPins.map((pin) => (
                <DevicePin
                  active={outletStates[pin.key].on}
                  dark={outletStates[pin.key].on}
                  layoutSelected={selectedTarget === `outlet:${pin.key}`}
                  icon={PlugZap}
                  key={pin.key}
                  label={`${pin.label} ${outletStates[pin.key].on ? "on" : "off"}`}
                  x={outletPositions[pin.key].x}
                  y={outletPositions[pin.key].y}
                  onClick={() => handleDeviceAction(`outlet:${pin.key}`, () => onToggleOutlet(pin.key))}
                  onPointerDown={(event) => beginDrag(`outlet:${pin.key}`, event)}
                />
              ))
            : null}

          {configuredDevices
            .filter((device) => layerVisible(device.layer))
            .map((device) => {
              const Icon = getConfiguredIcon(device.category);
              return (
                <DevicePin
                  active={device.power}
                  dark={device.power}
                  layoutSelected={selectedTarget === `configured:${device.id}`}
                  icon={Icon}
                  key={device.id}
                  label={`${device.name} ${device.power ? "on" : "off"}`}
                  x={device.x}
                  y={device.y}
                  onClick={() => handleDeviceAction(`configured:${device.id}`, () => onToggleConfiguredDevice(device.id))}
                  onPointerDown={(event) => beginDrag(`configured:${device.id}`, event)}
                />
              );
            })}

          {showLightingPins
            ? rooms.map((room) => (
                <RoomLampPin
                  active={room.key === activeRoomKey}
                  key={room.key}
                  lighting={roomLighting[room.key]}
                  layoutSelected={selectedTarget === `room:${room.key}`}
                  room={{ ...room, x: roomPositions[room.key].x, y: roomPositions[room.key].y }}
                  onSelect={onSelectRoom}
                  onToggle={onToggleRoom}
                  onPointerDown={(event) => beginDrag(`room:${room.key}`, event)}
                />
              ))
            : null}
        </div>
      </div>

      <div className="canvas-chip-row" aria-label="Canvas quick filters">
        <button
          aria-pressed={activeLayer === "climate"}
          className={`canvas-chip ${activeLayer === "climate" ? "is-active" : ""}`}
          type="button"
          onClick={() => toggleLayer("climate")}
        >
          <Wind size={16} /> Climate
        </button>
        <IconButton
          compact
          icon={Lightbulb}
          label="Lighting layer"
          active={activeLayer === "lighting"}
          onClick={() => toggleLayer("lighting")}
        />
        <IconButton
          compact
          icon={PlugZap}
          label="Smart outlet layer"
          active={activeLayer === "energy"}
          onClick={() => toggleLayer("energy")}
        />
        <IconButton
          compact
          icon={Video}
          label="Camera layer"
          active={showCamera}
          onClick={handleCameraClick}
        />
      </div>

      <div className="canvas-actions">
        <button
          aria-expanded={showLocation}
          aria-label="Show home location"
          className={`icon-button is-compact ${showLocation ? "is-active" : ""}`}
          type="button"
          onClick={() => setShowLocation((current) => !current)}
        >
          <MapPin size={18} />
        </button>
        <button
          aria-label={isExpanded ? "Exit full screen" : "Maximize apartment view"}
          className="icon-button is-compact"
          type="button"
          onClick={onToggleExpand}
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {showLocation ? (
        <div className="location-callout" role="status">
          <div className="location-callout__title">{mapLocation.city}, {mapLocation.country}</div>
          <div className="location-callout__detail">{mapLocation.detail}</div>
        </div>
      ) : null}

    </section>
  );
}
