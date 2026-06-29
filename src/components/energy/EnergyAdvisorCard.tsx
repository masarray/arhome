import { AlertTriangle, CheckCircle2, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { useEnergyStream } from "@/hooks/useEnergyStream";
import { TARIFF, formatRupiah } from "@/domain/tariff";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rhythmLabel(hour: number) {
  if (hour >= 5 && hour < 9) return "pagi aktif";
  if (hour >= 9 && hour < 16) return "siang stabil";
  if (hour >= 16 && hour < 22) return "sore/malam puncak";
  return "malam hemat";
}

function powerTrend(samples: { watts: number }[]) {
  if (samples.length < 12) return { label: "stabil", tone: "normal", deltaKw: 0 } as const;
  const first = samples.slice(0, 12).reduce((s, x) => s + x.watts, 0) / 12;
  const last = samples.slice(-12).reduce((s, x) => s + x.watts, 0) / 12;
  const deltaKw = (last - first) / 1000;
  if (deltaKw > 0.12) return { label: "naik", tone: "warning", deltaKw } as const;
  if (deltaKw < -0.12) return { label: "turun", tone: "success", deltaKw } as const;
  return { label: "stabil", tone: "normal", deltaKw } as const;
}

export function EnergyAdvisorCard() {
  const snap = useEnergyStream();
  const samples = snap.liveSamples.slice(-90);
  const sampleWatts = samples.length > 0 ? samples.map((sample) => sample.watts) : [snap.liveWatts];
  const minKw = Math.min(...sampleWatts) / 1000;
  const maxKw = Math.max(...sampleWatts) / 1000;
  const avgKw = sampleWatts.reduce((sum, value) => sum + value, 0) / sampleWatts.length / 1000;
  const contractKva = TARIFF.contractKVA;
  const trend = powerTrend(samples);
  const forecastKw = clamp(avgKw + trend.deltaKw * 0.45, 0.08, Math.max(contractKva * TARIFF.assumedPowerFactor * 1.35, maxKw + 0.25));
  const forecastKva = forecastKw / TARIFF.assumedPowerFactor;
  const demandPct = contractKva > 0 ? (forecastKva / contractKva) * 100 : 0;
  const top = snap.devices.slice().sort((a, b) => b.watts - a.watts)[0];
  const topLabel = top ? DEVICE_LABEL[top.id] ?? top.label : "Smart meter";
  const hour = new Date(snap.now).getHours();
  const rhythm = rhythmLabel(hour);

  const recommendation = (() => {
    if (demandPct >= 100) {
      return `Kurangi beban ${topLabel} atau tunda appliance besar. Prediksi 15 menit bisa melewati kontrak.`;
    }
    if (demandPct >= 90) {
      return `Beban mendekati batas. Mode eco AC dan jadwal tunda dapur/laundry akan menahan lonjakan.`;
    }
    if (top?.id.startsWith("ac-")) {
      return `AC menjadi beban dominan. Naikkan setpoint 1 derajat untuk menurunkan demand tanpa mengubah layout.`;
    }
    if (top?.id === "kitchen" || top?.id === "wm-dryer") {
      return `Ada appliance siklik yang sedang aktif. Biarkan selesai atau jadwalkan di luar jam puncak.`;
    }
    return `Pola ${rhythm} masih normal. Simulator membaca fluktuasi meter, bukan angka statis.`;
  })();

  const statusTone = demandPct >= 100 ? "danger" : demandPct >= 90 ? "warning" : demandPct >= 70 ? "normal" : "success";

  return (
    <article className="bento-card bento-card--advisor">
      <header className="bento-card__head">
        <span className="bento-eyebrow">
          <Sparkles size={14} /> Smart load advisor
        </span>
        <span className={`advisor-status is-${statusTone}`}>{rhythm}</span>
      </header>

      <div className="advisor-grid">
        <div className="advisor-metric">
          <span>Prediksi demand 15 menit</span>
          <strong>{forecastKw.toFixed(2)} kW</strong>
          <em>{demandPct.toFixed(0)}% kontrak · {forecastKva.toFixed(2)} kVA · ≈ {formatRupiah(forecastKw * 0.25 * TARIFF.ratePerKwh)}</em>
        </div>
        <div className="advisor-metric">
          <span>Rentang meter live</span>
          <strong>{minKw.toFixed(2)}–{maxKw.toFixed(2)} kW</strong>
          <em>rata-rata {avgKw.toFixed(2)} kW · trend {trend.label}</em>
        </div>
      </div>

      <div className="advisor-topload">
        <div>
          <Gauge size={15} />
          <span>Beban dominan</span>
        </div>
        <strong>{topLabel}</strong>
        <em>{top ? `${(top.watts / 1000).toFixed(2)} kW saat ini` : "menunggu sample"}</em>
      </div>

      <p className={`advisor-note is-${statusTone}`}>
        {statusTone === "danger" || statusTone === "warning" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
        <span>{recommendation}</span>
      </p>

      <div className="advisor-demand-bar" aria-label="Prediksi demand terhadap kontrak">
        <b style={{ width: `${Math.min(100, demandPct)}%` }} />
      </div>
      <small className="advisor-caption">
        <TrendingUp size={13} /> Forecast memakai rolling meter sample, PF {TARIFF.assumedPowerFactor.toFixed(2)}, dan ritme pemakaian jam saat ini.
      </small>
    </article>
  );
}
