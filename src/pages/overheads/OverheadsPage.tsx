import * as React from "react";
import { Plus, Trash2, Building2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, deleteDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { Overhead } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

const CATEGORIES = ["rent", "utilities", "insurance", "subscriptions", "maintenance", "other"];

export const OverheadsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [overheads, setOverheads] = React.useState<Overhead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("rent");
  const [amount, setAmount] = React.useState("");
  const [vatRate, setVatRate] = React.useState("15");
  const [isRecurring, setIsRecurring] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = listenCompanyCollection(currentCompany.id, "overheads", d =>
      setOverheads((d as Overhead[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    return unsub;
  }, [currentCompany]);

  const totalThisMonth = React.useMemo(() => {
    const now = new Date();
    return overheads.filter(o => {
      const d = new Date(o.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, o) => s + o.totalAmount, 0);
  }, [overheads]);

  const totalRecurring = overheads.filter(o => o.isRecurring).reduce((s, o) => s + o.totalAmount, 0);

  const handleSave = async () => {
    if (!title || !amount || !currentCompany || !user) return toast.error(language === "ar" ? "أكمل البيانات" : "Fill all fields");
    setLoading(true);
    try {
      const amt = +amount;
      const vat = +vatRate;
      const vatAmt = Math.round(amt * (vat / 100) * 100) / 100;
      await addDocument(`companies/${currentCompany.id}/overheads`, {
        date, title, titleAr: title, category, amount: amt, vatRate: vat,
        vatAmount: vatAmt, totalAmount: amt + vatAmt, isRecurring, notes,
        createdBy: user.uid, createdAt: new Date(),
      });
      toast.success(language === "ar" ? "تمت الإضافة" : "Overhead added");
      setShowForm(false);
      setTitle(""); setAmount(""); setNotes("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/overheads`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const catLabel = (c: string) => {
    const map: Record<string, [string, string]> = {
      rent: ["إيجار", "Rent"], utilities: ["خدمات", "Utilities"], insurance: ["تأمين", "Insurance"],
      subscriptions: ["اشتراكات", "Subscriptions"], maintenance: ["صيانة", "Maintenance"], other: ["أخرى", "Other"]
    };
    return map[c]?.[language === "ar" ? 0 : 1] || c;
  };

  const catColor: Record<string, string> = {
    rent: "bg-blue-100 text-blue-700", utilities: "bg-amber-100 text-amber-700",
    insurance: "bg-purple-100 text-purple-700", subscriptions: "bg-emerald-100 text-emerald-700",
    maintenance: "bg-orange-100 text-orange-700", other: "bg-slate-100 text-slate-600"
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "المصاريف الثابتة (الأوفرهيد)" : "Overhead Costs"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "تتبع المصاريف الثابتة والمتكررة" : "Track fixed and recurring overhead expenses"}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={overheads} filename="overheads" headers={{ date: "Date", title: "Title", category: "Category", totalAmount: "Total", isRecurring: "Recurring" }} />
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "إضافة مصروف ثابت" : "Add Overhead"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">{language === "ar" ? "هذا الشهر" : "This Month"}</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalThisMonth, language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">{language === "ar" ? "الإجمالي" : "Total All Time"}</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(overheads.reduce((s, o) => s + o.totalAmount, 0), language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><RefreshCw className="h-3 w-3" />{language === "ar" ? "المتكررة" : "Recurring Monthly"}</p>
          <p className="text-2xl font-bold text-brand-primary">{formatCurrency(totalRecurring, language)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "التاريخ" : "Date", language === "ar" ? "الوصف" : "Description",
                language === "ar" ? "الفئة" : "Category", language === "ar" ? "المبلغ" : "Amount",
                language === "ar" ? "ضريبة" : "VAT", language === "ar" ? "الإجمالي" : "Total",
                language === "ar" ? "متكرر" : "Recurring", ""].map((h, i) =>
                <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {overheads.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد مصاريف ثابتة" : "No overhead costs yet"}</td></tr>
            ) : overheads.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500">{o.date}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{language === "ar" ? o.titleAr || o.title : o.title}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${catColor[o.category]}`}>{catLabel(o.category)}</span></td>
                <td className="px-4 py-3 text-slate-700">{formatCurrency(o.amount, language)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatCurrency(o.vatAmount, language)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(o.totalAmount, language)}</td>
                <td className="px-4 py-3">{o.isRecurring ? <span className="flex items-center gap-1 text-brand-primary text-xs font-medium"><RefreshCw className="h-3 w-3" />{language === "ar" ? "نعم" : "Yes"}</span> : <span className="text-slate-400 text-xs">—</span>}</td>
                <td className="px-4 py-3"><button onClick={() => handleDelete(o.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={language === "ar" ? "إضافة مصروف ثابت" : "Add Overhead Cost"}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={language === "ar" ? "التاريخ" : "Date"} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Select label={language === "ar" ? "الفئة" : "Category"} value={category} onChange={e => setCategory(e.target.value)}
              options={CATEGORIES.map(c => ({ value: c, label: catLabel(c) }))} />
            <Input label={language === "ar" ? "الوصف" : "Description"} value={title} onChange={e => setTitle(e.target.value)} placeholder={language === "ar" ? "مثال: إيجار المكتب" : "e.g. Office Rent"} className="col-span-2" />
            <Input label={language === "ar" ? "المبلغ (ر.س)" : "Amount (SAR)"} type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
            <Select label={language === "ar" ? "نسبة الضريبة" : "VAT Rate"} value={vatRate} onChange={e => setVatRate(e.target.value)}
              options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "15", label: "15%" }]} />
          </div>
          {amount && <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between"><span className="text-slate-500">{language === "ar" ? "الإجمالي شامل الضريبة:" : "Total inc. VAT:"}</span><span className="font-bold">{formatCurrency(+amount * (1 + +vatRate / 100), language)}</span></div>}
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="rounded border-slate-300" />
            <RefreshCw className="h-4 w-4 text-brand-primary" />
            {language === "ar" ? "مصروف متكرر شهرياً" : "Recurring monthly expense"}
          </label>
          <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={notes} onChange={e => setNotes(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default OverheadsPage;
