import * as React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ShieldAlert, Printer } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { listenCompanyCollection, saveAccountNode } from "../../firebase/firestore";
import { ChartOfAccount, AccountType } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const ChartOfAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [accounts, setAccounts] = React.useState<ChartOfAccount[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // Form Fields
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [type, setType] = React.useState<AccountType>(AccountType.ASSET);

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "chartOfAccounts", (data) => {
      // Sort by account code ascending
      const sorted = (data as ChartOfAccount[]).sort((a, b) => a.code.localeCompare(b.code));
      setAccounts(sorted);
    });
    return unsubscribe;
  }, [currentCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !nameAr) {
      toast.error(language === "ar" ? "برجاء توفير الرمز والاسم" : "Code, Arabic, and English names are required");
      return;
    }

    setLoading(true);
    try {
      await saveAccountNode(currentCompany!.id, code, {
        code,
        name,
        nameAr,
        type,
        balance: 0,
        currency: "SAR",
        isActive: true
      });

      toast.success(language === "ar" ? "تم إضافة المادة في دليل الحسابات" : "Account node appended in Chart of Accounts ledger");
      setModalOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCode("");
    setName("");
    setNameAr("");
    setType(AccountType.ASSET);
  };

  const columns: Column<ChartOfAccount>[] = [
    {
      header: language === "ar" ? "رمز الحساب" : "Account Code",
      render: (row) => (
        <span className="font-mono text-xs font-bold text-slate-800">{row.code}</span>
      )
    },
    {
      header: language === "ar" ? "المسمى المحاسبي" : "Account Title",
      render: (row) => (
        <div className="flex flex-col text-right rtl:text-right ltr:text-left">
          <span className="font-bold text-slate-850">{language === "ar" ? row.nameAr : row.name}</span>
          <span className="text-[9px] text-slate-400 capitalize">{row.type.toLowerCase()} account</span>
        </div>
      )
    },
    {
      header: language === "ar" ? "مستوى التبويب الرئيسي" : "Account Type",
      render: (row) => {
        const types: { [key: string]: string } = {
          asset: "bg-blue-50 text-blue-700 border-blue-200",
          liability: "bg-red-50 text-red-700 border-red-200",
          equity: "bg-purple-50 text-purple-700 border-purple-200",
          revenue: "bg-emerald-50 text-emerald-700 border-emerald-250",
          expense: "bg-amber-50 text-amber-700 border-amber-200"
        };
        const cl = types[row.type.toLowerCase()] || "bg-slate-50 text-slate-600";
        return (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded border uppercase ${cl}`}>
            {row.type}
          </span>
        );
      }
    },
    {
      header: language === "ar" ? "الميزان والفرع العام" : "Running Balance (SAR)",
      render: (row) => (
        <CurrencyDisplay amount={row.balance} className="text-xs font-bold text-slate-800" />
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("nav.chartOfAccounts")}</h2>
          <p className="text-xs text-slate-500">Corporate Chart of Accounts (COA) mapped per Saudi Ministry of Commerce standards.</p>
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
          {language === "ar" ? "إضافة حساب جديد" : "Add Account Node"}
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={accounts}
        searchPlaceholder={language === "ar" ? "البحث بالرمز أو الاسم..." : "Search by code or title..."}
        searchField="code"
      />

      {/* Add Account Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={language === "ar" ? "تأسيس حساب فرعي جديد" : "Define LEDGER Node"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "رمز كود الحساب (رقم فريد)" : "Unique Code Target (e.g. 104)"}
              placeholder="e.g. 10102"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Select
              label={language === "ar" ? "تصنيف الحساب المحاسبي" : "Class Category"}
              options={[
                { value: AccountType.ASSET, label: "Asset / أصول" },
                { value: AccountType.LIABILITY, label: "Liability / التزامات ومطلوبات" },
                { value: AccountType.EQUITY, label: "Equity / حقوق الملكية" },
                { value: AccountType.REVENUE, label: "Revenue / إيرادات ومبيعات" },
                { value: AccountType.EXPENSE, label: "Expense / مصروفات تشغيلية" }
              ]}
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "الاسم بالإنجليزي" : "Name (English)"}
              placeholder="e.g. SABB Bank Account"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={language === "ar" ? "اسم البند بالعربي" : "Name (Arabic)"}
              placeholder="مثال: حساب البنك الأول SABB"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
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
        title={language === "ar" ? "دليل الحسابات" : "Chart of Accounts"}
        itemCount={accounts?.length}
      />
    </div>
  );
};
export default ChartOfAccountsPage;
