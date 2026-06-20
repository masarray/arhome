import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSmartHome } from "@/hooks/useSmartHome";
import { CATALOG, CATEGORY_LABEL, PROTOCOLS } from "@/domain/deviceCatalog";
import { AddDeviceWizard } from "@/components/wizard/AddDeviceWizard";
import { rooms } from "@/domain/smartHomeData";

export function DevicesPage() {
  const home = useSmartHome();
  const [open, setOpen] = useState(false);

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Device library</span>
          <h1>Smart devices</h1>
          <p>
            {home.configuredDevices.length} perangkat tersinkron · {CATALOG.length} produk di
            katalog
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="primary-btn" onClick={() => setOpen(true)}>
            <Plus size={14} /> Pair perangkat baru
          </button>
        </div>
      </header>

      <div className="devices-grid">
        <section className="devices-block">
          <h3>Perangkat aktif</h3>
          {home.configuredDevices.length === 0 ? (
            <p className="devices-empty">
              Belum ada perangkat di apartemen. Tekan <b>Pair perangkat baru</b> untuk memulai.
            </p>
          ) : (
            <div className="device-cards">
              {home.configuredDevices.map((d) => {
                const room = rooms.find((r) => r.key === d.roomKey)?.label ?? d.roomKey;
                return (
                  <article key={d.id} className={`device-card ${d.power ? "is-on" : ""}`}>
                    <header>
                      <span className="device-card__dot" />
                      <div>
                        <strong>{d.name}</strong>
                        <small>
                          {d.brand} · {d.model} · {room}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="device-card__del"
                        aria-label="Delete"
                        onClick={() => home.deleteConfiguredDevice(d.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </header>
                    <div className="device-card__chips">
                      {d.capabilities.slice(0, 4).map((c) => (
                        <em key={c}>{c}</em>
                      ))}
                    </div>
                    <footer>
                      <button
                        type="button"
                        className={`device-card__toggle ${d.power ? "is-on" : ""}`}
                        onClick={() => home.toggleConfiguredDevice(d.id)}
                      >
                        {d.power ? "ON" : "OFF"}
                      </button>
                      <span>{d.adapter}</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="devices-block">
          <h3>Katalog produk</h3>
          <div className="catalog-grid">
            {CATALOG.map((p) => (
              <article key={p.sku} className="catalog-card">
                <span className="catalog-card__badge" style={{ background: p.accent }}>
                  {p.brand[0]}
                </span>
                <strong>{p.brand} {p.model}</strong>
                <small>{CATEGORY_LABEL[p.category]} · {p.ratedWatts} W</small>
                <p>{p.description}</p>
                <div className="catalog-card__tags">
                  {p.protocols.map((pr) => (
                    <em key={pr} style={{ color: PROTOCOLS[pr].tone }}>
                      {PROTOCOLS[pr].label}
                    </em>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <AddDeviceWizard
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(d) => {
          home.saveConfiguredDevice(d);
          setOpen(false);
        }}
      />
    </section>
  );
}
