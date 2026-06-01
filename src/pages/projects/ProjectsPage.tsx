import * as React from "react";
import { Plus, Eye, Briefcase, CheckCircle, PauseCircle, XCircle, Trash2, Printer, FileText, X} from "lucide-react";
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
import { ExportMenu } from "../../components/ui/ExportMenu";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

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
          <ExportMenu data={projects} filename="projects" headers={{ name: "Name", clientName: "Client", contractValue: "Value", status: "Status" }} />

          <button
            onClick={openExportPanel}
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


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "سجل المشاريع" : "Projects Register"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Projects Register</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (projects as any[]).map((row: any, i: number) => {
                      const cells = [String(row.name||""), String(row.clientName||""), String(row.contractValue||""), String(row.status||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Projects Register</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Projects Register</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Name</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Client</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Value</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Status</th>",
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
        title={language === "ar" ? "سجل المشاريع" : "Projects Register"}
        itemCount={projects?.length}
      />
    </div>
  );
};
export default ProjectsPage;
