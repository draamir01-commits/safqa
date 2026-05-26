import * as React from "react";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, deleteDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { PettyCash } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

const CATEGORIES = ["office", "transport", "meals", "maintenance", "utilities", "other"];

export const PettyCashPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [entries, setEntries] = React.useState<PettyCash[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [type, setType] = React.useState<"in" | "out">("out");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState("other");

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = listenCompanyCollection(currentCompany.id, "pettyCash", d =>
      setEntries((d as PettyCash[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    return unsub;
  }, [currentCompany]);

  const balance = entries.reduce((sum, e) => sum + (e.type === "in" ? e.amount : -e.amount), 0);
  const totalIn = entries.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0);
  const totalOut = entries.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0);

  const handleSave = async () => {
    if (!description || !amount || !currentCompany || !user) return toast.error(language === "ar" ? "أكمل البيانات" : "Please fill all fields");
    setLoading(true);
    try {
      const newBalance = balance + (type === "in" ? +amount : -+amount);
      await addDocument(`companies/${currentCompany.id}/pettyCash`, {
        date, description, descriptionAr: description, type,
        amount: +amount, category, balance: newBalance,
        createdBy: user.uid, createdAt: new Date(),
      });
      toast.success(language === "ar" ? "تمت الإضافة" : "Entry added");
      setShowForm(false);
      setDescription(""); setAmount(""); setCategory("other");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/pettyCash`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const catLabel = (c: string) => {
    const map: Record<string, [string, string]> = {
      office: ["مكتب", "Office"], transport: ["نقل", "Transport"], meals: ["وجبات", "Meals"],
      maintenance: ["صيانة", "Maintenance"], utilities: ["خدمات", "Utilities"], other: ["أخرى", "Other"]
    };
    return map[c]?.[language === "ar" ? 0 : 1] || c;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "الصندوق النثري" : "Petty Cash"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "إدارة المصروفات النثرية اليومية" : "Manage daily petty cash transactions"}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={entries} filename="petty-cash" headers={{ date: "Date", description: "Description", type: "Type", amount: "Amount", balance: "Balance" }} />
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة قيد" : "Add Entry"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-lg p-4 border ${balance >= 0 ? "bg-white border-slate-200" : "bg-red-50 border-red-200"}`}>
          <p className="text-xs text-slate-500 mb-1">{language === "ar" ? "الرصيد الحالي" : "Current Balance"}</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? "text-slate-800" : "text-red-600"}`}>{formatCurrency(balance, language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">{language === "ar" ? "إجمالي الإيداعات" : "Total In"}</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIn, language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">{language === "ar" ? "إجمالي الصرف" : "Total Out"}</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOut, language)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "التاريخ" : "Date", language === "ar" ? "الوصف" : "Description",
                language === "ar" ? "الفئة" : "Category", language === "ar" ? "النوع" : "Type",
                language === "ar" ? "المبلغ" : "Amount", language === "ar" ? "الرصيد" : "Balance", ""].map((h, i) =>
                <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد قيود" : "No entries yet"}</td></tr>
            ) : entries.map(e => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-xs text-slate-500">{e.date}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{language === "ar" ? e.descriptionAr || e.description : e.description}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{catLabel(e.category)}</td>
                <td className="px-4 py-3">
                  {e.type === "in"
                    ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><ArrowUpCircle className="h-3.5 w-3.5" />{language === "ar" ? "إيداع" : "In"}</span>
                    : <span className="flex items-center gap-1 text-red-500 text-xs font-medium"><ArrowDownCircle className="h-3.5 w-3.5" />{language === "ar" ? "صرف" : "Out"}</span>}
                </td>
                <td className={`px-4 py-3 font-semibold ${e.type === "in" ? "text-emerald-600" : "text-red-600"}`}>
                  {e.type === "in" ? "+" : "-"}{formatCurrency(e.amount, language)}
                </td>
                <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(e.balance, language)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(e.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={language === "ar" ? "إضافة قيد نثري" : "Add Petty Cash Entry"}>
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <button onClick={() => setType("out")} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors flex items-center justify-center gap-2 ${type === "out" ? "bg-red-50 border-red-300 text-red-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <ArrowDownCircle className="h-4 w-4" />{language === "ar" ? "صرف" : "Cash Out"}
            </button>
            <button onClick={() => setType("in")} className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors flex items-center justify-center gap-2 ${type === "in" ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
              <ArrowUpCircle className="h-4 w-4" />{language === "ar" ? "إيداع" : "Cash In"}
            </button>
          </div>
          <Input label={language === "ar" ? "التاريخ" : "Date"} type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label={language === "ar" ? "الوصف" : "Description"} value={description} onChange={e => setDescription(e.target.value)} placeholder={language === "ar" ? "وصف المصروف..." : "Describe the expense..."} />
          <Input label={language === "ar" ? "المبلغ (ر.س)" : "Amount (SAR)"} type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" />
          <Select label={language === "ar" ? "الفئة" : "Category"} value={category} onChange={e => setCategory(e.target.value)}
            options={CATEGORIES.map(c => ({ value: c, label: catLabel(c) }))} />
          <div className="bg-slate-50 rounded-lg p-3 text-sm">
            <span className="text-slate-500">{language === "ar" ? "الرصيد بعد القيد:" : "Balance after entry:"} </span>
            <span className="font-bold text-slate-800">{formatCurrency(balance + (type === "in" ? +(amount || 0) : -(amount || 0)), language)}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default PettyCashPage;
