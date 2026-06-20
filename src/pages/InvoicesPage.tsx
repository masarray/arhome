import { useRef, useState } from "react";
import { Check, Download, FileText, Loader2, Sparkles, X } from "lucide-react";
import { useInvoices } from "@/hooks/useInvoices";
import { billing } from "@/services/billingEngine";
import { TARIFF, formatRupiah } from "@/domain/tariff";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function InvoicesPage() {
  const invoices = useInvoices();
  const [selectedId, setSelectedId] = useState<string | null>(invoices[0]?.id ?? null);
  const selected = invoices.find((i) => i.id === selectedId) ?? invoices[0] ?? null;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const totalOutstanding = invoices
    .filter((i) => i.status === "unpaid")
    .reduce((s, i) => s + i.breakdown.total, 0);

  const downloadPdf = async () => {
    if (!sheetRef.current || !selected) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const pdf = new jsPDF({ unit: "pt", format: "a4" });
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
      pdf.save(`${selected.id}.pdf`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="page-shell">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">Tagihan Otomatis</span>
          <h1>Tagihan Energi Apartemen</h1>
          <p>
            {invoices.length} invoice tersimpan · Sisa belum lunas{" "}
            <b>{formatRupiah(totalOutstanding)}</b>
          </p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="ghost-btn" onClick={() => billing.generatePreviousMonthDemo()}>
            <Sparkles size={14} /> Buat tagihan bulan lalu
          </button>
        </div>
      </header>

      <div className="invoice-layout">
        <aside className="invoice-list" aria-label="Daftar invoice">
          {invoices.length === 0 ? (
            <p className="invoice-list__empty">
              Belum ada invoice. Tekan <b>Buat tagihan bulan lalu</b> untuk membuat satu untuk demo.
            </p>
          ) : (
            invoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                className={`invoice-list-row ${inv.id === selected?.id ? "is-active" : ""}`}
                onClick={() => setSelectedId(inv.id)}
              >
                <span>
                  <strong>{inv.periodLabel}</strong>
                  <small>{inv.id} · {inv.kwh.toFixed(0)} kWh</small>
                </span>
                <span className="invoice-list-row__price">
                  <em>{formatRupiah(inv.breakdown.total)}</em>
                  <span className={`invoice-status invoice-status--${inv.status}`}>
                    {inv.status === "paid" ? "Lunas" : "Belum"}
                  </span>
                </span>
              </button>
            ))
          )}
        </aside>

        {selected ? (
          <article className="invoice-detail">
            <div className="invoice-detail__actions">
              <button type="button" className="primary-btn" onClick={downloadPdf} disabled={downloading}>
                {downloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                Download PDF
              </button>
              {selected.status === "unpaid" ? (
                <button type="button" className="ghost-btn" onClick={() => billing.markPaid(selected.id)}>
                  <Check size={14} /> Tandai lunas
                </button>
              ) : (
                <span className="invoice-paid-badge">
                  <Check size={14} /> Sudah lunas · {selected.paidAt ? formatDate(selected.paidAt) : ""}
                </span>
              )}
              <button type="button" className="ghost-btn ghost-btn--danger" onClick={() => billing.remove(selected.id)}>
                <X size={14} /> Hapus
              </button>
            </div>

            <div ref={sheetRef} className="invoice-sheet">
              <header className="invoice-sheet__head">
                <div>
                  <span className="invoice-sheet__brand">
                    <span className="invoice-sheet__logo">ALM</span>
                    <div>
                      <strong>Aruna Living Management</strong>
                      <small>Tagihan energi apartemen</small>
                    </div>
                  </span>
                </div>
                <div className="invoice-sheet__meta">
                  <span>No. invoice</span>
                  <strong>{selected.id}</strong>
                  <span>Periode</span>
                  <strong>{selected.periodLabel}</strong>
                </div>
              </header>

              <div className="invoice-sheet__simulation-banner">
                SIMULASI BILLING APARTEMEN — data demo dari smart meter virtual
              </div>

              <section className="invoice-sheet__customer">
                <div>
                  <small>Unit</small>
                  <strong>Mas Ari · Apartment 17 / B</strong>
                  <span>Bogor, Jawa Barat</span>
                </div>
                <div>
                  <small>Paket Tarif</small>
                  <strong>{TARIFF.goldenName}</strong>
                  <span>Kontrak {TARIFF.contractVA} VA</span>
                </div>
                <div>
                  <small>Diterbitkan</small>
                  <strong>{formatDate(selected.issuedAt)}</strong>
                  <span>Jatuh tempo {formatDate(selected.dueAt)}</span>
                </div>
              </section>

              <table className="invoice-sheet__table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th>Rincian</th>
                    <th>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.breakdown.lines.map((line) => (
                    <tr key={line.label}>
                      <td>{line.label}</td>
                      <td>{line.detail ?? "—"}</td>
                      <td>{formatRupiah(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2}>Total tagihan</th>
                    <th>{formatRupiah(selected.breakdown.total)}</th>
                  </tr>
                </tfoot>
              </table>

              <footer className="invoice-sheet__foot">
                <p>
                  Pembayaran demo melalui aplikasi tenant atau akun pengelola. Tagihan ini dibuat otomatis oleh
                  MasAri Smart Apartment dari pengukuran realtime smart meter unit.
                </p>
                <small>
                  <FileText size={12} /> Dokumen simulasi untuk demo energy management.
                </small>
              </footer>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
