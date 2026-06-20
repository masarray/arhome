import { useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useSmartHome } from "@/hooks/useSmartHome";
import { CATALOG, CATEGORY_LABEL, PROTOCOLS } from "@/domain/deviceCatalog";
import { AddDeviceWizard } from "@/components/wizard/AddDeviceWizard";
import { rooms } from "@/domain/smartHomeData";
import type { SmartDeviceCategory } from "@/domain/smartHomeTypes";

const ALL_CATEGORIES = "all";

type CategoryFilter = typeof ALL_CATEGORIES | SmartDeviceCategory;

export function DevicesPage() {
  const home = useSmartHome();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(ALL_CATEGORIES);
  const totalSynced = home.devices.length + home.configuredDevices.length;

  const catalogCategories = useMemo(() => {
    return (Object.keys(CATEGORY_LABEL) as SmartDeviceCategory[]).filter((category) =>
      CATALOG.some((product) => product.category === category),
    );
  }, []);

  const visibleCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return CATALOG.filter((product) => {
      const matchesCategory = categoryFilter === ALL_CATEGORIES || product.category === categoryFilter;
      const searchable = `${product.brand} ${product.model} ${product.description} ${CATEGORY_LABEL[product.category]}`.toLowerCase();
      const matchesQuery = normalizedQuery.length === 0 || searchable.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [categoryFilter, query]);

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Device library</span>
          <h1>Smart devices</h1>
          <p>
            {totalSynced} perangkat tersinkron · {CATALOG.length} produk di
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
          <h3>Perangkat sistem aktif</h3>
          <div className="device-cards device-cards--system">
            {home.devices.map((d) => (
              <article key={d.id} className={`device-card ${d.power ? "is-on" : ""}`}>
                <header>
                  <span className="device-card__dot" />
                  <div>
                    <strong>{d.name}</strong>
                    <small>{d.room} · {d.type}</small>
                  </div>
                </header>
                <div className="device-card__chips">
                  <em>{d.status}</em>
                  {d.mode ? <em>{d.mode}</em> : null}
                  {d.value !== undefined ? <em>{d.value}{d.unit ?? ""}</em> : null}
                </div>
                <footer>
                  <button
                    type="button"
                    className={`device-card__toggle ${d.power ? "is-on" : ""}`}
                    onClick={() => {
                      if (d.id === "door-lock") home.toggleDoorLock();
                      else home.setDevicePower(d.id, !d.power);
                    }}
                  >
                    {d.power ? "ON" : "OFF"}
                  </button>
                  <span>System</span>
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="devices-block">
          <h3>Perangkat hasil pairing</h3>
          {home.configuredDevices.length === 0 ? (
            <p className="devices-empty">
              Belum ada perangkat tambahan. Tekan <b>Pair perangkat baru</b> untuk menambahkan pin ke denah dan load ke simulator energi.
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
          <div className="devices-block__head">
            <h3>Katalog produk</h3>
            <span>{visibleCatalog.length} item</span>
          </div>
          <div className="catalog-toolbar">
            <label className="catalog-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari brand, model, atau fungsi..."
              />
            </label>
            <div className="catalog-filter" aria-label="Filter kategori perangkat">
              <button
                type="button"
                className={categoryFilter === ALL_CATEGORIES ? "is-active" : ""}
                onClick={() => setCategoryFilter(ALL_CATEGORIES)}
              >
                Semua
              </button>
              {catalogCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={categoryFilter === category ? "is-active" : ""}
                  onClick={() => setCategoryFilter(category)}
                >
                  {CATEGORY_LABEL[category]}
                </button>
              ))}
            </div>
          </div>
          <div className="catalog-grid">
            {visibleCatalog.map((p) => (
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
