import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  Bolt,
  CalendarClock,
  CheckCircle2,
  Gauge,
  ReceiptText,
  TrendingUp,
  X,
} from "lucide-react";
import { useEnergyStream } from "@/hooks/useEnergyStream";
import { useInvoices } from "@/hooks/useInvoices";
import { useSmartHome } from "@/hooks/useSmartHome";
import { energySim } from "@/services/energySimulator";
import { billing } from "@/services/billingEngine";
import { TARIFF, buildInvoiceBreakdown, formatRupiah } from "@/domain/tariff";

const DEVICE_COLORS = [
  "#7c6bff",
  "#3aa6ff",
  "#33b27e",
  "#f0b03c",
  "#ff7a4a",
  "#a855f7",
  "#22c55e",
  "#3b82f6",
];

const DEVICE_LABEL: Record<string, string> = {
  "ac-bedroom": "AC Bedroom",
  "ac-living": "AC Living",
  fridge: "Kulkas",
  lighting: "Lampu",
  "tv-living": "TV & Hiburan",
  kitchen: "Dapur",
  "wm-dryer": "Mesin Cuci",
  "router-iot": "Router & IoT",
  humidifier: "Humidifier",
  vacuum: "Robot vacuum",
  outlets: "Smart outlets",
  camera: "Camera",
  doorbell: "Door bell",
  "door-lock": "Door lock",
  "energy-meter": "Energy meter",
};

function formatEventTime(ts: number) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ts));
}

function formatLiveTime(ts: number) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

