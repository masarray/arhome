import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Bluetooth, Check, ChevronRight, MapPin, Radio, Search, Wifi, X, Zap } from "lucide-react";
import apartment from "@/assets/apartment-3d.jpg";
import {
  CATALOG,
  CATEGORY_LABEL,
  PROTOCOLS,
  instantiateDevice,
  pseudoDiscover,
  type CatalogProduct,
  type Protocol,
} from "@/domain/deviceCatalog";
import { rooms } from "@/domain/smartHomeData";
import type { ConfiguredSmartDevice, RoomKey, SmartDeviceCategory } from "@/domain/smartHomeTypes";

type WizardStep = "category" | "protocol" | "discovery" | "place";

type AddDeviceWizardProps = {
  open: boolean;
  onClose: () => void;
  onComplete: (device: ConfiguredSmartDevice) => void;
};

const PROTOCOL_ICON: Record<Protocol, typeof Wifi> = {
  tuya: Zap,
  matter: Check,
  ble: Bluetooth,
  wifi: Wifi,
  zigbee: Radio,
};

type Position = { x: string; y: string };
type DiscoveredDevice = ReturnType<typeof pseudoDiscover>[number];

function roomDefaultPosition(roomKey: RoomKey): Position {
  const room = rooms.find((r) => r.key === roomKey);
  return { x: room?.x ?? "52%", y: room?.y ?? "55%" };
}

function formatPosition(value: number) {
  return `${Math.min(94, Math.max(6, value)).toFixed(1)}%`;
}

