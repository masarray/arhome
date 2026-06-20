import { buildInvoiceBreakdown, type InvoiceBreakdown } from "@/domain/tariff";
import { energySim } from "./energySimulator";
import { loadJSON, saveJSON } from "./persistence";

export type Invoice = {
  id: string; // INV-2026-06
  period: string; // 2026-06
  periodLabel: string; // Juni 2026
  issuedAt: number;
  dueAt: number;
  kwh: number;
  breakdown: InvoiceBreakdown;
  status: "unpaid" | "paid";
  paidAt?: number;
  perDevice: Record<string, number>;
};

const KEY = "mas.invoices.v2";

function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function invoiceId(period: string) {
  return `INV-${period.replace("-", "")}`;
}

function previousMonthKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function listMissingMonths(invoices: Invoice[]): string[] {
  const have = new Set(invoices.map((i) => i.period));
  const result: string[] = [];
  // backfill the last 3 months excluding current
  for (let i = 1; i <= 3; i += 1) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!have.has(key)) result.push(key);
  }
  return result.reverse();
}

class BillingEngine {
  private invoices: Invoice[];
  private listeners = new Set<(list: Invoice[]) => void>();

  constructor() {
    this.invoices = loadJSON<Invoice[]>(KEY, []);
    this.bootstrap();
  }

  private bootstrap() {
    const missing = listMissingMonths(this.invoices);
    for (const period of missing) {
      this.closeMonth(period);
    }
  }

  subscribe(fn: (list: Invoice[]) => void) {
    this.listeners.add(fn);
    fn(this.list());
    return () => {
      this.listeners.delete(fn);
    };
  }

  list() {
    return this.invoices.slice().sort((a, b) => b.issuedAt - a.issuedAt);
  }

  closeMonth(period: string) {
    const exists = this.invoices.find((i) => i.period === period);
    if (exists) return exists;
    const { kwh, perDevice } = energySim.consumeMonthForInvoice(period);
    const safeKwh = kwh > 0 ? kwh : 120 + Math.random() * 240; // demo fallback
    const breakdown = buildInvoiceBreakdown(safeKwh);
    const [y, m] = period.split("-").map(Number);
    const issuedAt = new Date(y, m, 3).getTime(); // 3rd of next month
    const dueAt = new Date(y, m, 20).getTime();
    const invoice: Invoice = {
      id: invoiceId(period),
      period,
      periodLabel: periodLabel(period),
      issuedAt,
      dueAt,
      kwh: safeKwh,
      breakdown,
      status: "unpaid",
      perDevice,
    };
    this.invoices.push(invoice);
    this.persist();
    this.broadcast();
    return invoice;
  }

  closeCurrentMonth() {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const exists = this.invoices.find((i) => i.period === period);
    if (exists) return exists;
    return this.closeMonth(period);
  }

  /** Demo helper: also produces the "previous" month at full real value. */
  generateNextDemo() {
    const period = previousMonthKey();
    const exists = this.invoices.find((i) => i.period === period);
    if (exists) return exists;
    return this.closeMonth(period);
  }

  markPaid(id: string) {
    const idx = this.invoices.findIndex((i) => i.id === id);
    if (idx < 0) return;
    this.invoices[idx] = { ...this.invoices[idx], status: "paid", paidAt: Date.now() };
    this.persist();
    this.broadcast();
  }

  remove(id: string) {
    this.invoices = this.invoices.filter((i) => i.id !== id);
    this.persist();
    this.broadcast();
  }

  private persist() {
    saveJSON(KEY, this.invoices);
  }

  private broadcast() {
    for (const fn of this.listeners) fn(this.list());
  }
}

export const billing = new BillingEngine();