export function EnergyPage() {
  const invoices = useInvoices();
  const snap = useEnergyStream();
  const home = useSmartHome();
  const [resetOpen, setResetOpen] = useState(false);

  // Last 24 hours
  const last24 = useMemo(() => {
    const slice = snap.hours.slice(-24);
    return slice.map((h) => ({
      hour: new Date(h.ts).getHours().toString().padStart(2, "0"),
      kwh: Number(h.kwh.toFixed(2)),
      watts: Math.round(h.kwh * 1000),
    }));
  }, [snap.hours]);

  // Actual rolling meter samples from the simulator, not a decorative fake wave.
  const sparkline = useMemo(() => {
    const samples = snap.liveSamples.slice(-90);
    if (samples.length === 0) return [{ t: "now", w: Math.round(snap.liveWatts) }];
    return samples.map((sample) => ({
      t: formatLiveTime(sample.ts),
      w: Math.round(sample.watts),
    }));
  }, [snap.liveSamples, snap.liveWatts]);

  const livePowerFlow = useMemo(() => {
    const total = Math.max(1, snap.liveWatts);
    return snap.devices
      .filter((device) => device.watts > 3)
      .sort((a, b) => b.watts - a.watts)
      .slice(0, 5)
      .map((device) => ({
        id: device.id,
        label: DEVICE_LABEL[device.id] ?? device.label.replace(/^configured-/, ""),
        watts: Math.round(device.watts),
        kw: device.watts / 1000,
        pct: Math.max(4, Math.min(100, (device.watts / total) * 100)),
      }));
  }, [snap.devices, snap.liveWatts]);

  const latestLiveSample = snap.liveSamples[snap.liveSamples.length - 1];
  const latestSampleAge = latestLiveSample ? Math.max(0, Math.round((snap.now - latestLiveSample.ts) / 1000)) : 0;

  // Device share donut (this month)
  const deviceShare = useMemo(() => {
    const entries = Object.entries(snap.monthlyPerDevice).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 8).map(([id, kwh], idx) => ({
      id,
      name: DEVICE_LABEL[id] ?? id.replace(/^configured-/, ""),
      value: Number(kwh.toFixed(2)),
      color: DEVICE_COLORS[idx % DEVICE_COLORS.length],
    }));
  }, [snap.monthlyPerDevice]);

  // 7×24 heatmap
  const heatmap = useMemo(() => {
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const h of snap.hours) {
      const d = new Date(h.ts);
      const dow = (d.getDay() + 6) % 7; // Mon=0
      matrix[dow][d.getHours()] += h.kwh;
    }
    // average per cell over weeks present
    const max = Math.max(0.1, ...matrix.flat());
    return matrix.map((row) => row.map((v) => v / max));
  }, [snap.hours]);

  // Top spenders this month
  const topSpenders = useMemo(() => {
    return Object.entries(snap.monthlyPerDevice)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, kwh]) => ({
        id,
        label: DEVICE_LABEL[id] ?? id.replace(/^configured-/, ""),
        kwh,
        cost: Math.round(kwh * TARIFF.ratePerKwh),
      }));
  }, [snap.monthlyPerDevice]);

  // Month-to-date and projection
  const mtdKwh = useMemo(() => {
    const mk = new Date(snap.now);
    const key = `${mk.getFullYear()}-${String(mk.getMonth() + 1).padStart(2, "0")}`;
    return snap.monthlyKwh[key] ?? 0;
  }, [snap.monthlyKwh, snap.now]);

  const daysElapsed = useMemo(() => {
    const d = new Date(snap.now);
    return Math.max(1, d.getDate());
  }, [snap.now]);

  const daysInMonth = useMemo(() => {
    const d = new Date(snap.now);
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  }, [snap.now]);

  const projectedKwh = (mtdKwh / daysElapsed) * daysInMonth;
  const projectedBreakdown = buildInvoiceBreakdown(projectedKwh);
  const mtdBreakdown = buildInvoiceBreakdown(Math.max(mtdKwh, 0.01));

  const liveKW = snap.liveWatts / 1000;
  const contractKW = TARIFF.contractVA / 1000;
  const rawLoadPct = contractKW > 0 ? (liveKW / contractKW) * 100 : 0;
  const meterPct = Math.min(100, rawLoadPct);
  const loadState = rawLoadPct >= 100 ? "over" : rawLoadPct >= 90 ? "warning" : rawLoadPct >= 70 ? "high" : "normal";
  const loadStateLabel =
    loadState === "over"
      ? "Melebihi kontrak"
      : loadState === "warning"
        ? "Mendekati batas"
        : loadState === "high"
          ? "Beban tinggi"
          : "Aman";
  const unpaid = invoices.filter((i) => i.status === "unpaid").length;
  const events = home.eventLog.slice(0, 5);

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Energy Management</span>
          <h1>Realtime power flow & cost</h1>
          <p>
            Tarif dapat diatur · Kontrak {TARIFF.contractVA} VA · Rp{" "}
            {TARIFF.ratePerKwh.toLocaleString("id-ID")} / kWh
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setResetOpen(true)}
          >
            Reset data
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => billing.generatePreviousMonthDemo()}
          >
            <ReceiptText size={14} /> Buat tagihan bulan lalu
          </button>
        </div>
      </header>

      <div className="bento">
        <motion.article
          className="bento-card bento-card--hero"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="hero-live">
            <div>
              <span className="bento-eyebrow">Beban saat ini</span>
              <h2 className="hero-live__value">
                {liveKW.toFixed(2)}
                <em>kW</em>
              </h2>
              <div className="hero-live__meter">
                <div
                  className={`hero-live__bar ${loadState === "over" ? "is-over" : loadState !== "normal" ? "is-warn" : ""}`}
                  style={{ width: `${meterPct}%` }}
                />
              </div>
              <small>
                {rawLoadPct.toFixed(0)}% dari kontrak {contractKW.toFixed(1)} kW
                {loadState !== "normal" ? (
                  <span className={`warn-pill ${loadState === "over" ? "is-over" : ""}`}>
                    <AlertTriangle size={12} /> {loadStateLabel}
                  </span>
                ) : (
                  <span className="realtime-pill">fluktuatif live</span>
                )}
              </small>
            </div>
            <div className="hero-live__spark">
              <div className="hero-live__spark-head">
                <span>Power trace</span>
                <em>{latestSampleAge <= 1 ? "live" : `${latestSampleAge}s ago`}</em>
              </div>
              <ResponsiveContainer width="100%" height={76}>
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="lg-live" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c6bff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#7c6bff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(31,27,45,0.92)",
                      border: 0,
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${(v / 1000).toFixed(2)} kW`, "Beban"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="w"
                    stroke="#7c6bff"
                    strokeWidth={2.2}
                    fill="url(#lg-live)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <ul className="power-flow-list" aria-label="Top live device power flow">
                {livePowerFlow.map((device) => (
                  <li key={device.id}>
                    <div className="power-flow-list__head">
                      <span>{device.label}</span>
                      <em>{device.kw.toFixed(2)} kW</em>
                    </div>
                    <div className="power-flow-list__track">
                      <b style={{ width: `${device.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.article>

        <article className="bento-card bento-card--stat">
          <span className="bento-eyebrow">
            <Gauge size={14} /> Hari ini
          </span>
          <strong>{snap.todayKwh.toFixed(1)} kWh</strong>
          <small>≈ {formatRupiah(snap.todayKwh * TARIFF.ratePerKwh)}</small>
        </article>

        <article className="bento-card bento-card--stat">
          <span className="bento-eyebrow">
            <CalendarClock size={14} /> Bulan berjalan
          </span>
          <strong>{mtdKwh.toFixed(0)} kWh</strong>
          <small>{formatRupiah(mtdBreakdown.total)}</small>
        </article>

        <article className="bento-card bento-card--stat">
          <span className="bento-eyebrow">
            <TrendingUp size={14} /> Proyeksi tagihan
          </span>
          <strong>{formatRupiah(projectedBreakdown.total)}</strong>
          <small>{projectedKwh.toFixed(0)} kWh estimasi · {unpaid} invoice belum lunas</small>
        </article>

        <article className="bento-card bento-card--chart">
          <header className="bento-card__head">
            <span className="bento-eyebrow">24 jam terakhir</span>
            <span className="bento-tag">kWh aktual / jam</span>
          </header>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={last24} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="lg-24" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3aa6ff" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#3aa6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={10} stroke="#8d849a" />
              <YAxis tickLine={false} axisLine={false} fontSize={10} stroke="#8d849a" />
              <Tooltip
                contentStyle={{
                  background: "rgba(31,27,45,0.92)",
                  border: 0,
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 12,
                }}
                labelFormatter={(v) => `Jam ${v}:00`}
                formatter={(v: number) => [`${v} kWh`, "Konsumsi"]}
              />
              <Area type="monotone" dataKey="kwh" stroke="#3aa6ff" strokeWidth={2.2} fill="url(#lg-24)" />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="bento-card bento-card--donut">
          <header className="bento-card__head">
            <span className="bento-eyebrow">Distribusi bulan ini</span>
            <span className="bento-tag">{deviceShare.reduce((s, d) => s + d.value, 0).toFixed(0)} kWh</span>
          </header>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={170}>
              <PieChart>
                <Pie
                  data={deviceShare}
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {deviceShare.map((d) => (
                    <Cell key={d.id} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "rgba(31,27,45,0.92)",
                    border: 0,
                    borderRadius: 12,
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(v: number, n) => [`${v} kWh`, n as string]}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="donut-legend">
              {deviceShare.slice(0, 6).map((d) => (
                <li key={d.id}>
                  <span style={{ background: d.color }} />
                  {d.name}
                  <em>{d.value.toFixed(0)} kWh</em>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="bento-card bento-card--heatmap">
          <header className="bento-card__head">
            <span className="bento-eyebrow">Pola pemakaian 7 × 24</span>
            <span className="bento-tag">Senin → Minggu</span>
          </header>
          <div className="heatmap">
            <div className="heatmap__cols">
              {Array.from({ length: 24 }).map((_, h) => (
                <span key={h}>{h % 3 === 0 ? h : ""}</span>
              ))}
            </div>
            {heatmap.map((row, dow) => (
              <div key={dow} className="heatmap__row">
                <span className="heatmap__label">{["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"][dow]}</span>
                <div className="heatmap__cells">
                  {row.map((v, h) => (
                    <span
                      key={h}
                      style={{
                        background: `rgba(124,107,255,${0.08 + v * 0.78})`,
                      }}
                      title={`${v.toFixed(2)}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="bento-card bento-card--top">
          <header className="bento-card__head">
            <span className="bento-eyebrow">
              <Bolt size={14} /> Top pemboros bulan ini
            </span>
          </header>
          <ul className="top-list">
            {topSpenders.map((s, i) => (
              <li key={s.id}>
                <span className="top-list__rank">{i + 1}</span>
                <span className="top-list__name">{s.label}</span>
                <span className="top-list__kwh">{s.kwh.toFixed(0)} kWh</span>
                <span className="top-list__cost">{formatRupiah(s.cost)}</span>
              </li>
            ))}
            {topSpenders.length === 0 ? <li className="top-list__empty">Belum ada data.</li> : null}
          </ul>
        </article>

        <article className="bento-card bento-card--cost">
          <header className="bento-card__head">
            <span className="bento-eyebrow">Estimasi tagihan akhir bulan</span>
          </header>
          <div className="cost-grid">
            {projectedBreakdown.lines.map((l) => (
              <div key={l.label} className="cost-row">
                <span>{l.label}</span>
                <em>{l.detail ?? ""}</em>
                <b>{formatRupiah(l.amount)}</b>
              </div>
            ))}
            <div className="cost-row cost-row--total">
              <span>Total proyeksi</span>
              <em>jatuh tempo tgl. 20</em>
              <b>{formatRupiah(projectedBreakdown.total)}</b>
            </div>
          </div>
        </article>

        <article className="bento-card bento-card--events">
          <header className="bento-card__head">
            <span className="bento-eyebrow">
              <Activity size={14} /> Automation events
            </span>
            <span className="bento-tag">live</span>
          </header>
          <ul className="event-list">
            {events.map((event) => (
              <li key={event.id} className={`event-list__item is-${event.tone}`}>
                <span className="event-list__dot"><CheckCircle2 size={13} /></span>
                <span>
                  <strong>{event.message}</strong>
                  <small>{formatEventTime(event.ts)} · {event.detail ?? "Smart apartment"}</small>
                </span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      {resetOpen ? (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-label="Konfirmasi reset data energy">
          <div className="confirm-card">
            <button className="confirm-card__close" type="button" aria-label="Tutup" onClick={() => setResetOpen(false)}>
              <X size={16} />
            </button>
            <span className="confirm-card__icon"><AlertTriangle size={18} /></span>
            <h2>Reset data demo?</h2>
            <p>Energy history akan dibuat ulang untuk 30 hari terakhir. Layout dan perangkat yang sudah dipair tetap aman.</p>
            <div className="confirm-card__actions">
              <button type="button" className="ghost-btn" onClick={() => setResetOpen(false)}>Batal</button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  energySim.resetAll();
                  setResetOpen(false);
                }}
              >
                Reset data
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
