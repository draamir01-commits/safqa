import * as React from "react";
import { Plus, Eye, Briefcase, CheckCircle, PauseCircle, XCircle, Trash2, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import { Project, CustomerOrSupplier, Invoice, Expense } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

const statusColor: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  completed: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

export const ProjectsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [projects, setProjects] = React.useState<Project[]>([]);
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showDetail, setShowDetail] = React.useState(false);
  const [selected, setSelected] = React.useState<Project | null>(null);

  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [contractValue, setContractValue] = React.useState("");
  const [vatPercent, setVatPercent] = React.useState("15");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = React.useState("");
  const [description, setDescription] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "projects", d => setProjects((d as Project[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "customers", d => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "invoices", d => setInvoices(d as Invoice[]));
    const u4 = listenCompanyCollection(currentCompany.id, "expenses", d => setExpenses(d as Expense[]));
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentCompany]);

  const handleSave = async () => {
    if (!name || !contractValue || !currentCompany || !user) return toast.error(language === "ar" ? "أكمل البيانات المطلوبة" : "Fill required fields");
    setLoading(true);
    try {
      const cv = +contractValue;
      const vp = +vatPercent;
      const va = Math.round(cv * (vp / 100) * 100) / 100;
      const client = customers.find(c => c.id === clientId);
      await addDocument(`companies/${currentCompany.id}/projects`, {
        name, nameAr: nameAr || name, clientId: clientId || null,
        clientName: client?.name || null, contractValue: cv,
        vatPercent: vp, vatAmount: va, totalValue: cv + va,
        status: "active", startDate, endDate: endDate || null, description,
        createdBy: user.uid, createdAt: new Date(), updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم إنشاء المشروع" : "Project created");
      setShowForm(false);
      resetForm();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (p: Project, status: string) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/projects`, p.id, { status, updatedAt: new Date() });
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/projects`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const resetForm = () => { setName(""); setNameAr(""); setClientId(""); setContractValue(""); setDescription(""); setEndDate(""); };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      active: ["نشط", "Active"], completed: ["مكتمل", "Completed"],
      on_hold: ["متوقف", "On Hold"], cancelled: ["ملغي", "Cancelled"]
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  const projectStats = (p: Project) => {
    const pInvoices = invoices.filter(i => (i as any).projectId === p.id && i.status !== "cancelled");
    const pExpenses = expenses.filter(e => (e as any).projectId === p.id);
    const billed = pInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const costs = pExpenses.reduce((s, e) => s + e.totalAmount, 0);
    return { billed, costs, profit: billed - costs, invoiceCount: pInvoices.length };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "المشاريع" : "Projects"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "إدارة المشاريع وتتبع الأرباح لكل مشروع" : "Manage projects and track per-project profitability"}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton data={projects} filename="projects" headers={{ name: "Name", clientName: "Client", contractValue: "Value", status: "Status" }} />

          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "مشروع جديد" : "New Project"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["active", "completed", "on_hold", "cancelled"].map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{statusLabel(s)}</p>
            <p className="text-2xl font-bold text-slate-800">{projects.filter(p => p.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.length === 0 ? (
          <div className="col-span-3 bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-400">{language === "ar" ? "لا توجد مشاريع" : "No projects yet"}</div>
        ) : projects.map(p => {
          const stats = projectStats(p);
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">{language === "ar" ? p.nameAr || p.name : p.name}</h3>
                  {p.clientName && <p className="text-xs text-slate-500 mt-0.5">{p.clientName}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[p.status]}`}>{statusLabel(p.status)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-slate-500">{language === "ar" ? "قيمة العقد" : "Contract Value"}</p>
                  <p className="font-bold text-slate-800">{formatCurrency(p.totalValue, language)}</p>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-slate-500">{language === "ar" ? "مفاتير" : "Billed"}</p>
                  <p className="font-bold text-emerald-600">{formatCurrency(stats.billed, language)}</p>
                </div>
                <div className="bg-slate-50 rounded p-2">
                  <p className="text-slate-500">{language === "ar" ? "التكاليف" : "Costs"}</p>
                  <p className="font-bold text-red-500">{formatCurrency(stats.costs, language)}</p>
                </div>
                <div className={`rounded p-2 ${stats.profit >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
                  <p className="text-slate-500">{language === "ar" ? "صافي الربح" : "Net Profit"}</p>
                  <p className={`font-bold ${stats.profit >= 0 ? "text-brand-primary" : "text-red-600"}`}>{formatCurrency(stats.profit, language)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 pt-2">
                <span>{p.startDate}{p.endDate ? ` → ${p.endDate}` : ""}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setSelected(p); setShowDetail(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded"><Eye className="h-4 w-4" /></button>
                  {p.status === "active" && <button onClick={() => handleStatusChange(p, "completed")} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title={language === "ar" ? "إتمام" : "Complete"}><CheckCircle className="h-4 w-4" /></button>}
                  {p.status === "active" && <button onClick={() => handleStatusChange(p, "on_hold")} className="p-1 text-slate-400 hover:text-amber-500 rounded" title={language === "ar" ? "تعليق" : "Hold"}><PauseCircle className="h-4 w-4" /></button>}
                  <button onClick={() => handleDelete(p.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={language === "ar" ? "مشروع جديد" : "New Project"} size="lg">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={language === "ar" ? "اسم المشروع (إنجليزي)" : "Project Name (EN)"} value={name} onChange={e => setName(e.target.value)} />
            <Input label={language === "ar" ? "اسم المشروع (عربي)" : "Project Name (AR)"} value={nameAr} onChange={e => setNameAr(e.target.value)} />
            <Select label={language === "ar" ? "العميل (اختياري)" : "Client (optional)"} value={clientId} onChange={e => setClientId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "بدون عميل" : "No client" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
            <Input label={language === "ar" ? "قيمة العقد (ر.س)" : "Contract Value (SAR)"} type="number" value={contractValue} onChange={e => setContractValue(e.target.value)} min="0" />
            <Select label={language === "ar" ? "نسبة ضريبة القيمة المضافة" : "VAT Rate"} value={vatPercent} onChange={e => setVatPercent(e.target.value)}
              options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "15", label: "15%" }]} />
            <Input label={language === "ar" ? "تاريخ البداية" : "Start Date"} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            <Input label={language === "ar" ? "تاريخ النهاية (اختياري)" : "End Date (optional)"} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          {contractValue && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
              <span className="text-slate-500">{language === "ar" ? "الإجمالي شامل الضريبة:" : "Total inc. VAT:"}</span>
              <span className="font-bold">{formatCurrency(+contractValue * (1 + +vatPercent / 100), language)}</span>
            </div>
          )}
          <Input label={language === "ar" ? "الوصف" : "Description"} value={description} onChange={e => setDescription(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ المشروع" : "Save Project"}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title={selected ? (language === "ar" ? selected.nameAr || selected.name : selected.name) : ""} size="md">
        {selected && (() => {
          const stats = projectStats(selected);
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500 text-xs">{language === "ar" ? "العميل" : "Client"}</span><p className="font-semibold">{selected.clientName || "—"}</p></div>
                <div><span className="text-slate-500 text-xs">{language === "ar" ? "الحالة" : "Status"}</span><p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[selected.status]}`}>{statusLabel(selected.status)}</span></p></div>
                <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ البداية" : "Start"}</span><p>{selected.startDate}</p></div>
                <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ النهاية" : "End"}</span><p>{selected.endDate || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { labelAr: "قيمة العقد", labelEn: "Contract Value", value: selected.totalValue, cls: "text-slate-800" },
                  { labelAr: "إجمالي الفواتير", labelEn: "Total Billed", value: stats.billed, cls: "text-emerald-600" },
                  { labelAr: "إجمالي التكاليف", labelEn: "Total Costs", value: stats.costs, cls: "text-red-500" },
                  { labelAr: "صافي الربح", labelEn: "Net Profit", value: stats.profit, cls: stats.profit >= 0 ? "text-brand-primary" : "text-red-600" },
                ].map((r, i) => (
                  <div key={i} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{language === "ar" ? r.labelAr : r.labelEn}</p>
                    <p className={`font-bold text-lg ${r.cls}`}>{formatCurrency(r.value, language)}</p>
                  </div>
                ))}
              </div>
              {selected.description && <p className="text-slate-600 bg-slate-50 rounded p-3">{selected.description}</p>}
            </div>
          );
        })()}
      </Modal>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل المشاريع" : "Projects Register"}
        itemCount={projects?.length}
      />
    </div>
  );
};
export default ProjectsPage;
