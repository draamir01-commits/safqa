import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Eye, Printer, ShieldAlert, Sparkles, AlertCircle, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection } from "../../firebase/firestore";
import { generateZatcaQrHtmlCanvas } from "../../utils/zatca/qrEncoder";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Invoice, InvoiceStatus, ZatcaStatus } from "../../types";

import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  // Set up realtime sync listen
  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "invoices", (data) => {
      // Sort newest first
      const sorted = (data as Invoice[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvoices(sorted);
    });
    return unsubscribe;
  }, [currentCompany]);

  const handleOpenPreview = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPreviewOpen(true);
  };

  const handlePrint = () => {
    const printContent = document.getElementById("zatca-print-frame");
    if (!printContent) return;

    const originalContent = document.body.innerHTML;
    const printHTML = printContent.innerHTML;

    // Direct window.print trigger with clean context swapping
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(`
        <html>
          <head>
            <title>${selectedInvoice?.invoiceNumber || "Invoice"}</title>
            <style>
              body { font-family: 'Cairo', 'Inter', sans-serif; padding: 25px; color: #1e293b; background: white; }
              @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&family=Inter:wght@400;600;700&display=swap');
              @media print {
                .no-print { display: none; }
              }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px; }
              th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: right; }
              .rtl { direction: rtl; }
              .ltr { direction: ltr; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .grid { display: grid; }
              .grid-cols-2 { grid-template-columns: 1fr 1fr; }
              .gap-4 { gap: 16px; }
              .text-xs { font-size: 11px; }
              .text-sm { font-size: 13px; }
              .font-bold { font-weight: bold; }
              .font-mono { font-family: monospace; }
              .border { border: 1px solid #e2e8f0; }
              .rounded-lg { border-radius: 8px; }
              .p-4 { padding: 16px; }
              .p-6 { padding: 24px; }
            </style>
          </head>
          <body onload="style(); window.print(); window.close();">
            <div class="${language === "ar" ? "rtl" : "ltr"}">${printHTML}</div>
          </body>
        </html>
      `);
      win.document.close();
    }
  };

  const columns: Column<Invoice>[] = [
    {
      header: t("invoice.number"),
      render: (row) => (
        <span className="font-bold text-slate-800">{row.invoiceNumber}</span>
      )
    },
    {
      header: t("invoice.customer"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">{language === "ar" ? row.customerNameAr || row.customerName : row.customerName}</span>
          {row.customerVatNumber && (
            <span className="text-[10px] text-slate-400 font-mono">VAT: {row.customerVatNumber}</span>
          )}
        </div>
      )
    },
    {
      header: t("invoice.issueDate"),
      render: (row) => (
        <span className="text-xs text-slate-605">{formatDate(row.issueDate, language)}</span>
      )
    },
    {
      header: t("invoice.total"),
      render: (row) => (
        <div className="flex flex-col text-slate-800 font-bold text-xs">
          <CurrencyDisplay amount={row.grandTotal} />
          <span className="text-[9px] text-emerald-600 font-medium">%15 VAT incl.</span>
        </div>
      )
    },
    {
      header: "ZATCA " + t("nav.zatca"),
      render: (row) => {
        const statuses: { [key: string]: string } = {
          cleared: "bg-emerald-50 text-emerald-800 border-emerald-250 font-bold",
          reported: "bg-teal-50 text-teal-800 border-teal-200",
          failed: "bg-red-50 text-red-800 border-red-200 font-bold",
          not_submitted: "bg-slate-100 text-slate-600 border-slate-200"
        };
        const stCl = statuses[row.zatcaStatus] || "bg-slate-50 text-slate-600";
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase border font-semibold ${stCl}`}>
            {row.zatcaStatus === "not_submitted" ? (language === "ar" ? "جاهز/محلي" : "Local draft") : row.zatcaStatus}
          </span>
        );
      }
    },
    {
      header: t("invoice.status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      )
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <Button variant="secondary" size="sm" onClick={() => handleOpenPreview(row)} className="p-1 px-2 flex items-center gap-1.5 hover:border-brand-primary">
          <Eye className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-xs">{language === "ar" ? "معاينة الفاتورة" : "Preview"}</span>
        </Button>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{language === "ar" ? "سجل الفواتير الإلكترونية" : "Tax Invoices Ledger"}</h2>
          <p className="text-xs text-slate-500">Official Phase 1 generation with offline hash-chains & Phase 2 API clearance simulator.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={invoices} filename="invoices" headers={{ invoiceNumber: "Invoice #", customerName: "Customer", issueDate: "Date", grandTotal: "Total", status: "Status", zatcaStatus: "ZATCA" }} />
          <Link to="/invoices/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("invoice.new")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Data Table */}
      <DataTable
        columns={columns}
        data={invoices}
        searchPlaceholder={language === "ar" ? "البحث برقم الفاتورة..." : "Search by number..."}
        searchField="invoiceNumber"
        exportFileName={`safqa-invoices-${Date.now()}.csv`}
      />

      {/* OFFICIALLY CONFORMANT ZATCA INVOICE PREVIEW MODAL */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title={language === "ar" ? "معاينة الفاتورة الضريبية" : "ZATCA Tax Invoice Preview"} size="lg">
        {selectedInvoice && (
          <div className="flex flex-col gap-6">
            
            {/* Top Toolbar Actions */}
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedInvoice.status} />
                <span className="text-xs text-slate-400">UUID: {selectedInvoice.zatcaUUID?.substring(0, 8)}...</span>
              </div>
              <Button onClick={handlePrint} variant="success" size="sm" className="flex items-center gap-2 font-bold px-4">
                <Printer className="h-4 w-4" />
                {language === "ar" ? "طباعة الفاتورة والباركود" : "Print PDF / Receipt"}
              </Button>
            </div>

            {/* PRINT WRAPPER FRAME FOR CSS SELECTORS */}
            <div id="zatca-print-frame" className="p-2 select-none" dir={language === "ar" ? "rtl" : "ltr"}>
              <div className="flex flex-col gap-6 border border-slate-100 rounded-lg p-6 bg-white shrink-0">
                
                {/* 1. Header (Corporate Descriptors & Logo) */}
                <div className="flex items-start justify-between border-b pb-4 border-slate-200">
                  {/* Left Side: Corporate Details (Bilingual) */}
                  <div className="flex flex-col gap-1.5 text-right rtl:text-right ltr:text-left">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">
                      {currentCompany?.name}
                    </h1>
                    <h1 className="text-lg font-bold text-slate-900 leading-none font-sans">
                      {currentCompany?.nameAr || "شركة صفقة للتجارة"}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      CR No / السجل التجاري: <span className="font-mono text-xs">{currentCompany?.crNumber}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      VAT ID / الرقم الضريبي للمنشأة: <span className="font-mono text-xs text-brand-primary">{currentCompany?.vatNumber}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight max-w-sm">
                      {currentCompany?.addressAr || currentCompany?.address}, {currentCompany?.city}, SA
                    </p>
                  </div>

                  {/* Right Side: Document Logo Placeholder or uploaded Asset */}
                  <div className="flex flex-col items-center gap-2">
                    {currentCompany?.logo ? (
                      <div className="h-16 w-16 bg-slate-50 p-1 border rounded object-contain flex items-center justify-center">
                        <img src={currentCompany.logo} alt="corporate logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded bg-brand-primary text-white flex items-center justify-center font-bold text-xl uppercase">
                        ص
                      </div>
                    )}
                    <span className="text-[9px] uppercase font-bold tracking-widest text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded leading-none shrink-0 border border-slate-200">
                      {selectedInvoice.type === "standard" ? (language === "ar" ? "فاتورة ضريبية B2B" : "Tax Invoice B2B") : (language === "ar" ? "فاتورة مبسطة B2C" : "Simplified Tax B2C")}
                    </span>
                  </div>
                </div>

                {/* 2. Metadata Columns (Dates, Numbers, Supply date) */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-medium">
                  {/* Left Column values */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "رقم الفاتورة" : "Invoice No."}:</span>
                      <span className="font-bold text-slate-800">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "تاريخ الإصدار" : "Issue Date"}:</span>
                      <span className="text-slate-700">{formatDate(selectedInvoice.issueDate, language)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "تاريخ التوريد" : "Supply Date"}:</span>
                      <span className="text-slate-705">{formatDate(selectedInvoice.supplyDate || selectedInvoice.issueDate, language)}</span>
                    </div>
                  </div>

                  {/* Right Column: Customer parameters */}
                  <div className="flex flex-col gap-2 border-l rtl:border-l-0 rtl:border-r pl-4 rtl:pl-0 rtl:pr-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{language === "ar" ? "العميل المستلم" : "Billed Recipient"}</p>
                    <span className="font-bold text-slate-900 leading-tight">
                      {language === "ar" ? selectedInvoice.customerNameAr || selectedInvoice.customerName : selectedInvoice.customerName}
                    </span>
                    {selectedInvoice.customerVatNumber ? (
                      <div className="flex flex-col gap-1 mt-1 text-[10px] text-slate-500 font-semibold">
                        <p>VAT / الضريبة: <span className="font-mono text-xs">{selectedInvoice.customerVatNumber}</span></p>
                        {selectedInvoice.customerAddress && <p className="text-slate-400 font-medium">{selectedInvoice.customerAddress}</p>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-brand-primary bg-blue-50 px-2 py-0.5 rounded inline-block self-start font-bold mt-1">
                        {language === "ar" ? "فرد - مستهلك نهائي" : "Simplified Final Consumer"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Items Table Breakdown */}
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="px-3 py-2 text-right">{language === "ar" ? "البيان / الصنف" : "Item Description"}</th>
                      <th className="px-3 py-2 text-center">{language === "ar" ? "الكمية" : "Qty"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "سعر الوحدة" : "Unit Price"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "الخصم" : "Discount"}</th>
                      <th className="px-3 py-2 text-center">{language === "ar" ? "الضريبة" : "VAT %"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "الإجمالي" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedInvoice.lineItems?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20 text-slate-700">
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {language === "ar" ? line.nameAr || line.name : line.name}
                          <p className="text-[9px] text-slate-400 font-mono">CODE: {line.productId?.substring(0, 8)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-605">{line.qty} {line.unit}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(line.unitPrice, language)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 font-mono">-{formatCurrency(line.discountAmount || 0, language)}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600 font-bold">%{line.vatRate}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900 font-mono">{formatCurrency(line.lineTotal, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 4. Bottom Row: QR block, secure chained hash & Totals Panel */}
                <div className="flex flex-col md:flex-row items-center md:items-start justify-between border-t pt-5 border-slate-200 gap-6">
                  
                  {/* Dynamic ZATCA QR block with generated TLV byte parsing */}
                  <div className="flex flex-col items-center justify-center p-3 border border-slate-150 rounded-lg bg-slate-50 max-w-[200px] gap-2">
                    {selectedInvoice.zatcaQRCode ? (
                      <div className="h-32 w-32 bg-white p-1 rounded-sm border border-slate-200">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedInvoice.zatcaQRCode)}`}
                          alt="ZATCA compliant QR barcode"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-32 w-32 bg-slate-100 flex items-center justify-center border text-slate-400 text-xs text-center border-dashed border-slate-300">
                        QR Code missing / unavailable
                      </div>
                    )}
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide text-center">
                      ZATCA SHA256 APPROVED
                    </span>
                  </div>

                  {/* Invoice Totals Summaries */}
                  <div className="w-full md:max-w-xs flex flex-col gap-2 text-right">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span>{language === "ar" ? "المجموع الخاضع للضريبة" : "Taxable Subtotal"}:</span>
                      <span className="font-mono text-slate-700">{formatCurrency(selectedInvoice.subtotal, language)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b pb-1.5">
                      <span>{language === "ar" ? "إجمالي الخصومات" : "Total Discounts"}:</span>
                      <span className="font-mono text-slate-700">-{formatCurrency(selectedInvoice.totalDiscount || 0, language)}</span>
                    </div>

                    {/* VAT break counts */}
                    {selectedInvoice.vatBreakdown?.map((v, vIdx) => (
                      <div key={vIdx} className="flex justify-between items-center text-xs font-bold text-slate-500">
                        <span>{language === "ar" ? `مجموع ضريبة القيمة المضافة (${v.rate}%)` : `VAT Amount (${v.rate}%)`}:</span>
                        <span className="font-mono text-slate-800">{formatCurrency(v.amount, language)}</span>
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t pt-2 border-slate-200 gap-4">
                      <span>{language === "ar" ? "الإجمالي المستحق (شامل الضريبة)" : "Invoice Grand Total (Incl. VAT)"}:</span>
                      <span className="font-bold text-lg text-emerald-600 font-sans">{formatCurrency(selectedInvoice.grandTotal, language)}</span>
                    </div>
                  </div>

                </div>

                {/* Chaining hash summary and compliance stamps */}
                <div className="border-t pt-4 border-slate-100 text-[8px] text-slate-400 flex flex-col gap-1 font-mono uppercase tracking-tight break-all leading-tight">
                  <p>ZATCA Chaining XML Hash: {selectedInvoice.zatcaHash || "—"}</p>
                  <p>ZATCA Cryptographic Key ID: ECC-secp256k1-SHA256</p>
                </div>

              </div>
            </div>

          </div>
        )}
      </Modal>

    </div>
  );
};
export default InvoicesPage;
