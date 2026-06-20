import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { ApartmentCanvas, type ControlLayer } from "@/components/canvas/ApartmentCanvas";
import { BottomStatusBar } from "@/components/panels/BottomStatusBar";
import { CleaningPanel } from "@/components/panels/CleaningPanel";
import { ClimatePanel } from "@/components/panels/ClimatePanel";
import { LightingPanel } from "@/components/panels/LightingPanel";
import { AddDeviceWizard } from "@/components/wizard/AddDeviceWizard";
import { useSmartHome } from "@/hooks/useSmartHome";
import { useEnergyStream } from "@/hooks/useEnergyStream";
import { energySim } from "@/services/energySimulator";

export function SmartHomePage() {
  const smartHome = useSmartHome();
  const [showCamera, setShowCamera] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<ControlLayer | null>("lighting");
  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Make sure the energy simulator has a device factory even before the
  // user opens the Energy page (so the bottom bar live load is real).
  useEffect(() => {
    energySim.setDeviceFactory(() => [
      { id: "ac-living", label: "AC Living", room: "Living", category: "climate",
        watts: smartHome.climateDevice?.power ? 950 : 28, on: true },
      { id: "lighting", label: "Lampu", room: "All", category: "lighting",
        watts: smartHome.avgBrightness * 220 + 12, on: true },
      { id: "fridge", label: "Kulkas", room: "Kitchen", category: "appliance",
        watts: 110, on: true },
      { id: "router", label: "Router & IoT", room: "Hall", category: "iot",
        watts: 22, on: true },
      { id: "humidifier", label: "Humidifier", room: "Living", category: "appliance",
        watts: smartHome.humidifierDevice?.power ? 38 : 1.5, on: true },
      { id: "vacuum", label: "Robot vacuum", room: "Bedroom", category: "appliance",
        watts: smartHome.vacuumDevice?.power ? 28 : 2.2, on: true },
      { id: "outlets", label: "Smart outlets", room: "All", category: "appliance",
        watts: Object.values(smartHome.outletStates).filter((o) => o.on).length * 90 + 4, on: true },
    ]);
    energySim.start();
  }, [smartHome]);

  const energy = useEnergyStream();
  const liveKW = energy.liveWatts / 1000;

  return (
    <section className="main-workspace">
      <header className="workspace-header">
        <div>
          <h1>Smart Home Automation</h1>
          <div className="ecosystem-row" aria-label="Smart home ecosystem direction">
            <span>Matter-ready</span>
            <span>Tuya compatible</span>
            <span>Local adapter</span>
            <span className="ecosystem-row__pill is-live">● Live</span>
          </div>
        </div>
        <div className="header-actions">
          <button
            className={`header-button ${layoutEditMode ? "header-button--dark" : "header-button--light"}`}
            type="button"
            onClick={() => setLayoutEditMode((current) => !current)}
          >
            {layoutEditMode ? <Check size={16} /> : <Pencil size={16} />}
            {layoutEditMode ? "Save layout" : "Edit layout"}
          </button>
          <button
            className="header-button header-button--dark"
            type="button"
            onClick={() => setWizardOpen(true)}
          >
            <Plus size={16} /> Add smart device <ChevronDown size={15} />
          </button>
        </div>
      </header>

      <div className="workspace-body">
        <ApartmentCanvas
          activeRoomKey={smartHome.activeRoom.key}
          avgBrightness={smartHome.avgBrightness}
          climateOn={Boolean(smartHome.climateDevice?.power)}
          climatePosition={smartHome.climatePosition}
          doorLocked={Boolean(smartHome.doorLockDevice?.power)}
          configuredDevices={smartHome.configuredDevices}
          isExpanded={false}
          layoutEditMode={layoutEditMode}
          lockPosition={smartHome.lockPosition}
          outletPositions={smartHome.outletPositions}
          outletStates={smartHome.outletStates}
          roomLighting={smartHome.roomLighting}
          roomPositions={smartHome.roomPositions}
          selectedLayer={selectedLayer}
          showCamera={showCamera}
          onSelectLayer={setSelectedLayer}
          onSelectRoom={smartHome.selectRoom}
          onToggleCamera={() => setShowCamera((c) => !c)}
          onToggleConfiguredDevice={smartHome.toggleConfiguredDevice}
          onToggleDoorLock={smartHome.toggleDoorLock}
          onToggleExpand={() => {}}
          onToggleOutlet={smartHome.toggleOutlet}
          onToggleRoom={smartHome.setRoomPower}
          onUpdateBasePosition={smartHome.updateBasePosition}
          onUpdateConfiguredDevicePosition={smartHome.updateConfiguredDevicePosition}
          onUpdateOutletPosition={smartHome.updateOutletPosition}
          onUpdateRoomPosition={smartHome.updateRoomPosition}
        />

        <aside className="right-rail" aria-label="Device control panels">
          <CleaningPanel device={smartHome.vacuumDevice} onPowerChange={smartHome.setDevicePower} />
          <LightingPanel
            activeLighting={smartHome.activeLighting}
            activeRoom={smartHome.activeRoom}
            onBrightnessChange={(brightness) =>
              smartHome.setActiveRoomLighting({ brightness, on: true })
            }
            onCycleRoom={smartHome.cycleRoom}
            onPowerChange={(checked) => smartHome.setActiveRoomLighting({ on: checked })}
            onSelectRoom={smartHome.selectRoom}
          />
          <ClimatePanel
            selected={selectedLayer === "climate"}
            device={smartHome.climateDevice}
            onModeChange={smartHome.setDeviceMode}
            onPowerChange={smartHome.setDevicePower}
            onTemperatureChange={smartHome.setDeviceValue}
          />
        </aside>
      </div>

      <BottomStatusBar
        doorLock={smartHome.doorLockDevice}
        doorbell={smartHome.doorbellDevice}
        energyLevel={liveKW}
        humidifier={smartHome.humidifierDevice}
        onPowerChange={smartHome.setDevicePower}
        onToggleLock={smartHome.toggleDoorLock}
      />

      <AddDeviceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={(device) => {
          smartHome.saveConfiguredDevice(device);
          setLayoutEditMode(true);
          setWizardOpen(false);
        }}
      />
    </section>
  );
}
