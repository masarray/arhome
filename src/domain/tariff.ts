// PLN — Tarif Tenaga Listrik R1/TR Non-Subsidi 2200 VA (golongan rumah tangga)
// Per Q1 2026 reference: Rp 1.444,70 / kWh
// Pajak Penerangan Jalan (PPJ) Pemkot Bogor: 3%
// Biaya admin bank: Rp 2.500
// Minimum charge (rekening minimum) = 40 jam nyala × Daya kVA × tarif
// Materai elektronik Rp 10.000 untuk tagihan > Rp 5.000.000
export const TARIFF = {
  goldenName: "R1/TR — Non-Subsidi",
  contractVA: 2200,
  contractKVA: 2.2,
  ratePerKwh: 1444.7,
  ppjRate: 0.03,
  bankAdmin: 2500,
  materaiThreshold: 5_000_000,
  materai: 10_000,
  minHourly: 40, // jam nyala minimum
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
      label: "Pajak Penerangan Jalan (PPJ 3%)",
      amount: ppj,
      detail: "Pemkot setempat",
    },
    {
      label: "Biaya Admin Bank",
      amount: TARIFF.bankAdmin,
      detail: "VA Bank Mitra",
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
