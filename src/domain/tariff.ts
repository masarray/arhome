// Default apartment energy billing profile for demo use.
// Values are intentionally configurable and not tied to a public utility brand.
// Minimum charge = 40 billing hours × contracted kVA × energy rate.
// Stamp duty is applied only for very high simulated invoices.
export const TARIFF = {
  goldenName: "Apartment Standard Plan",
  contractVA: 2200,
  contractKVA: 2.2,
  ratePerKwh: 1444.7,
  ppjRate: 0.03,
  bankAdmin: 2500,
  materaiThreshold: 5_000_000,
  materai: 10_000,
  minHourly: 40,
  assumedPowerFactor: 0.9,
} as const;

export function calcMinimumKwh() {
  return TARIFF.minHourly * TARIFF.contractKVA; // 88 kWh
}

export type InvoiceLine = {
  label: string;
  amount: number;
  detail?: string;
};

export type InvoiceBreakdown = {
  kwh: number;
  effectiveKwh: number;
  isMinimumApplied: boolean;
  energyCharge: number;
  ppj: number;
  bankAdmin: number;
  materai: number;
  total: number;
  lines: InvoiceLine[];
};

export function buildInvoiceBreakdown(kwh: number): InvoiceBreakdown {
  const minKwh = calcMinimumKwh();
  const effectiveKwh = Math.max(kwh, minKwh);
  const isMinimumApplied = kwh < minKwh;
  const energyCharge = Math.round(effectiveKwh * TARIFF.ratePerKwh);
  const ppj = Math.round(energyCharge * TARIFF.ppjRate);
  const subtotal = energyCharge + ppj + TARIFF.bankAdmin;
  const materai = subtotal > TARIFF.materaiThreshold ? TARIFF.materai : 0;
  const total = subtotal + materai;

  const lines: InvoiceLine[] = [
    {
      label: "Biaya Pemakaian Energi",
      amount: energyCharge,
      detail: `${effectiveKwh.toFixed(1)} kWh × Rp ${TARIFF.ratePerKwh.toLocaleString("id-ID")}${
        isMinimumApplied ? " (rekening minimum)" : ""
      }`,
    },
    {
      label: "Layanan Gedung & Distribusi (3%)",
      amount: ppj,
      detail: "Pengelola apartemen",
    },
    {
      label: "Biaya Administrasi",
      amount: TARIFF.bankAdmin,
      detail: "Sistem billing pengelola",
    },
  ];
  if (materai > 0) lines.push({ label: "Materai Elektronik", amount: materai });

  return {
    kwh,
    effectiveKwh,
    isMinimumApplied,
    energyCharge,
    ppj,
    bankAdmin: TARIFF.bankAdmin,
    materai,
    total,
    lines,
  };
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatKwh(value: number) {
  return `${value.toFixed(1)} kWh`;
}
