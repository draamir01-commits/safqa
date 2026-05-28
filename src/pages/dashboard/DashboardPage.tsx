import * as React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Plus, BarChart3, AlertOctagon, Sparkles, Users
} from "lucide-react";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, listenPendingMembers } from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [expenses, setExpenses] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [pendingMembers, setPendingMembers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!currentCompany) return;

    setLoading(true);
    const unsubInvoices = listenCompanyCollection(currentCompany.id, "invoices", (data) => {
      setInvoices(data);
    });
    const unsubExpenses = listenCompanyCollection(currentCompany.id, "expenses", (data) => {
      setExpenses(data);
    });
    const unsubProducts = listenCompanyCollection(currentCompany.id, "products", (data) => {
      setProducts(data);
      setLoading(false);
    });
    const unsubPending = listenPendingMembers(currentCompany.id, (data) => {
      setPendingMembers(data);
    });

    return () => {
      unsubInvoices();
      unsubExpenses();
      unsubProducts();
      unsubPending();
    };
  }, [currentCompany]);

  // Calculations
  const calculations = React.useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Paid Invoices sum (monthly)
    const monthlyRevenue = invoices
      .filter(inv => {
        const date = new Date(inv.issueDate);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear && inv.status === "paid";
      })
      .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);

    // 2. Expenses (monthly)
    const monthlyExpenses = expenses
      .filter(exp => {
        const date = new Date(exp.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);

    // 3. Outstanding Unpaid grand sum
    const totalOutstanding = invoices
      .filter(inv => inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "draft")
      .reduce((sum, inv) => sum + ((inv.grandTotal - (inv.amountPaid || 0)) || 0), 0);

    // 4. Overdue grand sum
    const totalOverdue = invoices
      .filter(inv => {
        const due = new Date(inv.dueDate);
        return inv.status !== "paid" && inv.status !== "cancelled" && inv.status !== "draft" && due < now;
      })
      .reduce((sum, inv) => sum + ((inv.grandTotal - (inv.amountPaid || 0)) || 0), 0);

    // 5. VAT calculations (Collected vs Paid)
    const vatCollected = invoices
      .filter(inv => inv.status === "paid" || inv.status === "approved" || inv.status === "reported")
      .reduce((sum, inv) => sum + (inv.totalVat || 0), 0);

    const vatPaid = expenses
      .reduce((sum, exp) => sum + (exp.vatAmount || 0), 0);

    const netVatDue = vatCollected - vatPaid;

    return {
      monthlyRevenue,
      monthlyExpenses,
      netProfit: monthlyRevenue - monthlyExpenses,
      totalOutstanding,
      totalOverdue,
      vatCollected,
      vatPaid,
      netVatDue
    };
  }, [invoices, expenses]);

  const stats = calculations;

  // Find depleted/low inventory alerts
  const lowStockThreshold = 5;
  const lowStockItems = products.filter(p => p.trackInventory && p.stockQty <= (p.lowStockThreshold || lowStockThreshold));

  return (
    <div className="flex flex-col gap-6 font-sans">

      {/* Pending members banner */}
      {pendingMembers.length > 0 && (
        <Link to="/users" className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 hover:bg-amber-100 transition-colors">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {language === "ar"
                ? `${pendingMembers.length} طلب وصول جديد في انتظار موافقتك`
                : `${pendingMembers.length} pending access request${pendingMembers.length > 1 ? "s" : ""} awaiting your approval`}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {language === "ar" ? "انقر للمراجعة والموافقة أو الرفض" : "Click to review and approve or reject"}
            </p>
          </div>
          <span className="text-xs font-bold text-amber-700 bg-amber-200 px-3 py-1 rounded-full">
            {language === "ar" ? "مراجعة" : "Review"}
          </span>
        </Link>
      )}

      {/* Greetings block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            {language === "ar" ? "أهلاً بك في صفقة" : "Welcome to Safqa"}
            <Sparkles className="h-5 w-5 text-amber-500 fill-amber-300" />
          </h2>
          <p className="text-xs text-slate-500">
            {language === "ar" 
              ? `إليك نظرة شاملة على حسابات منشأة ${currentCompany?.nameAr || currentCompany?.name}` 
              : `Operational fiscal overview for ${currentCompany?.name}.`}
          </p>
        </div>

        {/* Quick Action triggers */}
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/invoices/new">
            <Button size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("invoice.new")}
            </Button>
          </Link>
          <Link to="/expenses">
            <Button variant="secondary" size="sm" className="flex items-center gap-2 bg-white">
              <Plus className="h-4 w-4 text-emerald-500" />
              {language === "ar" ? "تسجيل مصاريف" : "Record Expense"}
            </Button>
          </Link>
          <Link to="/customers">
            <Button variant="secondary" size="sm" className="flex items-center gap-2 bg-white">
              <Plus className="h-4 w-4 text-brand-primary" />
              {language === "ar" ? "عميل جديد" : "New Customer"}
            </Button>
          </Link>
        </div>
      </div>

      {/* TOP STATS CARD MATRIX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Card */}
        <div className="bg-white border text-right rtl:text-right ltr:text-left border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {language === "ar" ? "المبيعات المحصلة هذا الشهر" : "Collected Revenue"}
            </span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div>
            <CurrencyDisplay amount={stats.monthlyRevenue} className="text-2xl font-bold text-slate-800" />
            <p className="text-[10px] text-slate-400 mt-1">Based on cleared & paid receipts</p>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white border text-right rtl:text-right ltr:text-left border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {language === "ar" ? "المصاريف التشغيلية" : "Expenses (This Month)"}
            </span>
            <div className="p-1.5 rounded-md bg-red-50 text-brand-danger">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
          <div>
            <CurrencyDisplay amount={stats.monthlyExpenses} className="text-2xl font-bold text-slate-800" />
            <p className="text-[10px] text-slate-400 mt-1">Sum of approved receipts</p>
          </div>
        </div>

        {/* Profit Card */}
        <div className="bg-white border text-right rtl:text-right ltr:text-left border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {language === "ar" ? "صافي الأرباح التشغيلية" : "Operating Net Margin"}
            </span>
            <div className="p-1.5 rounded-md bg-blue-50 text-brand-primary">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div>
            <CurrencyDisplay 
              amount={stats.netProfit} 
              className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-brand-danger'}`} 
            />
            <p className="text-[10px] text-slate-400 mt-1">Estimated monthly margin</p>
          </div>
        </div>

        {/* Outstanding Card */}
        <div className="bg-white border text-right rtl:text-right ltr:text-left border-slate-200 p-5 rounded-lg shadow-xs flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">
              {language === "ar" ? "الذمم والمخاطر المتأخرة" : "AR Outstanding Debt"}
            </span>
            <div className="p-1.5 rounded-md bg-amber-50 text-brand-warning">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div>
            <CurrencyDisplay amount={stats.totalOutstanding} className="text-2xl font-bold text-slate-800" />
            <p className="text-[10px] text-red-500 font-medium mt-1">
              {language === "ar" ? `منها ${formatCurrency(stats.totalOverdue, language)} متأخرة الدفع` : `${formatCurrency(stats.totalOverdue, language)} are overdue`}
            </p>
          </div>
        </div>
      </div>

      {/* SECOND ROW - VAT DISCLOSURES */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-lg p-6 shadow-sm border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div>
          <h3 className="text-base font-bold text-teal-400 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {language === "ar" ? "الإفصاح الضريبي لضريبة القيمة المضافة الكبرى" : "ZATCA VAT Statement Summary"}
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            {language === "ar" 
              ? "حساب مؤقت لتقرير الربع المالي الجاري بموجب الفواتير المعتمدة والمصاريف المتكاملة." 
              : "Temporary summary reflecting direct sales and purchase invoices ledger values."}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 shrink-0 text-right">
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-400">
              {language === "ar" ? "الضريبة المحصلة" : "VAT Collected (Output)"}
            </p>
            <CurrencyDisplay amount={stats.vatCollected} className="text-lg font-bold text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-slate-400">
              {language === "ar" ? "الضريبة المدفوعة" : "VAT Paid (Input)"}
            </p>
            <CurrencyDisplay amount={stats.vatPaid} className="text-lg font-bold text-red-400" />
          </div>
          <div className="border-l border-slate-700 ltr:border-l rtl:border-l-0 rtl:border-r pl-4 rtl:pl-0 rtl:pr-4">
            <p className="text-[10px] uppercase font-semibold text-slate-400">
              {language === "ar" ? "مستحق السداد للهيئة" : "Net Due to ZATCA"}
            </p>
            <CurrencyDisplay amount={stats.netVatDue} className="text-lg font-bold text-teal-400" />
          </div>
        </div>
      </div>

      {/* MIDDLE CONTAINER - DATA GRID & LOW STOCK ITEMS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Recent Invoices Table */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 flex flex-col gap-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">
              {language === "ar" ? "آخر الفواتير الصادرة" : "Recent Invoices Ledger"}
            </h3>
            <Link to="/invoices" className="text-xs font-bold text-brand-primary hover:underline">
              {language === "ar" ? "عرض الكل" : "View All"}
            </Link>
          </div>

          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-right rtl:text-right ltr:text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-slate-500 font-bold uppercase">{t("invoice.number")}</th>
                  <th className="px-3 py-2 text-slate-500 font-bold uppercase">{t("invoice.customer")}</th>
                  <th className="px-3 py-2 text-slate-500 font-bold uppercase">{t("invoice.total")}</th>
                  <th className="px-3 py-2 text-slate-500 font-bold uppercase">{t("invoice.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length > 0 ? (
                  invoices.slice(0, 5).map((inv, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-bold text-slate-800">
                        <Link to={`/invoices`} className="text-brand-primary hover:underline">{inv.invoiceNumber}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {language === "ar" ? inv.customerNameAr || inv.customerName : inv.customerName}
                      </td>
                      <td className="px-3 py-2.5">
                        <CurrencyDisplay amount={inv.grandTotal} />
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={inv.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      No invoices created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Inventory Warnings Column */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 flex flex-col gap-4 shadow-xs">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <AlertOctagon className="h-4.5 w-4.5 text-brand-warning" />
            {language === "ar" ? "سلع منخفضة المخزون" : "Inventory Low Stocks Alert"}
          </h3>

          <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto">
            {lowStockItems.length > 0 ? (
              lowStockItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded-md border-slate-150 bg-slate-50">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">
                      {language === "ar" ? item.nameAr || item.name : item.name}
                    </span>
                    <span className="text-[10px] text-slate-400">SKU: {item.sku || "N/A"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-red-650 px-2 py-0.5 bg-red-50 rounded">
                      {item.stockQty} {item.unit || "Pcs"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs">
                {language === "ar" ? "مستوى المخزون سليم بالكامل ✅" : "All inventories are healthy ✅"}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
export default DashboardPage;
