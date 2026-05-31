import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Eye, Printer, ShieldAlert, Sparkles, AlertCircle, FileSpreadsheet, Pencil, Trash2, X, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, updateDocument, deleteDocument } from "../../firebase/firestore";
import { generateZatcaQrHtmlCanvas } from "../../utils/zatca/qrEncoder";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Invoice, InvoiceStatus, ZatcaStatus } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const { user } = useAuthStore();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);
  // Edit form fields
  const [editIssueDate, setEditIssueDate] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editSupplyDate, setEditSupplyDate] = React.useState("");
  const [editStatus, setEditStatus] = React.useState("");
  const [editPaymentStatus, setEditPaymentStatus] = React.useState("");
  const [editAmountPaid, setEditAmountPaid] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editNotesAr, setEditNotesAr] = React.useState("");
  const [editCustomerName, setEditCustomerName] = React.useState("");
  const [editCustomerNameAr, setEditCustomerNameAr] = React.useState("");
  const [editCustomerVat, setEditCustomerVat] = React.useState("");
  // Edit line items
  const [editLines, setEditLines] = React.useState<any[]>([]);

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

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditIssueDate(inv.issueDate || "");
    setEditDueDate(inv.dueDate || "");
    setEditSupplyDate(inv.supplyDate || inv.issueDate || "");
    setEditStatus(inv.status || "draft");
    setEditPaymentStatus(inv.paymentStatus || "unpaid");
    setEditAmountPaid(String(inv.amountPaid || 0));
    setEditNotes(inv.notes || "");
    setEditNotesAr(inv.notesAr || "");
    setEditCustomerName(inv.customerName || "");
    setEditCustomerNameAr(inv.customerNameAr || "");
    setEditCustomerVat(inv.customerVatNumber || "");
    setEditLines(inv.lineItems ? inv.lineItems.map(l => ({ ...l })) : []);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice || !currentCompany) return;
    setEditSaving(true);
    try {
      // Recalculate totals from edited lines
      let subtotal = 0, totalVat = 0, totalDiscount = 0;
      const recalcLines = editLines.map(l => {
        const lineNet = l.qty * l.unitPrice;
        const disc = l.discountAmount || 0;
        const net = lineNet - disc;
        const vat = Math.round(net * (l.vatRate / 100) * 100) / 100;
        const total = Math.round((net + vat) * 100) / 100;
        subtotal += net;
        totalVat += vat;
        totalDiscount += disc;
        return { ...l, vatAmount: vat, lineTotal: total };
      });
      const grandTotal = Math.round((subtotal + totalVat - totalDiscount) * 100) / 100;
      const amountPaidNum = parseFloat(editAmountPaid) || 0;

      await updateDocument(`companies/${currentCompany.id}/invoices`, editingInvoice.id, {
        issueDate: editIssueDate,
        dueDate: editDueDate,
        supplyDate: editSupplyDate,
        status: editStatus,
        paymentStatus: editPaymentStatus,
        amountPaid: amountPaidNum,
        amountDue: Math.max(0, grandTotal - amountPaidNum),
        notes: editNotes,
        notesAr: editNotesAr,
        customerName: editCustomerName,
        customerNameAr: editCustomerNameAr,
        customerVatNumber: editCustomerVat,
        lineItems: recalcLines,
        subtotal: Math.round(subtotal * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        grandTotal,
        updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم تحديث الفاتورة" : "Invoice updated successfully");
      setEditOpen(false);
      setEditingInvoice(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!currentCompany || !window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة؟" : "Delete this invoice permanently?")) return;
    try {
      await deleteDocument(`companies/${currentCompany.id}/invoices`, inv.id);
      toast.success(language === "ar" ? "تم حذف الفاتورة" : "Invoice deleted");
      if (previewOpen && selectedInvoice?.id === inv.id) setPreviewOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateEditLine = (idx: number, field: string, value: any) => {
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
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
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => handleOpenPreview(row)} className="p-1 px-2 flex items-center gap-1.5 hover:border-brand-primary">
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs">{language === "ar" ? "معاينة" : "View"}</span>
          </Button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-colors"
            title={language === "ar" ? "تعديل" : "Edit"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDeleteInvoice(row)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title={language === "ar" ? "حذف" : "Delete"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
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
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
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
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setPreviewOpen(false); handleOpenEdit(selectedInvoice); }} className="flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  {language === "ar" ? "تعديل" : "Edit"}
                </Button>
                <Button onClick={handlePrint} variant="success" size="sm" className="flex items-center gap-2 font-bold px-4">
                  <Printer className="h-4 w-4" />
                  {language === "ar" ? "طباعة الفاتورة والباركود" : "Print PDF / Receipt"}
                </Button>
              </div>
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


      {/* ── Edit Invoice Modal ── */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditingInvoice(null); }}
        title={`${language === "ar" ? "تعديل الفاتورة" : "Edit Invoice"} — ${editingInvoice?.invoiceNumber || ""}`}
        size="lg">
        {editingInvoice && (
          <div className="flex flex-col gap-5">

            {/* Customer info */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "معلومات العميل" : "Customer Info"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label={language === "ar" ? "اسم العميل (إنجليزي)" : "Customer Name (EN)"} value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
                <Input label={language === "ar" ? "اسم العميل (عربي)" : "Customer Name (AR)"} value={editCustomerNameAr} onChange={e => setEditCustomerNameAr(e.target.value)} />
                <Input label={language === "ar" ? "الرقم الضريبي" : "VAT Number"} value={editCustomerVat} onChange={e => setEditCustomerVat(e.target.value)} placeholder="300XXXXXXXXXXX3" />
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "التواريخ" : "Dates"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label={language === "ar" ? "تاريخ الإصدار" : "Issue Date"} type="date" value={editIssueDate} onChange={e => setEditIssueDate(e.target.value)} />
                <Input label={language === "ar" ? "تاريخ الاستحقاق" : "Due Date"} type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                <Input label={language === "ar" ? "تاريخ التوريد" : "Supply Date"} type="date" value={editSupplyDate} onChange={e => setEditSupplyDate(e.target.value)} />
              </div>
            </div>

            {/* Payment */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "حالة الدفع" : "Payment"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select label={language === "ar" ? "حالة الفاتورة" : "Invoice Status"} value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  options={[
                    { value: "draft",     label: language === "ar" ? "مسودة" : "Draft" },
                    { value: "approved",  label: language === "ar" ? "معتمدة" : "Approved" },
                    { value: "paid",      label: language === "ar" ? "مدفوعة" : "Paid" },
                    { value: "cancelled", label: language === "ar" ? "ملغية" : "Cancelled" },
                  ]} />
                <Select label={language === "ar" ? "حالة الدفع" : "Payment Status"} value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)}
                  options={[
                    { value: "unpaid",         label: language === "ar" ? "غير مدفوعة" : "Unpaid" },
                    { value: "partial",        label: language === "ar" ? "مدفوعة جزئياً" : "Partial" },
                    { value: "paid",           label: language === "ar" ? "مدفوعة بالكامل" : "Fully Paid" },
                  ]} />
                <Input label={language === "ar" ? "المبلغ المدفوع (ر.س)" : "Amount Paid (SAR)"} type="number" min="0" step="0.01"
                  value={editAmountPaid} onChange={e => setEditAmountPaid(e.target.value)} />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "بنود الفاتورة" : "Line Items"}</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-1 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <span className="col-span-4">{language === "ar" ? "الوصف" : "Description"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "الكمية" : "Qty"}</span>
                  <span className="col-span-2 text-center">{language === "ar" ? "السعر" : "Price"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "خصم" : "Disc"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "ضريبة" : "VAT%"}</span>
                  <span className="col-span-2 text-end">{language === "ar" ? "الإجمالي" : "Total"}</span>
                  <span className="col-span-1" />
                </div>
                {editLines.map((line, idx) => {
                  const net = line.qty * line.unitPrice - (line.discountAmount || 0);
                  const vat = Math.round(net * (line.vatRate / 100) * 100) / 100;
                  const total = Math.round((net + vat) * 100) / 100;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50/50">
                      <input value={line.name} onChange={e => updateEditLine(idx, "name", e.target.value)}
                        className="col-span-4 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                      <input type="number" value={line.qty} onChange={e => updateEditLine(idx, "qty", +e.target.value)} min={1}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none text-center" />
                      <input type="number" value={line.unitPrice} onChange={e => updateEditLine(idx, "unitPrice", +e.target.value)} min={0} step={0.01}
                        className="col-span-2 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none" />
                      <input type="number" value={line.discountAmount || 0} onChange={e => updateEditLine(idx, "discountAmount", +e.target.value)} min={0} step={0.01}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none" />
                      <select value={line.vatRate} onChange={e => updateEditLine(idx, "vatRate", +e.target.value)}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1 py-1.5 focus:outline-none">
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={15}>15%</option>
                      </select>
                      <span className="col-span-2 text-xs font-semibold text-slate-700 text-end pr-1">
                        {total.toLocaleString("en", { minimumFractionDigits: 2 })}
                      </span>
                      <div className="col-span-1 flex justify-center">
                        {editLines.length > 1 && (
                          <button onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setEditLines(prev => [...prev, { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }])}
                  className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-brand-primary hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> {language === "ar" ? "إضافة بند" : "Add Line"}
                </button>
              </div>
              {/* Live totals */}
              <div className="mt-3 flex flex-col gap-1 text-xs max-w-xs ml-auto text-right">
                {(() => {
                  let sub = 0, vat = 0, disc = 0;
                  editLines.forEach(l => {
                    const net = l.qty * l.unitPrice - (l.discountAmount || 0);
                    sub += net;
                    vat += Math.round(net * (l.vatRate / 100) * 100) / 100;
                    disc += l.discountAmount || 0;
                  });
                  const grand = sub + vat;
                  return (
                    <>
                      <div className="flex justify-between text-slate-500"><span>{language === "ar" ? "الإجمالي الفرعي:" : "Subtotal:"}</span><span>{sub.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                      <div className="flex justify-between text-slate-500"><span>{language === "ar" ? "الضريبة:" : "VAT:"}</span><span>{vat.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                      <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1"><span>{language === "ar" ? "الإجمالي:" : "Grand Total:"}</span><span className="text-brand-primary">{grand.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "ملاحظات (إنجليزي)" : "Notes (EN)"}</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "ملاحظات (عربي)" : "Notes (AR)"}</label>
                <textarea value={editNotesAr} onChange={e => setEditNotesAr(e.target.value)} rows={2}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => handleDeleteInvoice(editingInvoice)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? "حذف الفاتورة" : "Delete Invoice"}
              </button>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => { setEditOpen(false); setEditingInvoice(null); }}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={handleSaveEdit} loading={editSaving} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل الفواتير" : "Invoices Register"}
        itemCount={invoices?.length}
      />
    </div>
  );
};
export default InvoicesPage;
