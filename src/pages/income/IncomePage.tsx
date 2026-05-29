import * as React from "react";
import { Plus, Trash2, Pencil, TrendingUp, ArrowUpCircle, Filter, Search, Printer, FileText, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import { Income, CustomerOrSupplier, Project } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { PrintManager } from "../../components/ui/PrintManager";
import { DocumentViewer } from "../../components/ui/DocumentViewer";
import { DuplicateScanButton } from "../../components/ui/DuplicateScanner";
import { AttachmentUploader } from "../../components/ui/AttachmentUploader";
import { AIReceiptScanner } from "../../components/ui/AIReceiptScanner";

const PAYMENT_METHODS = ["Cash","Bank Transfer","Cheque","Credit Card","STC Pay","Apple Pay","Other"];
const CATEGORIES = ["Sales","Services","Consulting","Rental","Commission","Refund","Other"];

export const IncomePage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [income, setIncome] = React.useState<Income[]>([]);
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [filterProject, setFilterProject] = React.useState("");
  const [filterMethod, setFilterMethod] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showPrint, setShowPrint] = React.useState(false);
  const [viewingDoc, setViewingDoc] = React.useState<{ url: string; fileName: string } | null>(null);

  // Form
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = React.useState("");
  const [descriptionAr, setDescriptionAr] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [category, setCategory] = React.useState("Sales");
  const [amount, setAmount] = React.useState("");
  const [vatPercent, setVatPercent] = React.useState("15");
  const [vatInclusive, setVatInclusive] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState("Bank Transfer");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [attachments, setAttachments] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "income", d =>
      setIncome((d as Income[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "customers", d => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "projects", d => setProjects(d as Project[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const computedVat = React.useMemo(() => {
    const a = parseFloat(amount) || 0;
    const vp = parseFloat(vatPercent) || 0;
    if (vatInclusive) {
      const net = a / (1 + vp / 100);
      return { net: Math.round(net * 100) / 100, vat: Math.round((a - net) * 100) / 100, total: a };
    }
    const vat = Math.round(a * (vp / 100) * 100) / 100;
    return { net: a, vat, total: a + vat };
  }, [amount, vatPercent, vatInclusive]);

  const filtered = income.filter(i => {
    const matchProject = !filterProject || i.projectId === filterProject;
    const matchMethod  = !filterMethod  || i.paymentMethod === filterMethod;
    if (!matchProject || !matchMethod) return false;
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      (i.description || "").toLowerCase().includes(q) ||
      (i.descriptionAr || "").toLowerCase().includes(q) ||
      (i.clientName || "").toLowerCase().includes(q) ||
      (i.projectName || "").toLowerCase().includes(q) ||
      (i.receiptNo || "").toLowerCase().includes(q) ||
      String(i.totalAmount).includes(q) ||
      (i.category || "").toLowerCase().includes(q) ||
      (i.date || "").includes(q)
    );
  });

  // Dynamic payment methods from real data
  const dynamicMethods = Array.from(new Set(income.map(i => i.paymentMethod).filter(Boolean))).sort();

  // Live duplicate count
  const countDuplicates = () => {
    const groups: Record<string, number> = {};
    income.forEach(i => {
      const key = `${Number(i.totalAmount).toFixed(2)}|${i.clientId || ""}|${i.date}`;
      groups[key] = (groups[key] || 0) + 1;
    });
    return Object.values(groups).filter(c => c > 1).length;
  };
  const duplicateCount = countDuplicates();

  // Grouped export by project
  const getGroupedExportData = () => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(i => {
      const key = i.projectName || (language === "ar" ? "بدون مشروع" : "No Project");
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    });
    const sections: any[] = [];
    let grandNet = 0, grandVat = 0, grandTotal = 0;
    Object.entries(groups).forEach(([projName, items]) => {
      let projNet = 0, projVat = 0, projTotal = 0;
      const rows: any[] = items.map(i => {
        projNet += i.amount; projVat += i.vatAmount; projTotal += i.totalAmount;
        return { Date: i.date, "Receipt No": i.receiptNo || "—", Description: i.description, "Payment Method": i.paymentMethod, "Net Amount": i.amount, "VAT": i.vatAmount, "Total": i.totalAmount };
      });
      rows.push({ Date: `SUBTOTAL: ${projName}`, "Receipt No": "", Description: "", "Payment Method": "", "Net Amount": projNet, "VAT": projVat, "Total": projTotal });
      sections.push({ title: `${language === "ar" ? "المشروع:" : "Project:"} ${projName}`, data: rows });
      grandNet += projNet; grandVat += projVat; grandTotal += projTotal;
    });
    sections.push({ title: language === "ar" ? "الإجمالي العام" : "Grand Total", data: [{ Date: "GRAND TOTAL", "Receipt No": "", Description: "", "Payment Method": "", "Net Amount": grandNet, "VAT": grandVat, "Total": grandTotal }] });
    return sections;
  };

  const totalRevenue = filtered.reduce((s, i) => s + i.amount, 0);
  const totalVat = filtered.reduce((s, i) => s + i.vatAmount, 0);
  const totalReceived = filtered.reduce((s, i) => s + i.totalAmount, 0);

  const openEdit = (item: Income) => {
    setEditingId(item.id);
    setDate(item.date); setDescription(item.description); setDescriptionAr(item.descriptionAr || "");
    setClientId(item.clientId || ""); setProjectId(item.projectId || "");
    setCategory(item.category); setAmount(String(item.amount));
    setVatPercent(String(item.vatPercent)); setVatInclusive(item.vatInclusive || false);
    setPaymentMethod(item.paymentMethod); setReceiptNo(item.receiptNo || "");
    setNotes(item.notes || ""); setAttachments(item.attachments || []);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null); setDate(new Date().toISOString().split("T")[0]);
    setDescription(""); setDescriptionAr(""); setClientId(""); setProjectId("");
    setCategory("Sales"); setAmount(""); setVatPercent("15"); setVatInclusive(false);
    setPaymentMethod("Bank Transfer"); setReceiptNo(""); setNotes(""); setAttachments([]);
  };

  const handleSave = async () => {
    if (!description || !amount || !currentCompany || !user) return toast.error(language === "ar" ? "أكمل الحقول المطلوبة" : "Fill required fields");
    setLoading(true);
    try {
      const client = customers.find(c => c.id === clientId);
      const project = projects.find(p => p.id === projectId);
      const data: any = {
        date, description, descriptionAr: descriptionAr || description,
        clientId: clientId || null, clientName: client?.name || null,
        projectId: projectId || null, projectName: project?.name || null,
        category, amount: computedVat.net, vatPercent: parseFloat(vatPercent),
        vatAmount: computedVat.vat, totalAmount: computedVat.total,
        vatInclusive, paymentMethod, receiptNo, notes, attachments,
        updatedAt: new Date(),
      };
      if (editingId) {
        await updateDocument(`companies/${currentCompany.id}/income`, editingId, data);
        toast.success(language === "ar" ? "تم التحديث" : "Income updated");
      } else {
        await addDocument(`companies/${currentCompany.id}/income`, { ...data, createdBy: user.uid, createdAt: new Date() });
        toast.success(language === "ar" ? "تم تسجيل الإيراد" : "Income recorded");
      }
      setShowForm(false); resetForm();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany || !window.confirm(language === "ar" ? "حذف هذا الإيراد؟" : "Delete this income?")) return;
    await deleteDocument(`companies/${currentCompany.id}/income`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const methodColor: Record<string, string> = {
    Cash: "bg-emerald-100 text-emerald-700", "Bank Transfer": "bg-blue-100 text-blue-700",
    Cheque: "bg-purple-100 text-purple-700", "Credit Card": "bg-orange-100 text-orange-700",
    "STC Pay": "bg-teal-100 text-teal-700", "Apple Pay": "bg-slate-100 text-slate-700",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "الإيرادات" : "Income"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "تسجيل وتتبع الإيرادات والمقبوضات" : "Record and track all income and receipts"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={getGroupedExportData()} filename="income" />
          <div className="relative">
            <DuplicateScanButton data={income} config={{ collection: "income", labelEn: "Income", labelAr: "الإيرادات", keyFields: ["totalAmount","clientId","date"] }} />
            {duplicateCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {duplicateCount}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "طباعة" : "Print"}
          </button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "تسجيل إيراد" : "Record Income"}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "الإيراد الصافي" : "Net Revenue"}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalRevenue, language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "ضريبة القيمة المضافة" : "VAT Collected"}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(totalVat, language)}</p>
        </div>
        <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "الإجمالي المستلم" : "Total Received"}</p>
          <p className="text-2xl font-bold text-brand-primary mt-1">{formatCurrency(totalReceived, language)}</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={language === "ar" ? "بحث في الإيرادات..." : "Search income..."}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none">
            <option value="">{language === "ar" ? "كل المشاريع" : "All Projects"}</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none">
            <option value="">{language === "ar" ? "كل طرق الدفع" : "All Payment Methods"}</option>
            {dynamicMethods.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(filterProject || filterMethod || searchTerm) && (
            <button onClick={() => { setFilterProject(""); setFilterMethod(""); setSearchTerm(""); }} className="text-xs text-red-500 hover:underline font-semibold">
              {language === "ar" ? "مسح" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "التاريخ" : "Date", language === "ar" ? "الوصف" : "Description",
                language === "ar" ? "العميل / المشروع" : "Client / Project",
                language === "ar" ? "الإيراد الصافي" : "Net Amount",
                language === "ar" ? "الضريبة" : "VAT", language === "ar" ? "الإجمالي" : "Total",
                language === "ar" ? "طريقة الدفع" : "Payment", ""].map((h, i) =>
                <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-slate-400 text-sm">
                {language === "ar" ? "لا توجد إيرادات مسجلة" : "No income records yet"}
              </td></tr>
            ) : filtered.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-xs text-slate-500">{item.date}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 text-sm">{language === "ar" ? item.descriptionAr || item.description : item.description}</p>
                  <p className="text-xs text-slate-400">{item.category}</p>
                  {item.attachments?.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); setViewingDoc({ url: item.attachments[0], fileName: `income-${item.receiptNo || item.date}` }); }}
                      className="flex items-center gap-1 text-[10px] text-brand-primary hover:text-blue-700 transition-colors"
                    >
                      {item.attachments[0]?.includes("pdf") ? <FileText className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      {item.attachments.length} {language === "ar" ? "مرفق" : "attachment(s)"}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.clientName && <p className="text-xs font-medium text-slate-700">{item.clientName}</p>}
                  {item.projectName && <p className="text-[10px] text-slate-400">{item.projectName}</p>}
                  {!item.clientName && !item.projectName && <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-700 font-medium">{formatCurrency(item.amount, language)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{formatCurrency(item.vatAmount, language)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{formatCurrency(item.totalAmount, language)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${methodColor[item.paymentMethod] || "bg-slate-100 text-slate-600"}`}>
                    {item.paymentMethod}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} className="p-1 text-slate-400 hover:text-brand-primary rounded"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td colSpan={3} className="px-4 py-2 text-xs font-bold text-slate-600">{language === "ar" ? "الإجمالي" : "Total"} ({filtered.length})</td>
                <td className="px-4 py-2 font-bold text-slate-800">{formatCurrency(totalRevenue, language)}</td>
                <td className="px-4 py-2 font-bold text-slate-600">{formatCurrency(totalVat, language)}</td>
                <td className="px-4 py-2 font-bold text-brand-primary">{formatCurrency(totalReceived, language)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? (language === "ar" ? "تعديل الإيراد" : "Edit Income") : (language === "ar" ? "تسجيل إيراد جديد" : "Record New Income")}
        size="lg">
        <div className="flex flex-col gap-4">
          <AIReceiptScanner onExtracted={data => {
            if (data.totalAmount) setAmount(String(data.totalAmount));
            if (data.vatPercent) setVatPercent(String(data.vatPercent));
            if (data.vatAmount && data.totalAmount) { setAmount(String(data.totalAmount - data.vatAmount)); setVatInclusive(false); }
            if (data.date) setDate(data.date);
            if (data.description) { setDescription(data.description); setDescriptionAr(data.description); }
          }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={language === "ar" ? "التاريخ" : "Date"} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Input label={language === "ar" ? "رقم الإيصال (اختياري)" : "Receipt No."} value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="INV-001" />
            <Input label={language === "ar" ? "الوصف (إنجليزي)" : "Description (EN)"} value={description} onChange={e => setDescription(e.target.value)} className="md:col-span-2" />
            <Input label={language === "ar" ? "الوصف (عربي)" : "Description (AR)"} value={descriptionAr} onChange={e => setDescriptionAr(e.target.value)} className="md:col-span-2" />
            <Select label={language === "ar" ? "العميل" : "Client"} value={clientId} onChange={e => setClientId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "بدون عميل" : "No client" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
            <Select label={language === "ar" ? "المشروع" : "Project"} value={projectId} onChange={e => setProjectId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "بدون مشروع" : "No project" }, ...projects.map(p => ({ value: p.id, label: p.name }))]} />
            <Select label={language === "ar" ? "الفئة" : "Category"} value={category} onChange={e => setCategory(e.target.value)}
              options={CATEGORIES.map(c => ({ value: c, label: c }))} />
            <Select label={language === "ar" ? "طريقة الدفع" : "Payment Method"} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHODS.map(m => ({ value: m, label: m }))} />
            <Input label={language === "ar" ? "المبلغ (ر.س)" : "Amount (SAR)"} type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
            <Select label={language === "ar" ? "نسبة الضريبة" : "VAT Rate"} value={vatPercent} onChange={e => setVatPercent(e.target.value)}
              options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "15", label: "15%" }]} />
            <label className="flex items-center gap-2 cursor-pointer text-sm col-span-2">
              <input type="checkbox" checked={vatInclusive} onChange={e => setVatInclusive(e.target.checked)} className="rounded border-slate-300" />
              <span className="font-medium text-slate-700">{language === "ar" ? "المبلغ شامل الضريبة (VAT Inclusive)" : "Amount includes VAT (VAT Inclusive)"}</span>
            </label>
          </div>

          {amount && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { labelAr: "الصافي", labelEn: "Net", value: computedVat.net, cls: "text-slate-800" },
                { labelAr: "ضريبة القيمة المضافة", labelEn: "VAT", value: computedVat.vat, cls: "text-amber-600" },
                { labelAr: "الإجمالي", labelEn: "Total", value: computedVat.total, cls: "text-brand-primary font-bold" },
              ].map((r, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">{language === "ar" ? r.labelAr : r.labelEn}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${r.cls}`}>{formatCurrency(r.value, language)}</p>
                </div>
              ))}
            </div>
          )}

          <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={notes} onChange={e => setNotes(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />
          <AttachmentUploader folder="income" attachments={attachments} onChange={setAttachments} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading} className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              {editingId ? (language === "ar" ? "حفظ التعديلات" : "Save Changes") : (language === "ar" ? "تسجيل الإيراد" : "Record Income")}
            </Button>
          </div>
        </div>
      </Modal>
      {/* Print Manager */}
      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل الإيرادات" : "Income Registry"}
        itemCount={filtered.length}
      />

      {/* Document Viewer */}
      <DocumentViewer
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        url={viewingDoc?.url || null}
        fileName={viewingDoc?.fileName}
      />
    </div>
  );
};
export default IncomePage;
