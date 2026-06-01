import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Upload, Sparkles, Printer, FileText, X} from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, saveExpense, deleteDocument, updateDocument } from "../../firebase/firestore";
import { Expense } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { AIReceiptScanner } from "../../components/ui/AIReceiptScanner";
import { BulkExpenseUpload } from "../../components/ui/BulkExpenseUpload";
import { AttachmentUploader } from "../../components/ui/AttachmentUploader";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

export const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);

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
  const [bulkOpen, setBulkOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form fields
  const [description, setDescription] = React.useState("");
  const [descriptionAr, setDescriptionAr] = React.useState("");
  const [category, setCategory] = React.useState("Rent");
  const [amountBeforeVat, setAmountBeforeVat] = React.useState("");
  const [vatAmount, setVatAmount] = React.useState("");
  const [vatRate, setVatRate] = React.useState<0 | 5 | 15>(15);
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [attachments, setAttachments] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "expenses", (data) => {
      setExpenses(data as Expense[]);
    });
    return unsubscribe;
  }, [currentCompany]);

  const baseValue = Number(amountBeforeVat) || 0;
  const computedVat = (baseValue * vatRate) / 100;

  const openNew = () => {
    setEditingId(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (exp: Expense) => {
    setEditingId(exp.id);
    setDescription(exp.description || "");
    setDescriptionAr(exp.descriptionAr || "");
    setCategory(exp.category || "Rent");
    setAmountBeforeVat(String(exp.amountBeforeVat || exp.amount || ""));
    setVatAmount(String(exp.vatAmount || ""));
    setVatRate((exp.vatRate || 15) as 0 | 5 | 15);
    setDate(exp.date || new Date().toISOString().split("T")[0]);
    setAttachments((exp as any).attachments || []);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amountBeforeVat) {
      toast.error(language === "ar" ? "يرجى تعبئة الحقول الإجبارية" : "Please complete description and amount");
      return;
    }
    setLoading(true);
    try {
      const subtotal = Number(amountBeforeVat);
      const totalVat = Number(vatAmount) || computedVat;
      const totalAmount = subtotal + totalVat;
      const data = {
        description, descriptionAr: descriptionAr || description,
        category, amountBeforeVat: subtotal, vatRate, vatAmount: totalVat,
        totalAmount, amount: subtotal, date,
        attachments,
        receiptUrl: attachments[0] || "",
        status: "approved",
        chartOfAccountId: "501",
      };

      if (editingId) {
        await updateDocument(`companies/${currentCompany!.id}/expenses`, editingId, { ...data, updatedAt: new Date() });
        toast.success(language === "ar" ? "تم التحديث بنجاح" : "Expense updated");
      } else {
        const expenseId = "exp_" + Math.random().toString(36).substr(2, 9);
        await saveExpense(currentCompany!.id, expenseId, data);
        toast.success(language === "ar" ? "تم قيد المصاريف بنجاح" : "Expense recorded");
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
    try {
      await deleteDocument(`companies/${currentCompany!.id}/expenses`, id);
      toast.success(language === "ar" ? "تم الحذف بنجاح" : "Expense deleted");
    } catch (err) {
      toast.error(t("common.error"));
    }
  };

  const resetForm = () => {
    setDescription(""); setDescriptionAr(""); setCategory("Rent");
    setAmountBeforeVat(""); setVatAmount(""); setVatRate(15);
    setDate(new Date().toISOString().split("T")[0]);
    setAttachments([]); setEditingId(null);
  };

  const columns: Column<Expense>[] = [
    {
      header: language === "ar" ? "تفاصيل المصروف" : "Expense Details",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{language === "ar" ? row.descriptionAr : row.description}</span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{row.category}</span>
          {(row as any).attachments?.length > 0 && (
            <span className="text-[10px] text-brand-primary mt-0.5">📎 {(row as any).attachments.length} {language === "ar" ? "مرفق" : "attachment(s)"}</span>
          )}
        </div>
      )
    },
    { header: language === "ar" ? "التاريخ" : "Date", render: (row) => <span className="text-xs text-slate-500">{row.date}</span> },
    { header: language === "ar" ? "قبل الضريبة" : "Net Amount", render: (row) => <CurrencyDisplay amount={row.amountBeforeVat || row.amount} /> },
    { header: language === "ar" ? "الضريبة" : "VAT", render: (row) => <CurrencyDisplay amount={row.vatAmount} /> },
    {
      header: language === "ar" ? "الإجمالي" : "Total",
      render: (row) => <span className="font-bold text-slate-800"><CurrencyDisplay amount={row.totalAmount} /></span>
    },
    {
      header: language === "ar" ? "إجراءات" : "Actions",
      render: (row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row)} className="p-1 text-slate-400 hover:text-brand-primary rounded transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("nav.expenses")}</h2>
          <p className="text-xs text-slate-500">Record general operating expenses, categorize ledger nodes, and claim input VAT offsets cleanly.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={expenses} filename="expenses" headers={{ description: "Description", category: "Category", amountBeforeVat: "Net", vatAmount: "VAT", totalAmount: "Total", date: "Date" }} />
          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <button onClick={() => setBulkOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {language === "ar" ? "رفع مجمع" : "Bulk Upload"}
          </button>
          <Button onClick={openNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة مصروف" : "Add Expense"}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        searchPlaceholder={language === "ar" ? "البحث بالتفاصيل..." : "Search by details..."}
        searchField="description"
      />

      {/* Add/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingId ? (language === "ar" ? "تعديل المصروف" : "Edit Expense") : (language === "ar" ? "تسجيل قيد مصروف جديد" : "Record Expense Voucher")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans">
          <AIReceiptScanner onExtracted={(data) => {
            if (data.description) { setDescription(data.description); setDescriptionAr(data.description); }
            if (data.amount) setAmountBeforeVat(String(data.amount));
            if (data.vatAmount) setVatAmount(String(data.vatAmount));
            if (data.vatPercent) setVatRate((data.vatPercent as 0 | 5 | 15) || 15);
            if (data.category) setCategory(data.category);
            if (data.date) setDate(data.date);
          }} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={language === "ar" ? "الوصف بالإنجليزية" : "Description (English)"} placeholder="e.g. Office AWS Server hosting fee"
              value={description} onChange={(e) => setDescription(e.target.value)} required />
            <Input label={language === "ar" ? "الوصف بالعربية" : "Description (Arabic)"} placeholder="مثال: استضافة خوادم AWS"
              value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} required />
            <Select label={language === "ar" ? "تصنيف المصروف" : "Expense Category"} value={category} onChange={(e) => setCategory(e.target.value)}
              options={["Rent","Utilities","Salaries","IT","Marketing","Travel","Meals","Maintenance","Insurance","Other"].map(c => ({ value: c, label: c }))} />
            <Input label={language === "ar" ? "التاريخ" : "Date"} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <Input label={language === "ar" ? "قبل الضريبة (ر.س)" : "Net Amount (SAR)"} type="number" step="0.01" min="0"
              placeholder="0.00" value={amountBeforeVat} onChange={(e) => { setAmountBeforeVat(e.target.value); setVatAmount(""); }} required />
            <Select label={language === "ar" ? "نسبة ضريبة القيمة المضافة" : "VAT Rate"} value={String(vatRate)}
              onChange={(e) => { setVatRate(Number(e.target.value) as 0 | 5 | 15); setVatAmount(""); }}
              options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "15", label: "15%" }]} />
            <Input label={language === "ar" ? "مبلغ الضريبة (ر.س) - اختياري" : "VAT Amount (SAR) - Optional"} type="number" step="0.01" min="0"
              placeholder={`${language === "ar" ? "محسوب تلقائياً: " : "Auto: "}${computedVat.toFixed(2)}`}
              value={vatAmount} onChange={(e) => setVatAmount(e.target.value)} />
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-semibold">{language === "ar" ? "الإجمالي شامل الضريبة" : "Total incl. VAT"}</span>
              <span className="text-base font-bold text-slate-800">
                {(baseValue + (Number(vatAmount) || computedVat)).toLocaleString("en-SA", { minimumFractionDigits: 2 })} {language === "ar" ? "ر.س" : "SAR"}
              </span>
            </div>
          </div>

          <AttachmentUploader folder="expenses" attachments={attachments} onChange={setAttachments} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" loading={loading} className="flex items-center gap-2">
              {editingId ? (language === "ar" ? "حفظ التعديلات" : "Save Changes") : (language === "ar" ? "تسجيل المصروف" : "Record Expense")}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} title={language === "ar" ? "رفع مصاريف مجمعة (CSV)" : "Bulk Expense Upload (CSV)"} size="lg">
        <BulkExpenseUpload onClose={() => setBulkOpen(false)} onSuccess={() => setBulkOpen(false)} />
      </Modal>


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "سجل المصروفات" : "Expenses Register"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Expenses Register</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (expenses as any[]).map((row: any, i: number) => {
                      const cells = [String(row.date||""), String(row.description||""), String(row.category||""), String(row.totalAmount||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Expenses Register</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Expenses Register</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Date</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Description</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Category</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Total</th>",
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
        title={language === "ar" ? "سجل المصروفات" : "Expenses Register"}
        itemCount={expenses?.length}
      />
    </div>
  );
};
export default ExpensesPage;
