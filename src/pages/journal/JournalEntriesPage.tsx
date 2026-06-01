import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ShieldAlert, Sparkles, Scale, Printer, FileText, X} from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { listenCompanyCollection, saveJournal, deleteDocument } from "../../firebase/firestore";
import { JournalEntry, ChartOfAccount } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

export const JournalEntriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [journals, setJournals] = React.useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = React.useState<ChartOfAccount[]>([]);
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
  const [loading, setLoading] = React.useState(false);

  // Form Fields
  const [reference, setReference] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [narration, setNarration] = React.useState("");
  const [narrationAr, setNarrationAr] = React.useState("");

  // Debit Side
  const [debitAccountId, setDebitAccountId] = React.useState("");
  const [debitAmount, setDebitAmount] = React.useState("");

  // Credit Side
  const [creditAccountId, setCreditAccountId] = React.useState("");
  const [creditAmount, setCreditAmount] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;

    const unsubJournals = listenCompanyCollection(currentCompany.id, "journalEntries", (data) => {
      // Sort newest first
      const sorted = (data as JournalEntry[]).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setJournals(sorted);
    });
    const unsubAccounts = listenCompanyCollection(currentCompany.id, "chartOfAccounts", (data) => {
      setAccounts(data as ChartOfAccount[]);
    });

    return () => {
      unsubJournals();
      unsubAccounts();
    };
  }, [currentCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reference || !debitAccountId || !creditAccountId || !debitAmount || !creditAmount) {
      toast.error(language === "ar" ? "برجاء استكمال كافة الحقول" : "Please complete all fields");
      return;
    }

    if (debitAccountId === creditAccountId) {
      toast.error(language === "ar" ? "لا يمكن قيد نفس الحساب في المدين والدين" : "Debit and Credit accounts cannot be the same");
      return;
    }

    const dVal = Number(debitAmount);
    const cVal = Number(creditAmount);

    if (dVal !== cVal) {
      toast.error(language === "ar" ? "الحسابات غير متزنة! يجب تساوي المدين والدائن" : "Unbalanced journal values! Debit must equal Credit value exactly");
      return;
    }

    setLoading(true);
    try {
      const dbAcc = accounts.find(a => a.id === debitAccountId);
      const crAcc = accounts.find(a => a.id === creditAccountId);

      const journalId = "jn_" + Math.random().toString(36).substr(2, 9);
      await saveJournal(currentCompany!.id, journalId, {
        reference,
        date,
        narration,
        narrationAr,
        debitAccount: dbAcc?.name || "Debit Acc",
        debitAccountAr: dbAcc?.nameAr || "حساب مدين",
        debitAccountId,
        creditAccount: crAcc?.name || "Credit Acc",
        creditAccountAr: crAcc?.nameAr || "حساب دائن",
        creditAccountId,
        amount: dVal,
        status: "approved"
      });

      toast.success(language === "ar" ? "تم حفظ القيد المحاسبي المتزن بنجاح" : "Balanced double-entry journal recorded successfully");
      setModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
    try {
      await deleteDocument(`companies/${currentCompany!.id}/journalEntries`, id);
      toast.success(language === "ar" ? "تم قيد حذف المستند" : "Journal node removed");
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
  };

  const resetForm = () => {
    setReference("");
    setNarration("");
    setNarrationAr("");
    setDebitAccountId("");
    setDebitAmount("");
    setCreditAccountId("");
    setCreditAmount("");
  };

  const columns: Column<JournalEntry>[] = [
    {
      header: language === "ar" ? "المرجع والتاريخ" : "Reference & Date",
      render: (row) => (
        <div className="flex flex-col text-right rtl:text-right ltr:text-left">
          <span className="font-bold text-slate-800">{row.reference}</span>
          <span className="text-[10px] text-slate-500 font-medium">{row.date}</span>
        </div>
      )
    },
    {
      header: language === "ar" ? "البيان والسبب" : "Description Scope",
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium max-w-xs truncate block">
          {language === "ar" ? row.narrationAr || row.narration : row.narration}
        </span>
      )
    },
    {
      header: language === "ar" ? "الحساب المدين (Debit)" : "Debit Account (Dr.)",
      render: (row) => (
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-105">
          {language === "ar" ? row.debitAccountAr : row.debitAccount}
        </span>
      )
    },
    {
      header: language === "ar" ? "الحساب الدائن (Credit)" : "Credit Account (Cr.)",
      render: (row) => (
        <span className="text-xs font-bold text-teal-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-150">
          {language === "ar" ? row.creditAccountAr : row.creditAccount}
        </span>
      )
    },
    {
      header: language === "ar" ? "القيمة المتزنة" : "Volume (SAR)",
      render: (row) => (
        <CurrencyDisplay amount={row.amount} className="text-xs font-bold text-slate-800 font-mono" />
      )
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-1 text-slate-400 hover:text-brand-danger hover:bg-slate-105 rounded"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("nav.journalEntries")}</h2>
          <p className="text-xs text-slate-500">Record balanced double-entry journals directly and adjust year-end corporate balances.</p>
        </div>

          <ExportMenu data={journals} filename="journal-entries" headers={{ date: "Date", entryNumber: "Entry #", description: "Description", totalDebit: "Debit", totalCredit: "Credit" }} />
          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
        <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {language === "ar" ? "إضافة قيد يومية" : "Add Journal Entry"}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={journals}
        searchPlaceholder={language === "ar" ? "بحث برقم المرجع..." : "Search by reference..."}
        searchField="reference"
      />

      {/* Manual Journal Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={language === "ar" ? "إنشاء قيد يومية متزن" : "Record General Journal Entry"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans text-right rtl:text-right ltr:text-left">
          
          <div className="flex items-center gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-xs leading-relaxed text-slate-700">
            <Scale className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800">Double-Entry Balancing Rule</p>
              <p className="mt-1">
                Accounts must adhere strictly to balances. Sum of Debits must equal Sum of Credits exactly. The database rejects unbalanced operations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "رقم المرجع للقيد" : "Journal Entry Reference ID"}
              placeholder="e.g. JE-2026-01"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              required
            />
            <Input
              label={t("invoice.issueDate")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "الشرح بالإنجليزي" : "Narration (English)"}
              placeholder="E.g. Capital funding transfer"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
            <Input
              label={language === "ar" ? "بيان وشرح القيد" : "Narration (Arabic)"}
              placeholder="مثال: قيد إثبات تمويل رأس مال الشركة"
              value={narrationAr}
              onChange={(e) => setNarrationAr(e.target.value)}
            />
          </div>

          {/* DEBIT / CREDIT SELECTIONS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4 mt-2">
            
            {/* Debit Node (Dr.) */}
            <div className="p-4 bg-blue-50/20 border border-blue-105 rounded-lg flex flex-col gap-3">
              <h4 className="font-bold text-xs text-blue-700 uppercase tracking-widest flex items-center gap-1.5">
                <span>1. {language === "ar" ? "الجانب المدين" : "Debit Side (Dr.)"}</span>
              </h4>
              <Select
                label={language === "ar" ? "الحساب المستلم" : "Debit Account Node"}
                options={[
                  { value: "", label: "..." },
                  ...accounts.map(a => ({ value: a.id, label: `${a.code} - ${language === "ar" ? a.nameAr : a.name}` }))
                ]}
                value={debitAccountId}
                onChange={(e) => setDebitAccountId(e.target.value)}
                required
              />
              <Input
                label={language === "ar" ? "المبلغ المدين (SAR)" : "Debit Volume Amount"}
                type="number"
                placeholder="0.00"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                required
              />
            </div>

            {/* Credit Node (Cr.) */}
            <div className="p-4 bg-emerald-50/20 border border-emerald-150 rounded-lg flex flex-col gap-3">
              <h4 className="font-bold text-xs text-teal-700 uppercase tracking-widest flex items-center gap-1.5">
                <span>2. {language === "ar" ? "الجانب الدائن" : "Credit Side (Cr.)"}</span>
              </h4>
              <Select
                label={language === "ar" ? "الحساب الدافع" : "Credit Account Node"}
                options={[
                  { value: "", label: "..." },
                  ...accounts.map(a => ({ value: a.id, label: `${a.code} - ${language === "ar" ? a.nameAr : a.name}` }))
                ]}
                value={creditAccountId}
                onChange={(e) => setCreditAccountId(e.target.value)}
                required
              />
              <Input
                label={language === "ar" ? "المبلغ الدائن (SAR)" : "Credit Volume Amount"}
                type="number"
                placeholder="0.00"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                required
              />
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" size="sm" type="button" onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={loading}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>



      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "القيود اليومية" : "Journal Entries"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Journal Entries</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (journals as any[]).map((row: any, i: number) => {
                      const cells = [String(row.date||""), String(row.entryNumber||""), String(row.description||""), String(row.totalDebit||""), String(row.totalCredit||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Journal Entries</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Journal Entries</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Date</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Entry #</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Description</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Debit</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Credit</th>",
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
        title={language === "ar" ? "القيود اليومية" : "Journal Entries"}
        itemCount={journals?.length}
      />
    </div>
  );
};
export default JournalEntriesPage;
