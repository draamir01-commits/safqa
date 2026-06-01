import * as React from "react";
import { ShieldAlert, RefreshCw, CheckCircle, FileText, Clock, CreditCard, Paperclip, Plus, Printer, X} from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, updateDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { Invoice, Expense, Bill } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

type VatStatus = "Draft" | "Filed" | "Partially Paid" | "Paid" | "Refund Pending" | "Refund Received" | "Late Filed" | "Adjustment Required";

interface VatReturn {
  id: string;
  period: string;
  periodType: "monthly" | "quarterly";
  startDate: string;
  endDate: string;
  dueDate: string;
  filingDate?: string;
  status: VatStatus;
  salesStandardRated: number;
  salesZeroRated: number;
  salesStandardRatedVat: number;
  purchasesStandardRated: number;
  purchasesStandardRatedVat: number;
  netVatDue: number;
  vatPaidAmount?: number;
  paymentDate?: string;
  paymentReference?: string;
  paymentMethod?: string;
  notes?: string;
  invoiceCount: number;
  expenseCount: number;
  auditTrail: { action: string; by: string; at: string }[];
  createdBy: string;
  createdAt: any;
  updatedAt?: any;
}

const STATUS_CONFIG: Record<VatStatus, { color: string; bg: string }> = {
  "Draft":               { color: "text-slate-600",  bg: "bg-slate-100" },
  "Filed":               { color: "text-blue-700",   bg: "bg-blue-100" },
  "Partially Paid":      { color: "text-amber-700",  bg: "bg-amber-100" },
  "Paid":                { color: "text-emerald-700",bg: "bg-emerald-100" },
  "Refund Pending":      { color: "text-purple-700", bg: "bg-purple-100" },
  "Refund Received":     { color: "text-teal-700",   bg: "bg-teal-100" },
  "Late Filed":          { color: "text-red-700",    bg: "bg-red-100" },
  "Adjustment Required": { color: "text-orange-700", bg: "bg-orange-100" },
};

