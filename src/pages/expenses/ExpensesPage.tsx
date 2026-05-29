import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Upload, Sparkles, Printer } from "lucide-react";
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

export const ExpensesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
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
            onClick={() => setShowPrint(true)}
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
