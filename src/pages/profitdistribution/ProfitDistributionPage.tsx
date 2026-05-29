import * as React from "react";
import { Plus, Trash2, PieChart, CheckCircle, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, updateDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { ProfitDistribution, Invoice, Expense } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

export const ProfitDistributionPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [distributions, setDistributions] = React.useState<ProfitDistribution[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [period, setPeriod] = React.useState("Q1");
  const [year, setYear] = React.useState(new Date().getFullYear().toString());
  const [partners, setPartners] = React.useState([{ name: "", percentage: 50 }, { name: "", percentage: 50 }]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "profitDistributions", d => setDistributions((d as ProfitDistribution[]).sort((a, b) => b.period.localeCompare(a.period))));
    const u2 = listenCompanyCollection(currentCompany.id, "invoices", d => setInvoices(d as Invoice[]));
    const u3 = listenCompanyCollection(currentCompany.id, "expenses", d => setExpenses(d as Expense[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const calcPeriodFinancials = () => {
    const y = parseInt(year);
    const ranges: Record<string, [string, string]> = {
      Q1: [`${y}-01-01`, `${y}-03-31`], Q2: [`${y}-04-01`, `${y}-06-30`],
      Q3: [`${y}-07-01`, `${y}-09-30`], Q4: [`${y}-10-01`, `${y}-12-31`],
    };
    const [start, end] = ranges[period];
    const s = new Date(start), e = new Date(end);
    const rev = invoices.filter(i => { const d = new Date(i.issueDate); return d >= s && d <= e && i.status === "paid"; })
      .reduce((sum, i) => sum + (i.subtotal - i.totalDiscount), 0);
    const exp = expenses.filter(i => { const d = new Date(i.date || i.createdAt); return d >= s && d <= e; })
      .reduce((sum, i) => sum + i.amount, 0);
    return { totalRevenue: Math.round(rev * 100) / 100, totalExpenses: Math.round(exp * 100) / 100, netProfit: Math.round((rev - exp) * 100) / 100 };
  };

  const financials = React.useMemo(() => calcPeriodFinancials(), [period, year, invoices, expenses]);

  const totalPercentage = partners.reduce((s, p) => s + +p.percentage, 0);

  const handleSave = async () => {
    if (!currentCompany || !user) return;
    if (totalPercentage !== 100) return toast.error(language === "ar" ? "مجموع النسب يجب أن يساوي 100%" : "Percentages must total 100%");
    if (partners.some(p => !p.name)) return toast.error(language === "ar" ? "أدخل اسم كل شريك" : "Enter all partner names");
    setLoading(true);
    try {
      const enrichedPartners = partners.map(p => ({
        name: p.name,
        percentage: +p.percentage,
        amount: Math.round(financials.netProfit * (+p.percentage / 100) * 100) / 100,
      }));
      await addDocument(`companies/${currentCompany.id}/profitDistributions`, {
        period: `${period}-${year}`, ...financials,
        partners: enrichedPartners, status: "draft",
        createdBy: user.uid, createdAt: new Date(),
      });
      toast.success(language === "ar" ? "تم إنشاء توزيع الأرباح" : "Profit distribution created");
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (d: ProfitDistribution) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/profitDistributions`, d.id, { status: "approved", updatedAt: new Date() });
    toast.success(language === "ar" ? "تمت الموافقة" : "Approved");
  };

  const updatePartner = (idx: number, field: string, value: string) => {
    const updated = [...partners];
    updated[idx] = { ...updated[idx], [field]: field === "percentage" ? +value : value };
    setPartners(updated);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <PieChart className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "توزيع الأرباح" : "Profit Distribution"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "توزيع صافي الربح على الشركاء" : "Distribute net profit among business partners"}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={distributions} filename="profit-distributions" headers={{ period: "Period", netProfit: "Net Profit", status: "Status" }} />

          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "توزيع جديد" : "New Distribution"}
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "الفترة" : "Period", language === "ar" ? "الإيرادات" : "Revenue",
                language === "ar" ? "المصاريف" : "Expenses", language === "ar" ? "صافي الربح" : "Net Profit",
                language === "ar" ? "الشركاء" : "Partners", language === "ar" ? "الحالة" : "Status", ""].map((h, i) =>
                <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {distributions.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا يوجد توزيع أرباح" : "No distributions yet"}</td></tr>
            ) : distributions.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-brand-primary">{d.period}</td>
                <td className="px-4 py-3 text-emerald-600">{formatCurrency(d.totalRevenue, language)}</td>
                <td className="px-4 py-3 text-red-500">{formatCurrency(d.totalExpenses, language)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(d.netProfit, language)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    {d.partners.map((p, i) => (
                      <span key={i} className="text-xs text-slate-600">{p.name} — {p.percentage}% ({formatCurrency(p.amount, language)})</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {d.status === "approved" ? (language === "ar" ? "معتمد" : "Approved") : (language === "ar" ? "مسودة" : "Draft")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {d.status === "draft" && (
                    <button onClick={() => handleApprove(d)} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title={language === "ar" ? "اعتماد" : "Approve"}>
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={language === "ar" ? "توزيع أرباح جديد" : "New Profit Distribution"} size="lg">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4">
            <Select label={language === "ar" ? "الربع" : "Quarter"} value={period} onChange={e => setPeriod(e.target.value)}
              options={[{ value: "Q1", label: "Q1" }, { value: "Q2", label: "Q2" }, { value: "Q3", label: "Q3" }, { value: "Q4", label: "Q4" }]} />
            <Select label={language === "ar" ? "السنة" : "Year"} value={year} onChange={e => setYear(e.target.value)}
              options={[2023, 2024, 2025, 2026].map(y => ({ value: String(y), label: String(y) }))} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">{language === "ar" ? "الإيرادات" : "Revenue"}</p>
              <p className="font-bold text-emerald-700">{formatCurrency(financials.totalRevenue, language)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">{language === "ar" ? "المصاريف" : "Expenses"}</p>
              <p className="font-bold text-red-600">{formatCurrency(financials.totalExpenses, language)}</p>
            </div>
            <div className={`rounded-lg p-3 border ${financials.netProfit >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
              <p className="text-xs text-slate-500">{language === "ar" ? "صافي الربح" : "Net Profit"}</p>
              <p className={`font-bold ${financials.netProfit >= 0 ? "text-brand-primary" : "text-orange-600"}`}>{formatCurrency(financials.netProfit, language)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">{language === "ar" ? "الشركاء" : "Partners"}</p>
              <button onClick={() => setPartners([...partners, { name: "", percentage: 0 }])} className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> {language === "ar" ? "شريك" : "Add"}</button>
            </div>
            <div className="flex flex-col gap-2">
              {partners.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input value={p.name} onChange={e => updatePartner(idx, "name", e.target.value)} placeholder={language === "ar" ? "اسم الشريك" : "Partner name"}
                    className="flex-1 text-sm border border-slate-200 rounded px-3 py-1.5 focus:outline-none" />
                  <input type="number" value={p.percentage} onChange={e => updatePartner(idx, "percentage", e.target.value)} min="0" max="100"
                    className="w-20 text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none text-center" />
                  <span className="text-xs text-slate-500">%</span>
                  <span className="text-xs font-semibold text-brand-primary w-28 text-end">{formatCurrency(financials.netProfit * (p.percentage / 100), language)}</span>
                  {partners.length > 2 && <button onClick={() => setPartners(partners.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
            <div className={`mt-2 text-xs font-semibold ${totalPercentage === 100 ? "text-emerald-600" : "text-red-500"}`}>
              {language === "ar" ? `المجموع: ${totalPercentage}%` : `Total: ${totalPercentage}%`}
              {totalPercentage !== 100 && ` — ${language === "ar" ? "يجب أن يساوي 100%" : "must equal 100%"}`}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading} disabled={totalPercentage !== 100}>{language === "ar" ? "حفظ التوزيع" : "Save Distribution"}</Button>
          </div>
        </div>
      </Modal>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "توزيع الأرباح" : "Profit Distribution"}
        itemCount={distributions?.length}
      />
    </div>
  );
};
export default ProfitDistributionPage;