export const VatReturnPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [returns, setReturns] = React.useState<VatReturn[]>([]);
  const [loading, setLoading] = React.useState(false);

  // ── Export panel (same as invoices/quotations) ────────────────────────
  const [showExportPanel, setShowExportPanel] = React.useState(false);
  const [expLHMode, setExpLHMode] = React.useState<"none"|"header"|"full">("none");
  const [expLHId, setExpLHId] = React.useState("primary");
  const [expLogo, setExpLogo] = React.useState(true);
  const [expStamp, setExpStamp] = React.useState(false);
  const [expSigId, setExpSigId] = React.useState("");
  const [expIncludeSig, setExpIncludeSig] = React.useState(false);
  const [expSignatories, setExpSignatories] = React.useState<any[]>([]);
  const [expLetterheads, setExpLetterheads] = React.useState<any[]>([]);
  const [expGenerating, setExpGenerating] = React.useState(false);

  React.useEffect(() => {
    if (!showExportPanel) { setExpSignatories([]); setExpSigId(""); setExpIncludeSig(false); }
  }, [showExportPanel]);

  const openExportPanel = () => {
    const co = currentCompany as any;
    const lhs: any[] = [{ id: "primary", name: "Primary Letterhead", url: co?.fullLetterhead || "" }];
    (co?.additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setExpLetterheads(lhs);
    setExpLogo(co?.defaultShowLogo ?? !!(co?.logo));
    setExpStamp(co?.defaultShowStamp ?? !!(co?.stamp));
    if (co?.fullLetterhead) setExpLHMode("full");
    else if (co?.additionalLetterheads?.length) setExpLHMode("header");
    else setExpLHMode("none");
    if (currentCompany) {
      getDocs(query(collection(db, "companies", currentCompany.id, "signatories"), where("isActive", "==", true)))
        .then(snap => {
          const sigs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          setExpSignatories(sigs);
          if (sigs.length === 1) { setExpSigId(sigs[0].id); setExpIncludeSig(!!(sigs[0] as any).signatureUrl); }
          else if (co?.defaultSignatoryId) {
            const fnd = sigs.find((s: any) => s.id === co.defaultSignatoryId);
            if (fnd) { setExpSigId(fnd.id); setExpIncludeSig(!!(fnd as any).signatureUrl); }
          }
        }).catch(() => {});
    }
    setShowExportPanel(true);
  };

  const [showPrint, setShowPrint] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [showPayment, setShowPayment] = React.useState(false);
  const [selected, setSelected] = React.useState<VatReturn | null>(null);
  const [periodType, setPeriodType] = React.useState<"monthly" | "quarterly">("quarterly");
  const [period, setPeriod] = React.useState("Q1");
  const [year, setYear] = React.useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [payAmount, setPayAmount] = React.useState("");
  const [payDate, setPayDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = React.useState("");
  const [payMethod, setPayMethod] = React.useState("Bank Transfer");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "invoices", d => setInvoices(d as Invoice[]));
    const u2 = listenCompanyCollection(currentCompany.id, "expenses", d => setExpenses(d as Expense[]));
    const u3 = listenCompanyCollection(currentCompany.id, "bills", d => setBills(d as Bill[]));
    const u4 = listenCompanyCollection(currentCompany.id, "vatReturns", d =>
      setReturns((d as VatReturn[]).sort((a, b) => b.period.localeCompare(a.period))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentCompany]);

  // Auto set dates
  React.useEffect(() => {
    const y = parseInt(year);
    if (periodType === "quarterly") {
      const ranges: Record<string, [string, string, string]> = {
        Q1: [`${y}-01-01`, `${y}-03-31`, `${y}-04-30`],
        Q2: [`${y}-04-01`, `${y}-06-30`, `${y}-07-31`],
        Q3: [`${y}-07-01`, `${y}-09-30`, `${y}-10-31`],
        Q4: [`${y}-10-01`, `${y}-12-31`, `${y+1}-01-31`],
      };
      const [,, due] = ranges[period] || ["","",""];
      setDueDate(due);
    }
  }, [period, year, periodType]);

  const getDateRange = () => {
    const y = parseInt(year);
    if (periodType === "quarterly") {
      const ranges: Record<string, [string, string]> = {
        Q1: [`${y}-01-01`, `${y}-03-31`],
        Q2: [`${y}-04-01`, `${y}-06-30`],
        Q3: [`${y}-07-01`, `${y}-09-30`],
        Q4: [`${y}-10-01`, `${y}-12-31`],
      };
      return ranges[period];
    } else {
      const m = parseInt(period);
      const start = `${y}-${String(m).padStart(2,"0")}-01`;
      const end = new Date(y, m, 0).toISOString().split("T")[0];
      return [start, end];
    }
  };

  const calc = React.useMemo(() => {
    const range = getDateRange();
    if (!range) return null;
    const [start, end] = range;
    const s = new Date(start), e = new Date(end);
    const periodInvoices = invoices.filter(i => { const d = new Date(i.issueDate); return d >= s && d <= e && i.status !== "draft" && i.status !== "cancelled"; });
    const periodExpenses = expenses.filter(i => { const d = new Date(i.date || i.createdAt); return d >= s && d <= e; });
    const periodBills = bills.filter(b => { const d = new Date(b.issueDate); return d >= s && d <= e && b.status !== "draft"; });
    const salesStandardRated = periodInvoices.reduce((s, i) => s + (i.subtotal - i.totalDiscount), 0);
    const salesStandardRatedVat = periodInvoices.reduce((s, i) => s + i.totalVat, 0);
    const purchasesVat = periodExpenses.reduce((s, e) => s + (e.vatAmount || 0), 0) + periodBills.reduce((s, b) => s + b.totalVat, 0);
    return {
      salesStandardRated: Math.round(salesStandardRated * 100) / 100,
      salesStandardRatedVat: Math.round(salesStandardRatedVat * 100) / 100,
      purchasesStandardRated: periodBills.reduce((s, b) => s + b.subtotal, 0),
      purchasesStandardRatedVat: Math.round(purchasesVat * 100) / 100,
      netVatDue: Math.round(Math.max(0, salesStandardRatedVat - purchasesVat) * 100) / 100,
      invoiceCount: periodInvoices.length,
      expenseCount: periodExpenses.length + periodBills.length,
    };
  }, [period, periodType, year, invoices, expenses, bills]);

  const handleSave = async () => {
    if (!calc || !currentCompany || !user) return;
    setLoading(true);
    try {
      const range = getDateRange()!;
      const periodLabel = periodType === "quarterly" ? `${period}-${year}` : `${year}-${String(parseInt(period)).padStart(2,"0")}`;
      await addDocument(`companies/${currentCompany.id}/vatReturns`, {
        period: periodLabel, periodType, startDate: range[0], endDate: range[1],
        dueDate, status: "Draft", ...calc, salesZeroRated: 0, vatPaidAmount: 0,
        notes, auditTrail: [{ action: "Created", by: user.email || user.uid, at: new Date().toISOString() }],
        createdBy: user.uid, createdAt: new Date(), updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم حفظ الإقرار الضريبي" : "VAT return saved");
      setShowForm(false); setNotes("");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleUpdateStatus = async (r: VatReturn, status: VatStatus) => {
    if (!currentCompany || !user) return;
    const trail = [...(r.auditTrail || []), { action: `Status → ${status}`, by: user.email || user.uid, at: new Date().toISOString() }];
    await updateDocument(`companies/${currentCompany.id}/vatReturns`, r.id, { status, auditTrail: trail, updatedAt: new Date() });
    toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
  };

  const handlePayment = async () => {
    if (!selected || !currentCompany || !user) return;
    const trail = [...(selected.auditTrail || []), { action: `Payment SAR ${payAmount} via ${payMethod}`, by: user.email || user.uid, at: new Date().toISOString() }];
    const newStatus: VatStatus = +payAmount >= selected.netVatDue ? "Paid" : "Partially Paid";
    await updateDocument(`companies/${currentCompany.id}/vatReturns`, selected.id, {
      vatPaidAmount: +payAmount, paymentDate: payDate, paymentReference: payRef, paymentMethod: payMethod,
      status: newStatus, auditTrail: trail, updatedAt: new Date(),
    });
    toast.success(language === "ar" ? "تم تسجيل الدفعة" : "Payment recorded");
    setShowPayment(false); setPayAmount(""); setPayRef("");
  };

  const statusBadge = (s: VatStatus) => {
    const cfg = STATUS_CONFIG[s] || STATUS_CONFIG["Draft"];
    return `${cfg.bg} ${cfg.color}`;
  };

  const isOverdue = (r: VatReturn) => r.dueDate && new Date(r.dueDate) < new Date() && r.status === "Draft";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "الإقرار الضريبي - ضريبة القيمة المضافة" : "VAT Return Filing"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "احتساب وتقديم الإقرار الضريبي لهيئة الزكاة والضريبة والجمارك" : "Calculate and file your VAT return with ZATCA"}</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu data={returns} filename="vat-returns" headers={{ period: "Period", netVatDue: "Net VAT Due", status: "Status", dueDate: "Due Date", vatPaidAmount: "Paid" }} />
          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "إقرار جديد" : "New Return"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: language === "ar" ? "إجمالي الإقرارات" : "Total Returns", value: returns.length, cls: "text-slate-800" },
          { label: language === "ar" ? "مقدّمة" : "Filed", value: returns.filter(r => r.status !== "Draft").length, cls: "text-blue-600" },
          { label: language === "ar" ? "مسدّدة" : "Paid", value: returns.filter(r => r.status === "Paid").length, cls: "text-emerald-600" },
          { label: language === "ar" ? "إجمالي الضريبة المستحقة" : "Total VAT Due", value: formatCurrency(returns.reduce((s, r) => s + r.netVatDue, 0), language), cls: "text-brand-primary", isText: true },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.cls}`}>{s.isText ? s.value : s.value}</p>
          </div>
        ))}
      </div>

      {/* Returns table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "الفترة" : "Period",
                language === "ar" ? "موعد الاستحقاق" : "Due Date",
                language === "ar" ? "مبيعات خاضعة" : "Taxable Sales",
                language === "ar" ? "ضريبة المبيعات" : "Output VAT",
                language === "ar" ? "ضريبة المشتريات" : "Input VAT",
                language === "ar" ? "صافي الضريبة" : "Net VAT Due",
                language === "ar" ? "المدفوع" : "Paid",
                language === "ar" ? "الحالة" : "Status",
                language === "ar" ? "إجراءات" : "Actions",
              ].map((h, i) => <th key={i} className="px-3 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {returns.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد إقرارات ضريبية" : "No VAT returns yet"}</td></tr>
            ) : returns.map(r => (
              <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${isOverdue(r) ? "bg-red-50/30" : ""}`}>
                <td className="px-3 py-3">
                  <p className="font-semibold text-brand-primary">{r.period}</p>
                  <p className="text-[10px] text-slate-400">{r.periodType === "monthly" ? (language === "ar" ? "شهري" : "Monthly") : (language === "ar" ? "ربع سنوي" : "Quarterly")}</p>
                </td>
                <td className="px-3 py-3">
                  <p className="text-xs text-slate-600">{r.dueDate}</p>
                  {isOverdue(r) && <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold"><Clock className="h-3 w-3" />{language === "ar" ? "متأخر!" : "OVERDUE!"}</span>}
                </td>
                <td className="px-3 py-3 text-xs">{formatCurrency(r.salesStandardRated, language)}</td>
                <td className="px-3 py-3 text-xs text-emerald-700 font-medium">{formatCurrency(r.salesStandardRatedVat, language)}</td>
                <td className="px-3 py-3 text-xs text-red-600 font-medium">{formatCurrency(r.purchasesStandardRatedVat, language)}</td>
                <td className="px-3 py-3 font-bold text-slate-800">{formatCurrency(r.netVatDue, language)}</td>
                <td className="px-3 py-3 text-xs text-emerald-600">{r.vatPaidAmount ? formatCurrency(r.vatPaidAmount, language) : "—"}</td>
                <td className="px-3 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(r.status)}`}>{r.status}</span></td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setSelected(r); setShowDetail(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded" title="Details"><FileText className="h-4 w-4" /></button>
                    {r.status === "Draft" && <button onClick={() => handleUpdateStatus(r, "Filed")} className="p-1 text-slate-400 hover:text-blue-600 rounded" title="File"><CheckCircle className="h-4 w-4" /></button>}
                    {(r.status === "Filed" || r.status === "Partially Paid") && (
                      <button onClick={() => { setSelected(r); setPayAmount(String(r.netVatDue - (r.vatPaidAmount || 0))); setShowPayment(true); }}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded" title="Record Payment"><CreditCard className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Return Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={language === "ar" ? "إقرار ضريبي جديد" : "New VAT Return"} size="lg">
        <div className="flex flex-col gap-5">
          <div className="flex gap-2">
            {(["quarterly", "monthly"] as const).map(pt => (
              <button key={pt} onClick={() => { setPeriodType(pt); setPeriod(pt === "quarterly" ? "Q1" : "1"); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors ${periodType === pt ? "bg-brand-primary text-white border-brand-primary" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
                {pt === "quarterly" ? (language === "ar" ? "ربع سنوي" : "Quarterly") : (language === "ar" ? "شهري" : "Monthly")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {periodType === "quarterly" ? (
              <Select label={language === "ar" ? "الربع" : "Quarter"} value={period} onChange={e => setPeriod(e.target.value)}
                options={[{ value: "Q1", label: "Q1 (Jan-Mar)" }, { value: "Q2", label: "Q2 (Apr-Jun)" }, { value: "Q3", label: "Q3 (Jul-Sep)" }, { value: "Q4", label: "Q4 (Oct-Dec)" }]} />
            ) : (
              <Select label={language === "ar" ? "الشهر" : "Month"} value={period} onChange={e => setPeriod(e.target.value)}
                options={[1,2,3,4,5,6,7,8,9,10,11,12].map(m => ({ value: String(m), label: new Date(2024,m-1).toLocaleString("en", { month: "long" }) }))} />
            )}
            <Select label={language === "ar" ? "السنة" : "Year"} value={year} onChange={e => setYear(e.target.value)}
              options={[2023,2024,2025,2026].map(y => ({ value: String(y), label: String(y) }))} />
            <Input label={language === "ar" ? "تاريخ الاستحقاق" : "Due Date"} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          {calc && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 font-medium">
                {language === "ar"
                  ? `تم تحليل ${calc.invoiceCount} فاتورة و ${calc.expenseCount} مصروف`
                  : `Analyzed ${calc.invoiceCount} invoices and ${calc.expenseCount} expense records`}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { labelAr: "المبيعات الخاضعة للضريبة", labelEn: "Taxable Sales", value: calc.salesStandardRated },
                  { labelAr: "ضريبة المبيعات (Output VAT)", labelEn: "Output VAT", value: calc.salesStandardRatedVat },
                  { labelAr: "المشتريات الخاضعة للضريبة", labelEn: "Taxable Purchases", value: calc.purchasesStandardRated },
                  { labelAr: "ضريبة المشتريات (Input VAT)", labelEn: "Input VAT", value: calc.purchasesStandardRatedVat },
                ].map((r, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{language === "ar" ? r.labelAr : r.labelEn}</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatCurrency(r.value, language)}</p>
                  </div>
                ))}
              </div>
              <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 flex justify-between items-center">
                <span className="font-bold text-slate-700">{language === "ar" ? "صافي الضريبة المستحقة" : "Net VAT Due to ZATCA"}</span>
                <span className="text-2xl font-bold text-brand-primary">{formatCurrency(calc.netVatDue, language)}</span>
              </div>
            </>
          )}

          <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={notes} onChange={e => setNotes(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading} disabled={!calc}>{language === "ar" ? "حفظ الإقرار" : "Save Return"}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={`${language === "ar" ? "تفاصيل الإقرار" : "Return Details"} — ${selected?.period}`} size="md">
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                { labelAr: "الفترة", labelEn: "Period", value: selected.period },
                { labelAr: "تاريخ الاستحقاق", labelEn: "Due Date", value: selected.dueDate },
                { labelAr: "تاريخ التقديم", labelEn: "Filed Date", value: selected.filingDate || "—" },
                { labelAr: "الحالة", labelEn: "Status", value: <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(selected.status)}`}>{selected.status}</span> },
              ].map((r, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{language === "ar" ? r.labelAr : r.labelEn}</p>
                  <p className="font-semibold mt-0.5">{r.value}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { labelAr: "مبيعات خاضعة", labelEn: "Taxable Sales", value: selected.salesStandardRated },
                { labelAr: "ضريبة المبيعات", labelEn: "Output VAT", value: selected.salesStandardRatedVat },
                { labelAr: "ضريبة المشتريات", labelEn: "Input VAT", value: selected.purchasesStandardRatedVat },
              ].map((r, i) => (
                <div key={i} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-600">{language === "ar" ? r.labelAr : r.labelEn}</span>
                  <span className="font-semibold">{formatCurrency(r.value, language)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-brand-primary pt-1">
                <span>{language === "ar" ? "صافي الضريبة المستحقة" : "Net VAT Due"}</span>
                <span>{formatCurrency(selected.netVatDue, language)}</span>
              </div>
              {selected.vatPaidAmount ? (
                <div className="flex justify-between text-emerald-600">
                  <span>{language === "ar" ? "المدفوع" : "Amount Paid"}</span>
                  <span className="font-semibold">{formatCurrency(selected.vatPaidAmount, language)}</span>
                </div>
              ) : null}
            </div>
            {selected.auditTrail?.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{language === "ar" ? "سجل التدقيق" : "Audit Trail"}</p>
                {selected.auditTrail.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="text-slate-400 shrink-0">{new Date(t.at).toLocaleDateString()}</span>
                    <span>{t.action}</span>
                    <span className="text-slate-400 ms-auto">{t.by}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between gap-2">
              {selected.status === "Draft" && (
                <Button onClick={() => { handleUpdateStatus(selected, "Filed"); setShowDetail(false); }} className="flex-1 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />{language === "ar" ? "تقديم الإقرار" : "Submit Return"}
                </Button>
              )}
              {(selected.status === "Filed" || selected.status === "Partially Paid") && (
                <Button onClick={() => { setShowDetail(false); setPayAmount(String(selected.netVatDue - (selected.vatPaidAmount || 0))); setShowPayment(true); }}
                  className="flex-1 flex items-center justify-center gap-2">
                  <CreditCard className="h-4 w-4" />{language === "ar" ? "تسجيل دفعة" : "Record Payment"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={showPayment} onClose={() => setShowPayment(false)} title={language === "ar" ? "تسجيل دفعة ضريبية" : "Record VAT Payment"}>
        <div className="flex flex-col gap-4">
          <div className="bg-slate-50 rounded-xl p-3 flex justify-between text-sm">
            <span className="text-slate-600">{language === "ar" ? "الضريبة المستحقة:" : "Net VAT Due:"}</span>
            <span className="font-bold text-brand-primary">{formatCurrency(selected?.netVatDue || 0, language)}</span>
          </div>
          <Input label={language === "ar" ? "المبلغ المدفوع (ر.س)" : "Amount Paid (SAR)"} type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} min="0" />
          <Input label={language === "ar" ? "تاريخ الدفع" : "Payment Date"} type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          <Input label={language === "ar" ? "رقم المرجع" : "Reference Number"} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="REF-001" />
          <Select label={language === "ar" ? "طريقة الدفع" : "Payment Method"} value={payMethod} onChange={e => setPayMethod(e.target.value)}
            options={["Bank Transfer","SADAD","Cash","Cheque"].map(m => ({ value: m, label: m }))} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPayment(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handlePayment} loading={loading}>{language === "ar" ? "تسجيل الدفعة" : "Record Payment"}</Button>
          </div>
        </div>
      </Modal>


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "إقرارات ضريبة القيمة" : "VAT Returns"}</p>
              </div>
              <button onClick={() => setShowExportPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto">

              {/* Letterhead */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "\u0627\u0644\u062a\u0631\u0648\u064a\u0633\u0629" : "Letterhead"}
                </p>
                <div className="space-y-2">
                  {([
                    { mode: "none",   icon: "\u2298", labelEn: "No Letterhead",      descEn: "Plain company text header" },
                    { mode: "header", icon: "\u25ac", labelEn: "Header + Footer",     descEn: "Banner image top & bottom" },
                    { mode: "full",   icon: "\u25ae", labelEn: "Full Page Letterhead", descEn: "Full A4 background every page" },
                  ] as const).map(opt => (
                    <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${expLHMode === opt.mode ? "border-brand-primary bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="radio" name="pgLHMode" checked={expLHMode === opt.mode} onChange={() => setExpLHMode(opt.mode)} className="mt-0.5 text-brand-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <span className="text-xs font-semibold text-slate-700">{opt.labelEn}</span>
                          {opt.mode === "full" && !(currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-amber-500 font-semibold">not uploaded</span>}
                          {opt.mode === "full" && (currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-emerald-500 font-semibold">\u2713 A4</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.descEn}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {expLHMode !== "none" && expLetterheads.length > 1 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold pl-1">Choose source:</p>
                    {expLetterheads.map((lh: any) => (
                      <label key={lh.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${expLHId === lh.id ? "border-brand-primary bg-blue-50" : "border-slate-100"}`}>
                        <input type="radio" checked={expLHId === lh.id} onChange={() => setExpLHId(lh.id)} className="text-brand-primary" />
                        {lh.url ? <img src={lh.url} alt={lh.name} className="h-7 object-contain rounded border border-slate-200 bg-white" /> : <div className="h-7 w-10 bg-slate-100 rounded border flex items-center justify-center"><FileText className="h-3 w-3 text-slate-300" /></div>}
                        <span className="text-xs font-medium text-slate-700">{lh.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Logo & Stamp */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "\u0627\u0644\u0634\u0639\u0627\u0631 \u0648\u0627\u0644\u062e\u062a\u0645" : "Logo & Stamp"}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Include Logo</span>
                      {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">No logo uploaded</p>}
                    </div>
                    <input type="checkbox" checked={expLogo} onChange={e => setExpLogo(e.target.checked)} disabled={!(currentCompany as any)?.logo} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Include Stamp</span>
                      {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">No stamp uploaded</p>}
                    </div>
                    <input type="checkbox" checked={expStamp} onChange={e => setExpStamp(e.target.checked)} disabled={!(currentCompany as any)?.stamp} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                </div>
              </div>

              {/* Signatory */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "\u0627\u0644\u062a\u0648\u0642\u064a\u0639 \u0627\u0644\u0645\u0641\u0648\u0636" : "Authorized Signatory"}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={expSigId} onChange={e => setExpSigId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">{language === "ar" ? "\u0628\u062f\u0648\u0646 \u062a\u0648\u0642\u064a\u0639" : "None"}</option>
                    {expSignatories.map((s: any) => <option key={s.id} value={s.id}>{s.name} \u2014 {s.designation}</option>)}
                  </select>
                  {expSigId && expSignatories.find((s: any) => s.id === expSigId)?.signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer mt-1">
                      <span className="text-xs text-slate-600">Include signature image</span>
                      <input type="checkbox" checked={expIncludeSig} onChange={e => setExpIncludeSig(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                  {expSignatories.length === 0 && <p className="text-[10px] text-slate-400">Add signatories in Settings</p>}
                </div>
              </div>

              {/* Summary strip */}
              {(expLHMode !== "none" || expLogo || expStamp || expSigId) && (
                <div className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 space-y-1">
                  <p className="font-bold text-white text-xs mb-2">PDF will include:</p>
                  {expLHMode === "full"   && <p>\u2713 Full page letterhead</p>}
                  {expLHMode === "header" && <p>\u2713 Header + footer banner</p>}
                  {expLogo && (currentCompany as any)?.logo && <p>\u2713 Company logo</p>}
                  {expStamp && (currentCompany as any)?.stamp && <p>\u2713 Company stamp</p>}
                  {expSigId && <p>\u2713 {expSignatories.find((s: any) => s.id === expSigId)?.name}</p>}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                disabled={expGenerating}
                onClick={async () => {
                  const win = window.open("", "_blank", "width=960,height=800");
                  if (!win) { toast.error("Please allow popups"); return; }
                  win.document.write("<html><body style='font-family:sans-serif;padding:40px;color:#555'>Generating PDF...</body></html>");
                  setExpGenerating(true);
                  setShowExportPanel(false);
                  try {
                    const co = currentCompany as any;
                    const selLH = expLetterheads.find((l: any) => l.id === expLHId) || expLetterheads[0];
                    const lhUrl = selLH?.url || co?.fullLetterhead || "";
                    const headerUrl = co?.headerAsset || co?.letterheadHeader || "";
                    const footerUrl = co?.footerAsset || co?.letterheadFooter || "";
                    const sigObj = expSignatories.find((s: any) => s.id === expSigId);
                    let padTop = "12mm", padBot = "22mm";
                    let headerHTML = "";
                    if (expLHMode === "full" && lhUrl) {
                      headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1"><img src="${lhUrl}" style="width:100%;height:100%;object-fit:fill"/></div>`;
                      padTop = "48mm";
                    } else if (expLHMode === "header") {
                      const hUrl = headerUrl || lhUrl;
                      if (hUrl) {
                        headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;z-index:5;line-height:0"><img src="${hUrl}" style="width:100%;max-height:50mm;object-fit:cover;display:block"/></div>`;
                        padTop = "55mm";
                      }
                    } else {
                      const leftLines = [co?.address, co?.city ? co.city+", KSA":"", co?.phone, co?.vatNumber?"VAT: "+co.vatNumber:""].filter(Boolean).map((l:string)=>`<div style="font-size:7.5pt;color:#444;line-height:1.7">${l}</div>`).join("");
                      headerHTML = `<table style="width:100%;border-bottom:2px solid #e2e8f0;margin-bottom:12px;border-collapse:collapse"><tr><td style="width:38%;vertical-align:top;padding-bottom:10px"><div style="font-size:11pt;font-weight:700;margin-bottom:4px">${co?.name||""}</div>${leftLines}</td><td style="width:24%;text-align:center;vertical-align:middle">${expLogo && co?.logo ? `<img src="${co.logo}" style="max-height:55px;max-width:110px;object-fit:contain;display:block;margin:0 auto"/>` : ""}</td><td style="width:38%;text-align:right;vertical-align:top;padding-bottom:10px"><div style="font-family:Cairo,Arial,sans-serif;font-size:11pt;font-weight:700;direction:rtl;margin-bottom:4px">${co?.nameAr||co?.name||""}</div></td></tr></table>`;
                    }
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>VAT Returns</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (returns as any[]).map((row: any, i: number) => {
                      const cells = [String(row.period||""), String(row.totalVatDue||""), String(row.status||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>VAT Returns</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>VAT Returns</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Period</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">VAT Due</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Status</th>",
                      "</tr></thead>",
                      `<tbody>${rows}</tbody>`,
                      "</table>",
                      sigHTML,
                      footerHTML,
                      "<script>window.onload=function(){setTimeout(function(){window.print()},1200)}</script>",
                      "</body></html>"
                    ].join("\n");
                    win.document.open(); win.document.write(html); win.document.close();
                  } catch(e) { win?.close(); toast.error("Failed to generate PDF"); }
                  finally { setExpGenerating(false); }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-brand-primary text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {expGenerating ? "Generating..." : (language === "ar" ? "\u062a\u062d\u0645\u064a\u0644 PDF" : "Download PDF")}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "إقرارات ضريبة القيمة" : "VAT Returns"}
        itemCount={returns?.length}
      />
    </div>
  );
};
export default VatReturnPage;
