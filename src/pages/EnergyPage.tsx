import { useEffect, useMemo } from "react";
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
  AlertTriangle,
  Bolt,
  CalendarClock,
  Gauge,
  ReceiptText,
  TrendingUp,
} from "lucide-react";
import { useEnergyStream } from "@/hooks/useEnergyStream";
import { useSmartHome } from "@/hooks/useSmartHome";
import { useInvoices } from "@/hooks/useInvoices";
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
};

export function EnergyPage() {
  const home = useSmartHome();
  const invoices = useInvoices();


  // Wire smart-home state into the simulator factory with realistic
  // time-of-day duty cycles so live load stays plausible for a 2200 VA flat.
  useEffect(() => {
    const factory = () => {
      const now = new Date();
      const hour = now.getHours();
      const isPeak = hour >= 18 && hour <= 22;
      const isNight = hour >= 22 || hour <= 5;
      const isMidday = hour >= 12 && hour <= 14;
      const acFactor = isNight || isPeak ? 0.85 : isMidday ? 0.55 : 0.18;
      const lighting = home.avgBrightness * 220 + (isNight || hour < 7 || hour > 18 ? 35 : 6);
      const tv = isPeak ? 130 : 12;
      const cook =
        hour === 7 ? 800 : hour === 12 ? 600 : hour === 19 ? 950 : 6;
      const wmDryer = hour === 8 && now.getDay() % 3 === 0 ? 1200 : 0;
      const acBedroom = 950 * acFactor;
      const acLiving = home.climateDevice?.power
        ? 1100 * acFactor + Math.abs(24 - Number(home.climateDevice.value ?? 24)) * 40
        : 35;
      const fridge = 95 + (Math.sin(now.getMinutes() / 6) + 1) * 18;
      const router = 22;
      const humidifier = home.humidifierDevice?.power ? 38 : 1.5;
      const vacuum = home.vacuumDevice?.power ? 28 : 2.2;
      const outlets = Object.values(home.outletStates).filter((o) => o.on).length;
      return [
        { id: "ac-bedroom", label: "AC Bedroom", room: "Bedroom", category: "climate", watts: acBedroom, on: true },
        { id: "ac-living", label: "AC Living", room: "Living", category: "climate", watts: acLiving, on: true },
        { id: "fridge", label: "Kulkas", room: "Kitchen", category: "appliance", watts: fridge, on: true },
        { id: "lighting", label: "Lampu apartemen", room: "All", category: "lighting", watts: lighting, on: true },
        { id: "tv-living", label: "TV & Hiburan", room: "Living", category: "appliance", watts: tv, on: true },
        { id: "kitchen", label: "Dapur", room: "Kitchen", category: "appliance", watts: cook, on: cook > 10 },
        { id: "wm-dryer", label: "Mesin Cuci & Dryer", room: "Utility", category: "appliance", watts: wmDryer, on: wmDryer > 0 },
        { id: "router-iot", label: "Router & IoT", room: "Hall", category: "iot", watts: router, on: true },
        { id: "humidifier", label: "Humidifier", room: "Living", category: "appliance", watts: humidifier, on: Boolean(home.humidifierDevice?.power) },
        { id: "vacuum", label: "Robot vacuum", room: "Bedroom", category: "appliance", watts: vacuum, on: Boolean(home.vacuumDevice?.power) },
        { id: "outlets", label: "Smart outlets", room: "All", category: "appliance", watts: outlets * 90 + 4, on: outlets > 0 },
      ];
    };
    energySim.setDeviceFactory(factory);
    energySim.start();
  }, [home]);

  const snap = useEnergyStream();

  // Last 24 hours
  const last24 = useMemo(() => {
    const slice = snap.hours.slice(-24);
    return slice.map((h) => ({
      hour: new Date(h.ts).getHours().toString().padStart(2, "0"),
      kwh: Number(h.kwh.toFixed(2)),
      watts: Math.round(h.kwh * 1000),
    }));
  }, [snap.hours]);

  // Sparkline of latest 60 seconds of liveWatts using a smoothed window
  const sparkline = useMemo(() => {
    const arr: { t: number; w: number }[] = [];
    const last = snap.liveWatts;
    for (let i = 0; i < 30; i += 1) {
      const jitter = (Math.sin(snap.now / 1100 + i * 0.7) + 1) / 2;
      arr.push({ t: i, w: Math.round(last * (0.85 + jitter * 0.18)) });
    }
    return arr;
  }, [snap.liveWatts, snap.now]);

  // Device share donut (this month)
  const deviceShare = useMemo(() => {
    const entries = Object.entries(snap.monthlyPerDevice).sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 8).map(([id, kwh], idx) => ({
      id,
      name: DEVICE_LABEL[id] ?? id,
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
        label: DEVICE_LABEL[id] ?? id,
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
  const loadPct = Math.min(100, (liveKW / contractKW) * 100);
  const overLoad = loadPct > 88;
  const unpaid = invoices.filter((i) => i.status === "unpaid").length;

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Energy Management</span>
          <h1>Realtime energy & cost</h1>
          <p>
            Tarif {TARIFF.goldenName} · Daya {TARIFF.contractVA} VA · Rp{" "}
            {TARIFF.ratePerKwh.toLocaleString("id-ID")} / kWh
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              if (confirm("Reset semua data energy (akan re-generate 30 hari)?")) energySim.resetAll();
            }}
          >
            Reset data
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => billing.generateNextDemo()}
          >
            <ReceiptText size={14} /> Generate invoice bulan lalu
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
              <span className="bento-eyebrow">Live load</span>
              <h2 className="hero-live__value">
                {liveKW.toFixed(2)}
                <em>kW</em>
              </h2>
              <div className="hero-live__meter">
                <div
                  className={`hero-live__bar ${overLoad ? "is-warn" : ""}`}
                  style={{ width: `${loadPct}%` }}
                />
              </div>
              <small>
                {loadPct.toFixed(0)}% dari kontrak {contractKW.toFixed(1)} kW
                {overLoad ? (
                  <span className="warn-pill">
                    <AlertTriangle size={12} /> Mendekati batas
                  </span>
                ) : null}
              </small>
            </div>
            <div className="hero-live__spark">
              <ResponsiveContainer width="100%" height={92}>
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="lg-live" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c6bff" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="#7c6bff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
            <span className="bento-tag">kWh / jam</span>
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
      </div>
    </section>
  );
}