export function AddDeviceWizard({ open, onClose, onComplete }: AddDeviceWizardProps) {
  const [step, setStep] = useState<WizardStep>("category");
  const [category, setCategory] = useState<SmartDeviceCategory>("smart-bulb");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [selectedFound, setSelectedFound] = useState<DiscoveredDevice | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [pairPhase, setPairPhase] = useState(0);
  const [room, setRoom] = useState<RoomKey>("living");
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>(() => roomDefaultPosition("living"));

  // Reset when reopened
  useEffect(() => {
    if (!open) return;
    setStep("category");
    setProduct(null);
    setProtocol(null);
    setDiscovered([]);
    setSelectedFound(null);
    setScanProgress(0);
    setPairPhase(0);
    setRoom("living");
    setPosition(roomDefaultPosition("living"));
    setName("");
  }, [open]);

  const productsByCategory = useMemo(
    () => CATALOG.filter((p) => p.category === category),
    [category],
  );

  // Discovery animation
  useEffect(() => {
    if (step !== "discovery" || !product) return;
    setDiscovered([]);
    setScanProgress(0);
    setSelectedFound(null);
    let raf = 0;
    const start = performance.now();
    const dur = 1800;
    const found = pseudoDiscover(product);
    const loop = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setScanProgress(t);
      if (t < 1) raf = requestAnimationFrame(loop);
      else {
        setDiscovered(found);
        setSelectedFound(found[0] ?? null);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step, product]);

  // Pair animation (4 phases)
  useEffect(() => {
    if (step !== "place" || !selectedFound) return;
    setPairPhase(0);
    let cancelled = false;
    const run = async () => {
      for (let p = 1; p <= 4; p += 1) {
        await new Promise((r) => setTimeout(r, 420));
        if (cancelled) return;
        setPairPhase(p);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [step, selectedFound]);

  if (!open) return null;

  const goCategory = () => setStep("category");
  const chooseProduct = (p: CatalogProduct) => {
    setProduct(p);
    setName(`${p.brand} ${p.model.split(" ")[0]}`);
    setProtocol(p.protocols[0]);
    setStep("protocol");
  };
  const startDiscovery = () => setStep("discovery");
  const goPair = () => setStep("place");

  const chooseRoom = (nextRoom: RoomKey) => {
    setRoom(nextRoom);
    setPosition(roomDefaultPosition(nextRoom));
  };

  const handlePlacementClick = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPosition({ x: formatPosition(x), y: formatPosition(y) });
  };

  const finish = () => {
    if (!product || !selectedFound) return;
    const device = instantiateDevice(
      product,
      name || `${product.brand} ${product.model}`,
      room,
      position,
    );
    onComplete(device);
  };

  return (
    <div className="wiz-overlay" role="dialog" aria-modal="true" aria-label="Add smart device">
      <aside className="wiz-sheet">
        <header className="wiz-header">
          <div>
            <span className="wiz-eyebrow">Add smart device</span>
            <h2>
              {step === "category" && "Pilih jenis perangkat"}
              {step === "protocol" && product?.brand}
              {step === "discovery" && `Scanning ${product?.brand}`}
              {step === "place" && `Pair ${product?.brand}`}
            </h2>
          </div>
          <button className="wiz-close" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <ol className="wiz-steps">
          {(["category", "protocol", "discovery", "place"] as WizardStep[]).map((s, i) => (
            <li
              key={s}
              className={`${s === step ? "is-active" : ""} ${
                ["category", "protocol", "discovery", "place"].indexOf(step) > i ? "is-done" : ""
              }`}
            >
              <span>{i + 1}</span>
              <em>{["Jenis", "Protokol", "Scan", "Place"][i]}</em>
            </li>
          ))}
        </ol>

        <div className="wiz-body">
          {step === "category" ? (
            <>
              <div className="wiz-tabs">
                {(Object.keys(CATEGORY_LABEL) as SmartDeviceCategory[]).map((c) => {
                  const hasItems = CATALOG.some((p) => p.category === c);
                  if (!hasItems) return null;
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`wiz-tab ${category === c ? "is-active" : ""}`}
                      onClick={() => setCategory(c)}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
              <div className="wiz-grid">
                {productsByCategory.map((p) => (
                  <button
                    key={p.sku}
                    type="button"
                    className="wiz-product"
                    onClick={() => chooseProduct(p)}
                    style={{ borderColor: `${p.accent}33` }}
                  >
                    <span className="wiz-product__badge" style={{ background: p.accent }}>
                      {p.brand[0]}
                    </span>
                    <span className="wiz-product__info">
                      <strong>{p.brand} — {p.model}</strong>
                      <small>{p.description}</small>
                      <span className="wiz-product__tags">
                        {p.protocols.map((pr) => (
                          <em key={pr} style={{ color: PROTOCOLS[pr].tone }}>
                            {PROTOCOLS[pr].label}
                          </em>
                        ))}
                      </span>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === "protocol" && product ? (
            <>
              <p className="wiz-help">
                Pilih protokol komunikasi. Untuk demo, semua jalur disimulasikan secara realistis —
                produksi membutuhkan akses akun Tuya Cloud / Matter controller.
              </p>
              <div className="wiz-protocols">
                {product.protocols.map((pr) => {
                  const Icon = PROTOCOL_ICON[pr];
                  return (
                    <button
                      key={pr}
                      type="button"
                      className={`wiz-protocol ${protocol === pr ? "is-active" : ""}`}
                      onClick={() => setProtocol(pr)}
                      style={{
                        boxShadow:
                          protocol === pr
                            ? `0 14px 30px ${PROTOCOLS[pr].tone}33`
                            : undefined,
                      }}
                    >
                      <span className="wiz-protocol__icon" style={{ background: PROTOCOLS[pr].tone }}>
                        <Icon size={18} />
                      </span>
                      <span>
                        <strong>{PROTOCOLS[pr].label}</strong>
                        <small>{PROTOCOLS[pr].tagline}</small>
                      </span>
                      {protocol === pr ? <Check size={16} /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="wiz-cta-row">
                <button type="button" className="wiz-btn wiz-btn--ghost" onClick={goCategory}>
                  ← Ubah jenis
                </button>
                <button type="button" className="wiz-btn" onClick={startDiscovery}>
                  Mulai scanning <Search size={14} />
                </button>
              </div>
            </>
          ) : null}

          {step === "discovery" && product ? (
            <>
              <div className="wiz-radar" aria-hidden>
                <div
                  className="wiz-radar__sweep"
                  style={{ animationPlayState: discovered.length ? "paused" : "running" }}
                />
                <div className="wiz-radar__ring" />
                <div className="wiz-radar__ring is-delay" />
                <div className="wiz-radar__dot" />
                <span className="wiz-radar__caption">
                  {discovered.length ? "Devices found" : `Scanning ${Math.round(scanProgress * 100)}%`}
                </span>
              </div>
              <div className="wiz-found">
                {discovered.length === 0 ? (
                  <div className="wiz-skeleton" />
                ) : (
                  discovered.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`wiz-found-row ${selectedFound?.id === d.id ? "is-active" : ""}`}
                      onClick={() => setSelectedFound(d)}
                    >
                      <span className="wiz-found-row__dot">
                        <Radio size={14} />
                      </span>
                      <span>
                        <strong>{d.label}</strong>
                        <small>MAC {d.mac} · RSSI {d.rssi} dBm</small>
                      </span>
                      {selectedFound?.id === d.id ? <Check size={16} /> : <ChevronRight size={16} />}
                    </button>
                  ))
                )}
              </div>
              <div className="wiz-cta-row">
                <button type="button" className="wiz-btn wiz-btn--ghost" onClick={() => setStep("protocol")}>
                  ← Protokol
                </button>
                <button
                  type="button"
                  className="wiz-btn"
                  disabled={!selectedFound}
                  onClick={goPair}
                >
                  Pair perangkat →
                </button>
              </div>
            </>
          ) : null}

          {step === "place" && product && selectedFound ? (
            <>
              <ul className="wiz-phases">
                {["Handshake", "Provision", "Bind to room", "Sync state"].map((p, i) => (
                  <li key={p} className={i < pairPhase ? "is-done" : i === pairPhase ? "is-active" : ""}>
                    <span>{i < pairPhase ? <Check size={14} /> : i + 1}</span>
                    {p}
                  </li>
                ))}
              </ul>

              <label className="wiz-field">
                <span>Nama perangkat</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="wiz-field">
                <span>Ruangan</span>
                <select value={room} onChange={(e) => chooseRoom(e.target.value as RoomKey)}>
                  {rooms.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="wiz-placement">
                <div>
                  <span className="wiz-placement__label">Posisi di denah</span>
                  <small>Klik mini map untuk menentukan lokasi awal pin.</small>
                </div>
                <button
                  type="button"
                  className="wiz-placement-map"
                  onClick={handlePlacementClick}
                  aria-label="Pilih posisi perangkat di denah apartemen"
                >
                  <img src={apartment} alt="Mini apartment placement map" />
                  <span
                    className="wiz-placement-map__pin"
                    style={{
                      left: position.x,
                      top: position.y,
                      background: product.accent,
                    }}
                  >
                    {product.brand[0]}
                  </span>
                </button>
                <span className="wiz-placement__hint">
                  Pin akan langsung muncul di layer <b>{CATEGORY_LABEL[product.category]}</b> setelah disimpan.
                </span>
              </div>

              <div className="wiz-cta-row">
                <button type="button" className="wiz-btn wiz-btn--ghost" onClick={() => setStep("discovery")}>
                  ← Discovery
                </button>
                <button
                  type="button"
                  className="wiz-btn wiz-btn--primary"
                  disabled={pairPhase < 4}
                  onClick={finish}
                >
                  {pairPhase < 4 ? `Pairing… ${pairPhase}/4` : "Tambahkan ke apartment"}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <footer className="wiz-footer">
          <span className="wiz-footer__badge">Simulated pairing — production needs Tuya Cloud or Matter controller</span>
        </footer>
      </aside>
    </div>
  );
}
