import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Printer } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, saveBill, deleteDocument } from "../../firebase/firestore";
import { Bill, CustomerOrSupplier } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";
import StatusBadge from "../../components/ui/StatusBadge";

export const BillsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [bills, setBills] = React.useState<Bill[]>([]);
  const [suppliers, setSuppliers] = React.useState<CustomerOrSupplier[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Form Fields
  const [billNumber, setBillNumber] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [amountBeforeVat, setAmountBeforeVat] = React.useState("");
  const [vatAmount, setVatAmount] = React.useState("");
  const [vatRate, setVatRate] = React.useState<0 | 5 | 15>(15);

  React.useEffect(() => {
    if (!currentCompany) return;

    const unsubBills = listenCompanyCollection(currentCompany.id, "bills", (data) => {
      setBills(data as Bill[]);
    });
    const unsubSuppliers = listenCompanyCollection(currentCompany.id, "suppliers", (data) => {
      setSuppliers(data as CustomerOrSupplier[]);
    });

    return () => {
      unsubBills();
      unsubSuppliers();
    };
  }, [currentCompany]);

  // Auto VAT Amount computation
  const baseValue = Number(amountBeforeVat) || 0;
  const computedVat = (baseValue * vatRate) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billNumber || !supplierId || !amountBeforeVat) {
      toast.error(language === "ar" ? "برجاء استكمال كافة الحقول" : "Please complete all fields");
      return;
    }

    setLoading(true);
    try {
      const activeSupplier = suppliers.find(s => s.id === supplierId);
      const subtotal = Number(amountBeforeVat);
      const totalVat = Number(vatAmount) || computedVat;
      const totalAmount = subtotal + totalVat;

      const billId = "bill_" + Math.random().toString(36).substr(2, 9);
      await saveBill(currentCompany!.id, billId, {
        billNumber,
        supplierId,
        supplierName: activeSupplier?.name || "Unknown",
        supplierNameAr: activeSupplier?.nameAr || "مورد مجهول",
        date,
        dueDate,
        amountBeforeVat: subtotal,
        vatRate,
        vatAmount: totalVat,
        totalAmount,
        status: "unpaid",
        notes: ""
      });

      toast.success(language === "ar" ? "تم تسجيل فاتورة الشراء بنجاح" : "Supplier bill recorded successfully");
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
      await deleteDocument(`companies/${currentCompany!.id}/bills`, id);
      toast.success(language === "ar" ? "تم حذف الفاتورة" : "Supplier bill deleted");
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
  };

  const resetForm = () => {
    setBillNumber("");
    setSupplierId("");
    setAmountBeforeVat("");
    setVatAmount("");
    setVatRate(15);
  };

  const columns: Column<Bill>[] = [
    {
      header: language === "ar" ? "فاتورة الشراء" : "Bill Number",
      render: (row) => (
        <span className="font-bold text-slate-800">{row.billNumber}</span>
      )
    },
    {
      header: language === "ar" ? "المورد" : "Supplier",
      render: (row) => (
        <span className="font-medium text-slate-700">
          {language === "ar" ? row.supplierNameAr : row.supplierName}
        </span>
      )
    },
    {
      header: language === "ar" ? "التاريخ" : "Issue Date",
      render: (row) => (
        <span className="text-xs text-slate-500">{row.date}</span>
      )
    },
    {
      header: language === "ar" ? "قيمة الضريبة" : "VAT Amount",
      render: (row) => (
        <CurrencyDisplay amount={row.vatAmount} className="text-xs text-red-600 font-semibold" />
      )
    },
    {
      header: language === "ar" ? "الإجمالي المستحق" : "Total Amount",
      render: (row) => (
        <CurrencyDisplay amount={row.totalAmount} className="text-xs font-bold text-slate-800" />
      )
    },
    {
      header: t("invoice.status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      )
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <button
          onClick={() => handleDelete(row.id)}
          className="p-1 text-slate-400 hover:text-brand-danger hover:bg-slate-100 rounded"
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
          <h2 className="text-xl font-bold text-slate-800">{t("nav.bills")}</h2>
          <p className="text-xs text-slate-500">Record incoming supplier receipts & automate purchase input tax reconciliation.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={bills} filename="bills" headers={{ billNumber: "Bill #", supplierName: "Supplier", issueDate: "Date", grandTotal: "Total", status: "Status" }} />
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "تسجيل فاتورة شراء" : "Add Supplier Bill"}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={bills}
        searchPlaceholder={language === "ar" ? "رقم الفاتورة..." : "Search by invoice..."}
        searchField="billNumber"
      />

      {/* Add Supplier Bill Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={language === "ar" ? "تسجيل فاتورة شراء جديدة" : "Record Supplier Bill"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "رقم مرجع الفاتورة للمورد" : "Supplier Bill/Reference Number"}
              placeholder="e.g. PUR-2026-90"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              required
            />
            <Select
              label={language === "ar" ? "اختيار المورد المسجل" : "Select Registered Supplier"}
              options={[
                { value: "", label: language === "ar" ? "اختيار المورد" : "Select Supplier" },
                ...suppliers.map(s => ({ value: s.id, label: language === "ar" ? s.nameAr : s.name }))
              ]}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t("invoice.issueDate")}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label={t("invoice.dueDate")}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
            <Input
              label={language === "ar" ? "القيمة الخاضعة للضريبة" : "Taxable Subtotal (SAR)"}
              type="number"
              placeholder="0.00"
              value={amountBeforeVat}
              onChange={(e) => setAmountBeforeVat(e.target.value)}
              required
            />
            <Select
              label={language === "ar" ? "معدل الضريبة المدفوع" : "Input VAT Rate"}
              options={[
                { value: 15, label: "15% Standard" },
                { value: 5, label: "5% Transition" },
                { value: 0, label: "0% Exempt" }
              ]}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value) as 0 | 5 | 15)}
            />
            <Input
              label={language === "ar" ? "قيمة الضريبة الفعلية" : "Actual VAT Amount (SAR)"}
              type="number"
              placeholder={computedVat.toFixed(2)}
              value={vatAmount}
              onChange={(e) => setVatAmount(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t mt-2">
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
        title={language === "ar" ? "سجل الفواتير" : "Bills Register"}
        itemCount={bills?.length}
      />
    </div>
  );
};
export default BillsPage;
