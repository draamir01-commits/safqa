import * as React from "react";
import { ShieldAlert, RefreshCw, CheckCircle, FileText, Clock, CreditCard, Paperclip, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, updateDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { Invoice, Expense, Bill } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportMenu } from "../../components/ui/ExportMenu";

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
    </div>
  );
};
export default VatReturnPage;
