import * as React from "react";
import { BarChart3, TrendingUp, TrendingDown, Calendar, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { listenCompanyCollection } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { formatCurrency } from "../../utils/formatters";
import { Invoice, Expense, Bill } from "../../types";
import { ExportMenu, ExportSection } from "../../components/ui/ExportMenu";
import { PrintManager } from "../../components/ui/PrintManager";
import { Letterhead } from "../../components/ui/Letterhead";

export const ReportsPage: React.FC = () => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [activeReport, setActiveReport] = React.useState<"pl" | "balance" | "vat">("pl");
  const [showPrint, setShowPrint] = React.useState(false);
  const [dateRange, setDateRange] = React.useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });
  const [filterProject, setFilterProject] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "invoices", d => setInvoices(d as Invoice[]));
    const u2 = listenCompanyCollection(currentCompany.id, "expenses", d => setExpenses(d as Expense[]));
    const u3 = listenCompanyCollection(currentCompany.id, "bills", d => setBills(d as Bill[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const statement = React.useMemo(() => {
    const s = new Date(dateRange.start), e = new Date(dateRange.end);
    const filtInvoices = invoices.filter(i => {
      const d = new Date(i.issueDate);
      return d >= s && d <= e && i.status !== "draft" && i.status !== "cancelled";
    });
    const filtExpenses = expenses.filter(i => { const d = new Date(i.date || i.createdAt); return d >= s && d <= e; });
    const filtBills = bills.filter(b => { const d = new Date(b.issueDate); return d >= s && d <= e && b.status !== "draft"; });

    const revenue = filtInvoices.reduce((sum, i) => sum + (i.subtotal - i.totalDiscount), 0);
    const costOfGoods = filtBills.reduce((sum, b) => sum + b.subtotal, 0);
    const grossProfit = revenue - costOfGoods;
    const operatingExpenses = filtExpenses.reduce((sum, e) => sum + (e.amountBeforeVat || e.amount || 0), 0);
    const netProfit = grossProfit - operatingExpenses;
    const vatCollected = filtInvoices.reduce((sum, i) => sum + i.totalVat, 0);
    const vatPaid = filtExpenses.reduce((sum, e) => sum + (e.vatAmount || 0), 0) + filtBills.reduce((sum, b) => sum + b.totalVat, 0);

    return { revenue, costOfGoods, grossProfit, operatingExpenses, netProfit, vatCollected, vatPaid, netVat: vatCollected - vatPaid,
      grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : "0",
      netMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : "0",
      invoiceCount: filtInvoices.length, expenseCount: filtExpenses.length + filtBills.length,
    };
  }, [invoices, expenses, bills, dateRange]);

  // Monthly chart data
  const chartData = React.useMemo(() => {
    const months: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    invoices.filter(i => i.status !== "draft" && i.status !== "cancelled").forEach(i => {
      const m = i.issueDate?.slice(0, 7) || "";
      if (!months[m]) months[m] = { month: m, revenue: 0, expenses: 0, profit: 0 };
      months[m].revenue += i.subtotal - i.totalDiscount;
    });
    expenses.forEach(e => {
      const m = (e.date || "").slice(0, 7);
      if (!months[m]) months[m] = { month: m, revenue: 0, expenses: 0, profit: 0 };
      months[m].expenses += e.amountBeforeVat || e.amount || 0;
    });
    Object.values(months).forEach(m => { m.profit = m.revenue - m.expenses; });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
  }, [invoices, expenses]);

  const reportTabs = [
    { id: "pl", labelEn: "Profit & Loss", labelAr: "الأرباح والخسائر" },
    { id: "balance", labelEn: "Balance Sheet", labelAr: "الميزانية العمومية" },
    { id: "vat", labelEn: "VAT Summary", labelAr: "ملخص الضريبة" },
  ];

  const exportSections: ExportSection[] = [
    {
      title: language === "ar" ? "قائمة الأرباح والخسائر" : "Profit & Loss Statement",
      data: [
        { item: language === "ar" ? "الإيرادات" : "Revenue", amount: statement.revenue },
        { item: language === "ar" ? "تكلفة البضاعة" : "Cost of Goods", amount: statement.costOfGoods },
        { item: language === "ar" ? "مجمل الربح" : "Gross Profit", amount: statement.grossProfit },
        { item: language === "ar" ? "المصاريف التشغيلية" : "Operating Expenses", amount: statement.operatingExpenses },
        { item: language === "ar" ? "صافي الربح" : "Net Profit", amount: statement.netProfit },
      ],
      headers: ["item", "amount"],
    },
    {
      title: language === "ar" ? "ملخص ضريبة القيمة المضافة" : "VAT Summary",
      data: [
        { item: language === "ar" ? "ضريبة المبيعات المحصلة" : "Output VAT Collected", amount: statement.vatCollected },
        { item: language === "ar" ? "ضريبة المشتريات المدفوعة" : "Input VAT Paid", amount: statement.vatPaid },
        { item: language === "ar" ? "صافي ضريبة مستحقة" : "Net VAT Due", amount: statement.netVat },
      ],
      headers: ["item", "amount"],
    },
  ];

  const PLRow = ({ label, labelAr, value, bold = false, indent = false, highlight = false }: any) => (
    <div className={`flex justify-between py-2.5 border-b border-slate-100 last:border-0 ${highlight ? "bg-brand-primary/5 px-3 rounded-lg border-0 my-1" : ""} ${indent ? "ps-6" : ""}`}>
      <span className={`text-sm ${bold ? "font-bold text-slate-800" : "text-slate-600"}`}>{language === "ar" ? labelAr : label}</span>
      <span className={`text-sm font-semibold ${value < 0 ? "text-red-600" : highlight ? "text-brand-primary" : "text-slate-800"}`}>
        {formatCurrency(Math.abs(value), language)}{value < 0 ? ` (${language === "ar" ? "خسارة" : "Loss"})` : ""}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "التقارير المالية" : "Financial Reports"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "تقارير الأرباح والخسائر والميزانية العمومية وضريبة القيمة المضافة" : "P&L, Balance Sheet, and VAT summary reports"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={exportSections as any} filename={`financial-report-${dateRange.start}-to-${dateRange.end}`}
            label={language === "ar" ? "تصدير التقرير" : "Export Report"} />
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
        <Filter className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "من" : "From"}</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "إلى" : "To"}</label>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none" />
        </div>
        {/* Quick filters */}
        <div className="flex gap-1 ms-auto">
          {[
            { label: language === "ar" ? "هذا الشهر" : "This Month", start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0], end: new Date().toISOString().split("T")[0] },
            { label: language === "ar" ? "هذا الربع" : "This Quarter", start: new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3, 1).toISOString().split("T")[0], end: new Date().toISOString().split("T")[0] },
            { label: language === "ar" ? "هذه السنة" : "This Year", start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], end: new Date().toISOString().split("T")[0] },
          ].map(q => (
            <button key={q.label} onClick={() => setDateRange({ start: q.start, end: q.end })}
              className="px-2 py-1 text-[10px] font-semibold border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors">
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { labelEn: "Revenue", labelAr: "الإيرادات", value: statement.revenue, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { labelEn: "Expenses", labelAr: "المصاريف", value: statement.operatingExpenses + statement.costOfGoods, icon: TrendingDown, color: "text-red-500", bg: "bg-red-50" },
          { labelEn: "Net Profit", labelAr: "صافي الربح", value: statement.netProfit, icon: BarChart3, color: statement.netProfit >= 0 ? "text-brand-primary" : "text-red-600", bg: "bg-blue-50" },
          { labelEn: "Net Margin", labelAr: "هامش الربح", value: `${statement.netMargin}%`, icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", isText: true },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={`${k.bg} rounded-xl p-4 border border-slate-200`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">{language === "ar" ? k.labelAr : k.labelEn}</p>
                <Icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className={`text-xl font-bold ${k.color}`}>{k.isText ? k.value : formatCurrency(k.value as number, language)}</p>
            </div>
          );
        })}
      </div>

      {/* Report tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {reportTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveReport(tab.id as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeReport === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {language === "ar" ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* P&L Report */}
      {activeReport === "pl" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <Letterhead />
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">{language === "ar" ? "قائمة الأرباح والخسائر" : "Profit & Loss Statement"}</h3>
              <span className="text-xs text-slate-400">{dateRange.start} — {dateRange.end}</span>
            </div>
            <div className="space-y-1">
              <PLRow label="Revenue" labelAr="الإيرادات" value={statement.revenue} bold />
              <PLRow label="Cost of Goods Sold" labelAr="تكلفة البضاعة المباعة" value={statement.costOfGoods} indent />
              <PLRow label="Gross Profit" labelAr="مجمل الربح" value={statement.grossProfit} bold highlight />
              <PLRow label="Operating Expenses" labelAr="المصاريف التشغيلية" value={statement.operatingExpenses} indent />
              <PLRow label="Net Profit / (Loss)" labelAr="صافي الربح / (الخسارة)" value={statement.netProfit} bold highlight />
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="font-bold text-slate-800 mb-4 text-sm">{language === "ar" ? "الإيرادات مقابل المصاريف" : "Revenue vs Expenses"}</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v, language)} />
                <Legend />
                <Bar dataKey="revenue" name={language === "ar" ? "إيرادات" : "Revenue"} fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name={language === "ar" ? "مصاريف" : "Expenses"} fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Balance Sheet */}
      {activeReport === "balance" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <Letterhead />
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800">{language === "ar" ? "الميزانية العمومية التقريبية" : "Approximate Balance Sheet"}</h3>
            <span className="text-xs text-slate-400">{language === "ar" ? "تقديري — بناءً على البيانات المتاحة" : "Indicative — based on available data"}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{language === "ar" ? "الأصول" : "Assets"}</h4>
              <PLRow label="Accounts Receivable (Unpaid Invoices)" labelAr="الذمم المدينة (فواتير غير مدفوعة)" value={invoices.filter(i => i.status === "issued" || i.status === "overdue").reduce((s, i) => s + i.grandTotal, 0)} />
              <PLRow label="Total Revenue (YTD)" labelAr="إجمالي الإيرادات" value={invoices.filter(i => i.status !== "draft" && i.status !== "cancelled").reduce((s, i) => s + i.grandTotal, 0)} bold />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{language === "ar" ? "الالتزامات" : "Liabilities"}</h4>
              <PLRow label="Accounts Payable (Unpaid Bills)" labelAr="الذمم الدائنة (فواتير غير مدفوعة)" value={bills.filter(b => b.status === "received" || b.status === "overdue").reduce((s, b) => s + b.grandTotal, 0)} />
              <PLRow label="Total Expenses" labelAr="إجمالي المصاريف" value={expenses.reduce((s, e) => s + (e.totalAmount || 0), 0)} bold />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-xs text-amber-800">
            {language === "ar" ? "ملاحظة: هذه الميزانية تقديرية. للحصول على ميزانية دقيقة، يُرجى استشارة محاسبك." : "Note: This balance sheet is indicative only. For an accurate balance sheet, please consult your accountant."}
          </div>
        </div>
      )}

      {/* VAT Summary */}
      {activeReport === "vat" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <Letterhead />
          <h3 className="font-bold text-slate-800 mb-4">{language === "ar" ? "ملخص ضريبة القيمة المضافة" : "VAT Summary"}</h3>
          <div className="space-y-2 max-w-md">
            <PLRow label="Output VAT (Sales)" labelAr="ضريبة المبيعات المحصلة" value={statement.vatCollected} />
            <PLRow label="Input VAT (Purchases)" labelAr="ضريبة المشتريات المدفوعة" value={statement.vatPaid} />
            <PLRow label="Net VAT Due to ZATCA" labelAr="صافي الضريبة المستحقة لزاتكا" value={statement.netVat} bold highlight />
          </div>
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" name="Profit" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <PrintManager isOpen={showPrint} onClose={() => setShowPrint(false)} title={`Financial Report — ${dateRange.start} to ${dateRange.end}`} />
    </div>
  );
};
export default ReportsPage;
