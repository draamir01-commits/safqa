import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ShieldAlert, Sparkles, Scale, Printer } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, saveJournal, deleteDocument } from "../../firebase/firestore";
import { JournalEntry, ChartOfAccount } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const JournalEntriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [journals, setJournals] = React.useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = React.useState<ChartOfAccount[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
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

          <button
            onClick={() => setShowPrint(true)}
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
