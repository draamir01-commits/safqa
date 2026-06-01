import * as React from "react";
import { Plus, Trash2, Building2, RefreshCw, Printer, FileText, X, Paperclip} from "lucide-react";
import toast from "react-hot-toast";
import { listenCompanyCollection, addDocument, deleteDocument } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { AttachmentUploader } from "../../components/ui/AttachmentUploader";
import { DocumentViewer } from "../../components/ui/DocumentViewer";
import { useAuthStore } from "../../stores/authStore";
import { formatCurrency } from "../../utils/formatters";
import { Overhead } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const CATEGORIES = ["rent", "utilities", "insurance", "subscriptions", "maintenance", "other"];

export const OverheadsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [overheads, setOverheads] = React.useState<Overhead[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [viewingDoc, setViewingDoc] = React.useState<{ url: string; fileName: string } | null>(null);


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
        attachments,
      });
      toast.success(language === "ar" ? "تمت الإضافة" : "Overhead added");
      setShowForm(false);
      setTitle(""); setAmount(""); setNotes(""); setAttachments([]);
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
          <ExportMenu data={overheads} filename="overheads" headers={{ date: "Date", title: "Title", category: "Category", totalAmount: "Total", isRecurring: "Recurring" }} />

          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
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
          <AttachmentUploader folder="overheads" attachments={attachments} onChange={setAttachments} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ" : "Save"}</Button>
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
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "سجل المصاريف الثابتة" : "Overheads Register"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Overheads Register</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (overheads as any[]).map((row: any, i: number) => {
                      const cells = [String(row.date||""), String(row.title||""), String(row.category||""), String(row.totalAmount||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Overheads Register</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Overheads Register</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Date</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Title</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Category</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Total</th>",
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

      <DocumentViewer
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        url={viewingDoc?.url || null}
        fileName={viewingDoc?.fileName}
      />

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل المصاريف الثابتة" : "Overheads Register"}
        itemCount={overheads?.length}
      />
    </div>
  );
};
export default OverheadsPage;
