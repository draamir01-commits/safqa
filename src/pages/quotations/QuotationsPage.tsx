import * as React from "react";
import {
  Plus, Eye, FileText, CheckCircle, XCircle, Clock,
  ArrowRight, Trash2, Send, Printer, Search, History,
  Copy, Edit, ChevronDown, ChevronUp, Briefcase, MapPin,
  Download, User
} from "lucide-react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import {
  listenCompanyCollection, addDocument, updateDocument,
  deleteDocument, getNextInvoiceNumber, saveInvoice
} from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import { calculateLineItem, calculateTotals } from "../../utils/vatCalculator";
import {
  Quotation, QuotationStatus, QuotationRevisionSnapshot,
  CustomerOrSupplier, Product, LineItem,
  InvoiceType, InvoiceStatus, ZatcaStatus
} from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft:     "bg-slate-100 text-slate-600",
  sent:      "bg-blue-100 text-blue-700",
  accepted:  "bg-emerald-100 text-emerald-700",
  rejected:  "bg-red-100 text-red-700",
  expired:   "bg-orange-100 text-orange-700",
  converted: "bg-purple-100 text-purple-700",
};

const PAYMENT_TERMS = ["Advance Payment", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Due on Receipt"];

const emptyLine = (): LineItem => ({
  productId: "", name: "", nameAr: "", qty: 1, unit: "PCE",
  unitPrice: 0, discountPercent: 0, discountAmount: 0,
  vatRate: 15, vatAmount: 0, lineTotal: 0,
});

export const QuotationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [quotations, setQuotations]   = React.useState<Quotation[]>([]);
  const [customers, setCustomers]     = React.useState<CustomerOrSupplier[]>([]);
  const [products, setProducts]       = React.useState<Product[]>([]);
  const [loading, setLoading]         = React.useState(false);
  const [showPrint, setShowPrint]     = React.useState(false);
  const [showForm, setShowForm]       = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selected, setSelected]       = React.useState<Quotation | null>(null);
  const [editingId, setEditingId]     = React.useState<string | null>(null);
  const [searchTerm, setSearchTerm]   = React.useState("");
  const [expandedHistory, setExpandedHistory] = React.useState<Set<string>>(new Set());

  // ── Form state ────────────────────────────────────────────────────────────
  const [customerId, setCustomerId]       = React.useState("");
  const [issueDate, setIssueDate]         = React.useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate]       = React.useState(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
  const [attn, setAttn]                   = React.useState("");
  const [clientPhone, setClientPhone]     = React.useState("");
  const [clientEmail, setClientEmail]     = React.useState("");
  const [location, setLocation]           = React.useState("");
  const [projectName, setProjectName]     = React.useState("");
  const [paymentTerms, setPaymentTerms]   = React.useState("Net 30");
  const [terms, setTerms]                 = React.useState("");
  const [notes, setNotes]                 = React.useState("");
  const [lines, setLines]                 = React.useState<LineItem[]>([emptyLine()]);
  const [activeFormTab, setActiveFormTab] = React.useState<"details" | "items" | "terms">("details");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "quotations", d =>
      setQuotations((d as Quotation[]).sort((a, b) =>
        new Date(b.createdAt?.toDate?.() || b.createdAt).getTime() -
        new Date(a.createdAt?.toDate?.() || a.createdAt).getTime()
      ))
    );
    const u2 = listenCompanyCollection(currentCompany.id, "customers", d => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "products",  d => setProducts(d as Product[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const totals = React.useMemo(() => calculateTotals(lines), [lines]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "productId") {
      const p = products.find(p => p.id === value);
      if (p) {
        updated[idx].name = p.name;
        updated[idx].nameAr = p.nameAr;
        updated[idx].unitPrice = p.salePrice;
        updated[idx].vatRate = p.vatRate;
      }
    }
    updated[idx] = calculateLineItem(updated[idx]);
    setLines(updated);
  };

  const resetForm = () => {
    setEditingId(null);
    setCustomerId(""); setAttn(""); setClientPhone(""); setClientEmail("");
    setLocation(""); setProjectName(""); setPaymentTerms("Net 30");
    setTerms(""); setNotes("");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setExpiryDate(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
    setLines([emptyLine()]);
    setActiveFormTab("details");
  };

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    setCustomerId(q.customerId); setAttn(q.attn || ""); setClientPhone(q.clientPhone || "");
    setClientEmail(q.clientEmail || ""); setLocation(q.location || "");
    setProjectName(q.projectName || ""); setPaymentTerms(q.paymentTerms || "Net 30");
    setTerms(q.terms || ""); setNotes(q.notes || "");
    setIssueDate(q.issueDate); setExpiryDate(q.expiryDate);
    setLines(q.lineItems.length ? q.lineItems : [emptyLine()]);
    setShowForm(true);
  };

  // ── Save (create or update) ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!customerId || !currentCompany || !user) return toast.error("Please select a customer");
    setLoading(true);
    try {
      const customer = customers.find(c => c.id === customerId)!;
      const data: any = {
        customerId, customerName: customer.name, customerNameAr: customer.nameAr,
        attn, clientPhone, clientEmail, location, projectName, paymentTerms, terms,
        issueDate, expiryDate, lineItems: lines, ...totals,
        currency: "SAR", notes, updatedAt: new Date(),
      };

      if (editingId) {
        await updateDocument(`companies/${currentCompany.id}/quotations`, editingId, data);
        toast.success(language === "ar" ? "تم تحديث عرض السعر" : "Quotation updated");
      } else {
        const qNum = "QUO-" + Date.now().toString().slice(-6);
        await addDocument(`companies/${currentCompany.id}/quotations`, {
          ...data, quotationNumber: qNum, revision: 0,
          revisionHistory: [], status: "draft",
          createdBy: user.uid, createdAt: new Date(),
        });
        toast.success(language === "ar" ? "تم إنشاء عرض السعر" : "Quotation created");
      }
      setShowForm(false);
      resetForm();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  // ── Revise ────────────────────────────────────────────────────────────────
  const handleRevise = async (q: Quotation) => {
    if (!currentCompany) return;
    // Snapshot current version
    const snapshot: QuotationRevisionSnapshot = {
      revision: q.revision || 0,
      quotationNumber: q.quotationNumber,
      savedAt: new Date().toISOString(),
      grandTotal: q.grandTotal,
      totalVat: q.totalVat,
      subtotal: q.subtotal,
      notes: q.notes,
    };
    const existingHistory = q.revisionHistory || [];
    const alreadySnapped = existingHistory.some(h => h.revision === (q.revision || 0));
    const newHistory = alreadySnapped ? existingHistory : [...existingHistory, snapshot];

    const nextRevision = (q.revision || 0) + 1;
    const baseNumber = q.quotationNumber.replace(/-R\d+$/, "");
    const newNumber = `${baseNumber}-R${nextRevision}`;

    // Update in Firestore — new revision number + history
    await updateDocument(`companies/${currentCompany.id}/quotations`, q.id, {
      revision: nextRevision,
      quotationNumber: newNumber,
      revisionHistory: newHistory,
      status: "draft",
      updatedAt: new Date(),
    });

    toast.success(language === "ar" ? `تم إنشاء المراجعة ${nextRevision}` : `Revision ${nextRevision} created`);
    // Open edit form for this revised quotation
    openEdit({ ...q, revision: nextRevision, quotationNumber: newNumber, revisionHistory: newHistory });
  };

  // ── Convert to invoice ────────────────────────────────────────────────────
  const handleConvertToInvoice = async (q: Quotation) => {
    if (!currentCompany || !user) return;
    setLoading(true);
    try {
      const invNum = await getNextInvoiceNumber(currentCompany.id);
      const invoiceId = uuidv4();
      await saveInvoice(currentCompany.id, invoiceId, {
        invoiceNumber: invNum, type: InvoiceType.STANDARD, status: InvoiceStatus.DRAFT,
        customerId: q.customerId, customerName: q.customerName, customerNameAr: q.customerNameAr,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        supplyDate: new Date().toISOString().split("T")[0],
        lineItems: q.lineItems, subtotal: q.subtotal,
        totalDiscount: q.totalDiscount, totalVat: q.totalVat, grandTotal: q.grandTotal,
        vatBreakdown: [], currency: "SAR",
        zatcaStatus: ZatcaStatus.NOT_SUBMITTED, zatcaPhase: currentCompany.zatcaPhase,
        paymentStatus: "unpaid", amountPaid: 0, amountDue: q.grandTotal,
        notes: q.notes, createdBy: user.uid, createdAt: new Date(), updatedAt: new Date(),
      });
      await updateDocument(`companies/${currentCompany.id}/quotations`, q.id, {
        status: "converted", convertedToInvoiceId: invoiceId, updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم تحويل عرض السعر إلى فاتورة" : "Converted to invoice");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany || !window.confirm(language === "ar" ? "حذف عرض السعر؟" : "Delete this quotation?")) return;
    await deleteDocument(`companies/${currentCompany.id}/quotations`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const handleStatusChange = async (q: Quotation, status: QuotationStatus) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/quotations`, q.id, { status, updatedAt: new Date() });
  };

  // ── Per-quotation PDF export ───────────────────────────────────────────────
  const exportQuotationPDF = async (q: Quotation) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pw, 30, "F");
    doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
    doc.text(currentCompany?.name || "Company", 14, 13);
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180);
    doc.text([currentCompany?.vatNumber ? `VAT: ${currentCompany.vatNumber}` : "", currentCompany?.phone || "", currentCompany?.city || ""].filter(Boolean).join("   "), 14, 22);
    y = 40;

    // Quotation info box
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("QUOTATION", 14, y); y += 8;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
    doc.text(`Number: ${q.quotationNumber}`, 14, y);
    doc.text(`Date: ${q.issueDate}`, pw / 2, y);
    y += 5;
    doc.text(`Valid Until: ${q.expiryDate}`, 14, y);
    if (q.revision > 0) doc.text(`Revision: ${q.revision}`, pw / 2, y);
    y += 5;
    if (q.projectName) { doc.text(`Project: ${q.projectName}`, 14, y); y += 5; }
    if (q.paymentTerms) { doc.text(`Payment Terms: ${q.paymentTerms}`, 14, y); y += 5; }
    y += 3;
    doc.setDrawColor(200); doc.line(14, y, pw - 14, y); y += 6;

    // Client info
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("TO:", 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(60);
    doc.text(language === "ar" ? q.customerNameAr || q.customerName : q.customerName, 14, y); y += 4;
    if (q.attn) { doc.text(`Attn: ${q.attn}`, 14, y); y += 4; }
    if (q.clientPhone) { doc.text(`Tel: ${q.clientPhone}`, 14, y); y += 4; }
    if (q.clientEmail) { doc.text(`Email: ${q.clientEmail}`, 14, y); y += 4; }
    if (q.location) { doc.text(`Location: ${q.location}`, 14, y); y += 4; }
    y += 4;

    // Line items table
    const body = q.lineItems.map((l, i) => [
      String(i + 1),
      language === "ar" ? l.nameAr || l.name : l.name,
      String(l.qty),
      l.unit,
      formatCurrency(l.unitPrice, language),
      `${l.vatRate}%`,
      formatCurrency(l.lineTotal, language),
    ]);

    autoTable(doc, {
      head: [["#", "Description", "Qty", "Unit", "Unit Price", "VAT %", "Total"]],
      body,
      startY: y,
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 7, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    // Totals
    const totalsData = [
      ["Subtotal", formatCurrency(q.subtotal, language)],
      ["VAT", formatCurrency(q.totalVat, language)],
      ["Grand Total", formatCurrency(q.grandTotal, language)],
    ];
    autoTable(doc, {
      body: totalsData,
      startY: y,
      theme: "plain",
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 40 }, 1: { halign: "right" } },
      margin: { left: pw - 80, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Notes & Terms
    if (q.notes) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Notes:", 14, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setTextColor(80);
      doc.text(q.notes, 14, y, { maxWidth: pw - 28 }); y += 10;
    }
    if (q.terms) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Terms & Conditions:", 14, y); y += 4;
      doc.setFont("helvetica", "normal"); doc.setTextColor(80);
      doc.text(q.terms, 14, y, { maxWidth: pw - 28 }); y += 10;
    }

    // Footer
    const ph = doc.internal.pageSize.getHeight();
    const total = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(150);
      doc.text(`Page ${i} of ${total}`, pw - 14, ph - 8, { align: "right" });
      doc.text("Safqa — ZATCA Compliant ERP", 14, ph - 8);
    }
    doc.save(`Quotation-${q.quotationNumber}.pdf`);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const statusLabel = (s: QuotationStatus) => {
    const map: Record<QuotationStatus, [string, string]> = {
      draft:     ["مسودة",  "Draft"],     sent:      ["مرسل",   "Sent"],
      accepted:  ["مقبول",  "Accepted"],  rejected:  ["مرفوض",  "Rejected"],
      expired:   ["منتهي",  "Expired"],   converted: ["محوّل",  "Converted"],
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  const filtered = quotations.filter(q => {
    const ql = searchTerm.toLowerCase();
    return (
      q.customerName.toLowerCase().includes(ql) ||
      (q.customerNameAr || "").includes(ql) ||
      q.quotationNumber.toLowerCase().includes(ql) ||
      (q.projectName || "").toLowerCase().includes(ql) ||
      (q.attn || "").toLowerCase().includes(ql) ||
      (q.location || "").toLowerCase().includes(ql)
    );
  });

  const toggleHistory = (id: string) => {
    setExpandedHistory(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const FORM_TABS = [
    { id: "details", labelEn: "Client & Dates",  labelAr: "العميل والتواريخ" },
    { id: "items",   labelEn: "Line Items",       labelAr: "البنود" },
    { id: "terms",   labelEn: "Terms & Notes",    labelAr: "الشروط والملاحظات" },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "عروض الأسعار" : "Quotations"}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{language === "ar" ? "إنشاء وإدارة عروض الأسعار والمراجعات" : "Create and manage quotations with revision tracking"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowPrint(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "طباعة" : "Print"}
          </button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "عرض سعر جديد" : "New Quotation"}
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {(["draft","sent","accepted","rejected","expired","converted"] as QuotationStatus[]).map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">{statusLabel(s)}</p>
            <p className="text-xl font-bold text-slate-800">{quotations.filter(q => q.status === s).length}</p>
          </div>
        ))}
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
          placeholder={language === "ar" ? "بحث باسم العميل أو رقم العرض أو المشروع..." : "Search by customer, number, project, or contact..."}
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 bg-white"
        />
      </div>

      {/* ── Cards ── */}
      <div className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-400 text-sm">{language === "ar" ? "لا توجد عروض أسعار" : "No quotations yet"}</p>
          </div>
        ) : filtered.map(q => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow">

            {/* Card main row */}
            <div className="flex items-start gap-4 px-5 py-4">

              {/* Icon */}
              <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="h-5 w-5 text-slate-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-brand-primary">{q.quotationNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_COLORS[q.status]}`}>
                    {statusLabel(q.status)}
                  </span>
                  {(q.revision || 0) > 0 && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-[10px] font-bold text-indigo-600">
                      <History className="h-3 w-3" /> Rev {q.revision}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-800 mt-1">{language === "ar" ? q.customerNameAr || q.customerName : q.customerName}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1">
                  {q.attn && <span className="flex items-center gap-1 text-xs text-slate-400"><User className="h-3 w-3" />{q.attn}</span>}
                  {q.projectName && <span className="flex items-center gap-1 text-xs text-indigo-500 font-medium"><Briefcase className="h-3 w-3" />{q.projectName}</span>}
                  {q.location && <span className="flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" />{q.location}</span>}
                  <span className="text-xs text-slate-400">{q.issueDate} → {q.expiryDate}</span>
                </div>
              </div>

              {/* Amount + actions */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <p className="text-lg font-bold text-slate-800">{formatCurrency(q.grandTotal, language)}</p>
                <div className="flex items-center gap-1">
                  {/* View */}
                  <button onClick={() => { setSelected(q); setShowPreview(true); }}
                    className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-colors" title="View">
                    <Eye className="h-4 w-4" />
                  </button>
                  {/* Edit */}
                  <button onClick={() => openEdit(q)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
                    <Edit className="h-4 w-4" />
                  </button>
                  {/* Revise */}
                  <button onClick={() => handleRevise(q)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title={language === "ar" ? "إنشاء مراجعة" : "Create Revision"}>
                    <Copy className="h-4 w-4" />
                  </button>
                  {/* Export PDF */}
                  <button onClick={() => exportQuotationPDF(q)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Export PDF">
                    <Download className="h-4 w-4" />
                  </button>
                  {/* Convert to Invoice */}
                  {q.status !== "converted" && q.status !== "rejected" && (
                    <button onClick={() => handleConvertToInvoice(q)}
                      className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title={language === "ar" ? "تحويل لفاتورة" : "Convert to Invoice"}>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                  {/* Mark sent */}
                  {q.status === "draft" && (
                    <button onClick={() => handleStatusChange(q, "sent")}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={language === "ar" ? "تعيين كمرسل" : "Mark Sent"}>
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                  {/* Accept / Reject */}
                  {q.status === "sent" && (
                    <>
                      <button onClick={() => handleStatusChange(q, "accepted")} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><CheckCircle className="h-4 w-4" /></button>
                      <button onClick={() => handleStatusChange(q, "rejected")} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><XCircle className="h-4 w-4" /></button>
                    </>
                  )}
                  {/* Delete */}
                  <button onClick={() => handleDelete(q.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Revision history toggle */}
            {(q.revisionHistory || []).length > 0 && (
              <div className="border-t border-slate-100">
                <button
                  onClick={() => toggleHistory(q.id)}
                  className="w-full flex items-center justify-between px-5 py-2 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <History className="h-3.5 w-3.5" />
                    {language === "ar" ? `${q.revisionHistory!.length} مراجعة سابقة` : `${q.revisionHistory!.length} previous revision${q.revisionHistory!.length > 1 ? "s" : ""}`}
                  </span>
                  {expandedHistory.has(q.id) ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {expandedHistory.has(q.id) && (
                  <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 space-y-2">
                    {[...(q.revisionHistory || [])].reverse().map((snap, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-indigo-600">R{snap.revision}</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">{snap.quotationNumber}</p>
                            <p className="text-[10px] text-slate-400">{language === "ar" ? "حُفظ:" : "Saved:"} {new Date(snap.savedAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-slate-600">{formatCurrency(snap.grandTotal, language)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Create/Edit Modal ── */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? (language === "ar" ? "تعديل عرض السعر" : "Edit Quotation") : (language === "ar" ? "عرض سعر جديد" : "New Quotation")}
        size="lg">
        <div className="flex flex-col gap-0">
          {/* Form tabs */}
          <div className="flex gap-0 border-b border-slate-200 mb-5 -mx-1">
            {FORM_TABS.map(tab => (
              <button key={tab.id} type="button" onClick={() => setActiveFormTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${activeFormTab === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                {language === "ar" ? tab.labelAr : tab.labelEn}
              </button>
            ))}
          </div>

          {/* Tab: Client & Dates */}
          {activeFormTab === "details" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label={language === "ar" ? "العميل *" : "Customer *"} value={customerId}
                  onChange={e => {
                    setCustomerId(e.target.value);
                    const c = customers.find(x => x.id === e.target.value);
                    if (c) { setClientPhone(c.phone || ""); setClientEmail(c.email || ""); }
                  }}
                  options={[{ value: "", label: language === "ar" ? "اختر عميل..." : "Select customer..." }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
                <Input label={language === "ar" ? "جهة الاتصال (Attn)" : "Attention (Attn)"} value={attn} onChange={e => setAttn(e.target.value)} placeholder={language === "ar" ? "اسم المسؤول" : "Contact person name"} />
                <Input label={language === "ar" ? "هاتف العميل" : "Client Phone"} value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+966 5XXXXXXXX" />
                <Input label={language === "ar" ? "بريد العميل" : "Client Email"} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="contact@client.com" />
                <Input label={language === "ar" ? "الموقع / المشروع" : "Location"} value={location} onChange={e => setLocation(e.target.value)} placeholder={language === "ar" ? "موقع المشروع" : "Project site location"} />
                <Input label={language === "ar" ? "اسم المشروع" : "Project Name"} value={projectName} onChange={e => setProjectName(e.target.value)} placeholder={language === "ar" ? "اسم المشروع" : "Project name"} />
                <Input label={language === "ar" ? "تاريخ الإصدار" : "Issue Date"} type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                <Input label={language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"} type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                <Select label={language === "ar" ? "شروط الدفع" : "Payment Terms"} value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  options={PAYMENT_TERMS.map(t => ({ value: t, label: t }))} />
              </div>
            </div>
          )}

          {/* Tab: Line Items */}
          {activeFormTab === "items" && (
            <div className="flex flex-col gap-3">
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">{language === "ar" ? "البنود" : "Line Items"} ({lines.length})</span>
                  <button onClick={() => setLines([...lines, emptyLine()])}
                    className="flex items-center gap-1 text-xs text-brand-primary font-semibold hover:underline">
                    <Plus className="h-3 w-3" /> {language === "ar" ? "إضافة بند" : "Add Item"}
                  </button>
                </div>
                {lines.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-3 border-b border-slate-50 last:border-0 items-center">
                    <select value={line.productId} onChange={e => updateLine(idx, "productId", e.target.value)}
                      className="col-span-4 text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-primary">
                      <option value="">{language === "ar" ? "اختر منتجاً" : "Select product"}</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" value={line.qty} onChange={e => updateLine(idx, "qty", +e.target.value)}
                      className="col-span-2 text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-primary text-center"
                      min={1} placeholder="Qty" />
                    <input type="number" value={line.unitPrice} onChange={e => updateLine(idx, "unitPrice", +e.target.value)}
                      className="col-span-2 text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      min={0} placeholder="Price" />
                    <select value={line.vatRate} onChange={e => updateLine(idx, "vatRate", +e.target.value)}
                      className="col-span-2 text-xs border border-slate-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-brand-primary">
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={15}>15%</option>
                    </select>
                    <div className="col-span-1 text-xs font-semibold text-slate-700 text-end">{formatCurrency(line.lineTotal, language)}</div>
                    <div className="col-span-1 flex justify-center">
                      {lines.length > 1 && (
                        <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "الإجمالي الفرعي" : "Subtotal"}</span><span>{formatCurrency(totals.subtotal, language)}</span></div>
                <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</span><span>{formatCurrency(totals.totalVat, language)}</span></div>
                <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-2"><span>{language === "ar" ? "الإجمالي" : "Total"}</span><span>{formatCurrency(totals.grandTotal, language)}</span></div>
              </div>
            </div>
          )}

          {/* Tab: Terms & Notes */}
          {activeFormTab === "terms" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">{language === "ar" ? "ملاحظات" : "Notes"}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder={language === "ar" ? "ملاحظات عامة على عرض السعر..." : "General notes for this quotation..."}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">{language === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}</label>
                <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={5}
                  placeholder={language === "ar" ? "الشروط والأحكام العامة لعرض السعر..." : "Terms and conditions printed at the bottom of the quotation..."}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
            <div className="flex gap-2">
              {FORM_TABS.filter(t => t.id !== activeFormTab).map(t => (
                <button key={t.id} type="button" onClick={() => setActiveFormTab(t.id as any)}
                  className="text-xs text-slate-400 hover:text-brand-primary transition-colors">
                  {language === "ar" ? t.labelAr : t.labelEn} →
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSave} loading={loading}>
                {editingId ? (language === "ar" ? "حفظ التعديلات" : "Save Changes") : (language === "ar" ? "حفظ عرض السعر" : "Save Quotation")}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Preview Modal ── */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}
        title={`${language === "ar" ? "عرض السعر" : "Quotation"} ${selected?.quotationNumber || ""}`}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-slate-400">{language === "ar" ? "العميل" : "Customer"}</p><p className="font-semibold">{language === "ar" ? selected.customerNameAr : selected.customerName}</p></div>
              <div><p className="text-xs text-slate-400">{language === "ar" ? "الحالة" : "Status"}</p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status]}`}>{statusLabel(selected.status)}</span></div>
              {selected.attn && <div><p className="text-xs text-slate-400">Attn</p><p className="font-medium">{selected.attn}</p></div>}
              {selected.projectName && <div><p className="text-xs text-slate-400">{language === "ar" ? "المشروع" : "Project"}</p><p className="font-medium text-indigo-600">{selected.projectName}</p></div>}
              {selected.location && <div><p className="text-xs text-slate-400">{language === "ar" ? "الموقع" : "Location"}</p><p className="font-medium">{selected.location}</p></div>}
              {selected.paymentTerms && <div><p className="text-xs text-slate-400">{language === "ar" ? "شروط الدفع" : "Payment Terms"}</p><p className="font-medium">{selected.paymentTerms}</p></div>}
              <div><p className="text-xs text-slate-400">{language === "ar" ? "تاريخ الإصدار" : "Issued"}</p><p>{selected.issueDate}</p></div>
              <div><p className="text-xs text-slate-400">{language === "ar" ? "صالح حتى" : "Expires"}</p><p>{selected.expiryDate}</p></div>
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-start text-slate-600">{language === "ar" ? "المنتج" : "Item"}</th>
                  <th className="px-3 py-2 text-center text-slate-600">{language === "ar" ? "الكمية" : "Qty"}</th>
                  <th className="px-3 py-2 text-end text-slate-600">{language === "ar" ? "السعر" : "Price"}</th>
                  <th className="px-3 py-2 text-end text-slate-600">{language === "ar" ? "الإجمالي" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {selected.lineItems.map((l, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2">{language === "ar" ? l.nameAr || l.name : l.name}</td>
                    <td className="px-3 py-2 text-center">{l.qty}</td>
                    <td className="px-3 py-2 text-end">{formatCurrency(l.unitPrice, language)}</td>
                    <td className="px-3 py-2 text-end font-semibold">{formatCurrency(l.lineTotal, language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-slate-500 text-xs"><span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</span><span>{formatCurrency(selected.totalVat, language)}</span></div>
              <div className="flex justify-between font-bold text-slate-800"><span>{language === "ar" ? "الإجمالي" : "Total"}</span><span>{formatCurrency(selected.grandTotal, language)}</span></div>
            </div>
            {selected.notes && <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700"><p className="font-semibold mb-1">{language === "ar" ? "ملاحظات" : "Notes"}</p><p>{selected.notes}</p></div>}
            {selected.terms && <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600"><p className="font-semibold mb-1">{language === "ar" ? "الشروط والأحكام" : "Terms"}</p><p className="whitespace-pre-wrap">{selected.terms}</p></div>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => exportQuotationPDF(selected)} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                {language === "ar" ? "تصدير PDF" : "Export PDF"}
              </Button>
              {selected.status !== "converted" && selected.status !== "rejected" && (
                <Button onClick={() => { handleConvertToInvoice(selected); setShowPreview(false); }} className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {language === "ar" ? "تحويل إلى فاتورة" : "Convert to Invoice"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل عروض الأسعار" : "Quotations Register"}
        itemCount={quotations?.length}
      />
    </div>
  );
};

export default QuotationsPage;
