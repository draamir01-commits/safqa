import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Users, Landmark, Banknote, Pencil, Trash2, FileText, UserPlus, CreditCard, CheckCircle, XCircle, Printer, X} from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { useAuthStore } from "../../stores/authStore";
import { listenCompanyCollection, saveEmployee, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { db } from "../../firebase/config";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { isValidSaudiIban } from "../../utils/validators";
import { formatCurrency } from "../../utils/formatters";
import { SalaryAdvance } from "../../types";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

interface Employee {
  id: string; name: string; nameAr: string; nationalId: string;
  role: string; basicSalary: number; housingAllowance: number;
  transportAllowance: number; foodAllowance?: number; iban: string; isActive: boolean;
}

const PayslipModal: React.FC<{ employee: Employee; month: string; onClose: () => void; language: "ar" | "en" }> = ({ employee, month, onClose, language }) => {
  const { currentCompany } = useCompanyStore();
  const gross = employee.basicSalary + employee.housingAllowance + employee.transportAllowance + (employee.foodAllowance || 0);

  // Options for customising printout

  const [showLogo,       setShowLogo]       = React.useState(true);
  const [showLetterhead, setShowLetterhead] = React.useState(false);
  const [showStamp,      setShowStamp]      = React.useState(true);
  const [showDeductions, setShowDeductions] = React.useState(true);
  const [showAdvances,   setShowAdvances]   = React.useState(true);

  // Signatories from Firestore
  const [signatories, setSignatories] = React.useState<{ id: string; name: string; designation: string }[]>([]);
  const [selectedSig,  setSelectedSig]  = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = onSnapshot(collection(db, "companies", currentCompany.id, "signatories"),
      (s) => setSignatories(s.docs.map((d) => ({ id: d.id, ...d.data() } as any))));
    return () => unsub();
  }, [currentCompany]);

  const selectedSignatory = signatories.find(s => s.id === selectedSig);

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = `Payslip-${employee.name}-${month}`;
    window.print();
    document.title = prevTitle;
  };

  return (
    <Modal isOpen title={language === "ar" ? "كشف الراتب" : "Payslip"} onClose={onClose}>
      <div className="space-y-5 font-sans text-sm">

        {/* Print options */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-600 mb-3">{language === "ar" ? "خيارات الطباعة" : "Print Options"}</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "showLogo",       val: showLogo,       set: setShowLogo,       labelEn: "Show Logo",       labelAr: "إظهار الشعار" },
              { key: "showLetterhead", val: showLetterhead, set: setShowLetterhead, labelEn: "Show Letterhead",  labelAr: "إظهار ترويسة" },
              { key: "showStamp",      val: showStamp,      set: setShowStamp,      labelEn: "Show Stamp",       labelAr: "إظهار الختم" },
              { key: "showDeductions", val: showDeductions, set: setShowDeductions, labelEn: "Show Deductions",  labelAr: "إظهار الاستقطاعات" },
              { key: "showAdvances",   val: showAdvances,   set: setShowAdvances,   labelEn: "Show Advances",    labelAr: "إظهار السلف" },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                <input type="checkbox" checked={opt.val} onChange={e => opt.set(e.target.checked)} className="rounded" />
                {language === "ar" ? opt.labelAr : opt.labelEn}
              </label>
            ))}
          </div>
          {signatories.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600 mb-1">{language === "ar" ? "المفوض بالتوقيع" : "Authorized Signatory"}</p>
              <select value={selectedSig} onChange={e => setSelectedSig(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none">
                <option value="">{language === "ar" ? "بدون مفوض" : "None"}</option>
                {signatories.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Payslip document */}
        <div id="payslip-print" className="border border-slate-200 rounded-xl p-5">
          {/* Letterhead / header */}
          {showLetterhead && currentCompany && (
            <div className="flex items-start justify-between border-b pb-4 mb-4">
              {showLogo && currentCompany.logo ? (
                <img src={currentCompany.logo} alt="logo" className="h-12 object-contain" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold text-xl">
                  {(currentCompany.nameAr || currentCompany.name || "S")[0]}
                </div>
              )}
              <div className="text-end text-xs text-slate-500 space-y-0.5">
                <p className="font-bold text-slate-800 text-sm">{language === "ar" ? currentCompany.nameAr : currentCompany.name}</p>
                {currentCompany.vatNumber && <p>VAT: {currentCompany.vatNumber}</p>}
                {currentCompany.phone && <p>{currentCompany.phone}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-between items-start border-b pb-4 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{language === "ar" ? employee.nameAr : employee.name}</h3>
              <p className="text-slate-500 text-sm">{employee.role}</p>
              {employee.nationalId && <p className="text-xs text-slate-400">ID: {employee.nationalId}</p>}
            </div>
            <div className="text-end">
              <p className="text-xs text-slate-400">{language === "ar" ? "الشهر" : "Month"}</p>
              <p className="font-bold text-slate-800">{month}</p>
            </div>
          </div>

          {/* Earnings */}
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{language === "ar" ? "المستحقات" : "Earnings"}</p>
          <div className="space-y-2 mb-4">
            {[
              { label: language === "ar" ? "الراتب الأساسي" : "Basic Salary",       value: employee.basicSalary },
              { label: language === "ar" ? "بدل السكن" : "Housing Allowance",       value: employee.housingAllowance },
              { label: language === "ar" ? "بدل النقل" : "Transport Allowance",     value: employee.transportAllowance },
              ...(employee.foodAllowance ? [{ label: language === "ar" ? "بدل الطعام" : "Food Allowance", value: employee.foodAllowance }] : []),
            ].map((r, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-slate-600">{r.label}</span>
                <span className="font-semibold">{formatCurrency(r.value, language)}</span>
              </div>
            ))}
          </div>

          {showDeductions && (
            <>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{language === "ar" ? "الاستقطاعات" : "Deductions"}</p>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-slate-600">{language === "ar" ? "لا توجد استقطاعات" : "No deductions"}</span>
                <span className="font-semibold text-slate-400">{formatCurrency(0, language)}</span>
              </div>
            </>
          )}

          <div className="border-t-2 border-slate-800 pt-3 flex justify-between font-bold text-base">
            <span>{language === "ar" ? "صافي الراتب" : "Net Salary"}</span>
            <span className="text-brand-primary">{formatCurrency(gross, language)}</span>
          </div>

          <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            <p>IBAN: {employee.iban}</p>
          </div>

          {/* Signatory */}
          {selectedSignatory && (
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <div className="text-center text-xs text-slate-600">
                <div className="w-24 border-b border-slate-400 mb-1 mx-auto" />
                <p className="font-semibold">{selectedSignatory.name}</p>
                <p className="text-slate-400">{selectedSignatory.designation}</p>
              </div>
            </div>
          )}

          {showStamp && currentCompany?.logo && (
            <div className="mt-4 flex justify-end opacity-30">
              <img src={currentCompany.logo} alt="stamp" className="h-16 w-16 object-contain" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{language === "ar" ? "إغلاق" : "Close"}</Button>
          <Button onClick={handlePrint} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {language === "ar" ? "طباعة / PDF" : "Print / PDF"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export const PayrollPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = React.useState<"employees" | "advances">("employees");
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [advances, setAdvances] = React.useState<SalaryAdvance[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = React.useState(false);
  const [payslipEmployee, setPayslipEmployee] = React.useState<Employee | null>(null);
  const [runModalOpen, setRunModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showPrint, setShowPrint] = React.useState(false);

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

  // Employee form
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [nationalId, setNationalId] = React.useState("");
  const [role, setRole] = React.useState("Specialist");
  const [basicSalary, setBasicSalary] = React.useState("");
  const [housingAllowance, setHousingAllowance] = React.useState("");
  const [transportAllowance, setTransportAllowance] = React.useState("");
  const [foodAllowance, setFoodAllowance] = React.useState("");
  const [iban, setIban] = React.useState("SA");

  // Advance form
  const [advEmpId, setAdvEmpId] = React.useState("");
  const [advAmount, setAdvAmount] = React.useState("");
  const [advDate, setAdvDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [advReason, setAdvReason] = React.useState("");

  // Payroll run
  const [runMonth, setRunMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [selectedEmps, setSelectedEmps] = React.useState<string[]>([]);
  const [deductions, setDeductions] = React.useState<Record<string, string>>({});
  const [overtime, setOvertime] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "employees", d => setEmployees(d as Employee[]));
    const u2 = listenCompanyCollection(currentCompany.id, "salaryAdvances", d => setAdvances(d as SalaryAdvance[]));
    return () => { u1(); u2(); };
  }, [currentCompany]);

  const gross = (emp: Employee) => emp.basicSalary + emp.housingAllowance + emp.transportAllowance + (emp.foodAllowance || 0);
  const totalPayroll = employees.filter(e => e.isActive).reduce((s, e) => s + gross(e), 0);

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id); setName(emp.name); setNameAr(emp.nameAr);
    setNationalId(emp.nationalId); setRole(emp.role);
    setBasicSalary(String(emp.basicSalary)); setHousingAllowance(String(emp.housingAllowance));
    setTransportAllowance(String(emp.transportAllowance)); setFoodAllowance(String(emp.foodAllowance || ""));
    setIban(emp.iban); setModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !basicSalary || !currentCompany) return;
    if (iban && !isValidSaudiIban(iban)) return toast.error(language === "ar" ? "IBAN غير صحيح" : "Invalid Saudi IBAN");
    setLoading(true);
    try {
      const data = {
        name, nameAr, nationalId, role,
        basicSalary: +basicSalary, housingAllowance: +housingAllowance || 0,
        transportAllowance: +transportAllowance || 0, foodAllowance: +foodAllowance || 0,
        iban, isActive: true,
      };
      if (editingId) {
        await saveEmployee(currentCompany.id, editingId, data);
        toast.success(language === "ar" ? "تم التحديث" : "Employee updated");
      } else {
        const id = "emp_" + Math.random().toString(36).substr(2, 9);
        await saveEmployee(currentCompany.id, id, data);
        toast.success(language === "ar" ? "تم إضافة الموظف" : "Employee added");
      }
      setModalOpen(false); resetForm();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDeleteEmployee = async (id: string) => {
    if (!currentCompany || !window.confirm(language === "ar" ? "حذف الموظف؟" : "Delete employee?")) return;
    await deleteDocument(`companies/${currentCompany.id}/employees`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const handleSaveAdvance = async () => {
    if (!advEmpId || !advAmount || !currentCompany || !user) return toast.error(language === "ar" ? "أكمل البيانات" : "Fill all fields");
    const emp = employees.find(e => e.id === advEmpId);
    await addDocument(`companies/${currentCompany.id}/salaryAdvances`, {
      employeeId: advEmpId, employeeName: emp?.name || "", amount: +advAmount,
      date: advDate, reason: advReason, status: "approved",
      createdBy: user.uid, createdAt: new Date(),
    });
    toast.success(language === "ar" ? "تم تسجيل السلفة" : "Advance recorded");
    setAdvanceModalOpen(false); setAdvEmpId(""); setAdvAmount(""); setAdvReason("");
  };

  const handleSettleAdvance = async (adv: SalaryAdvance) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/salaryAdvances`, adv.id, { status: "settled", updatedAt: new Date() });
    toast.success(language === "ar" ? "تمت التسوية" : "Advance settled");
  };

  const handleRunPayroll = async () => {
    if (!currentCompany || !user || !selectedEmps.length) return toast.error(language === "ar" ? "اختر موظفاً على الأقل" : "Select at least one employee");
    setLoading(true);
    try {
      for (const empId of selectedEmps) {
        const emp = employees.find(e => e.id === empId);
        if (!emp) continue;
        const grossSalary = gross(emp);
        const ded = +(deductions[empId] || 0);
        const ot = +(overtime[empId] || 0);
        const net = grossSalary - ded + ot;
        await addDocument(`companies/${currentCompany.id}/payrollRuns`, {
          month: runMonth, employeeId: empId, employeeName: emp.name,
          basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance,
          transportAllowance: emp.transportAllowance, foodAllowance: emp.foodAllowance || 0,
          grossSalary, deductions: ded, overtime: ot, netSalary: net,
          iban: emp.iban, status: "processed",
          createdBy: user.uid, createdAt: new Date(),
        });
      }
      toast.success(language === "ar" ? `تم صرف رواتب ${selectedEmps.length} موظفين` : `Payroll processed for ${selectedEmps.length} employees`);
      setRunModalOpen(false); setSelectedEmps([]); setDeductions({}); setOvertime({});
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setEditingId(null); setName(""); setNameAr(""); setNationalId(""); setRole("Specialist");
    setBasicSalary(""); setHousingAllowance(""); setTransportAllowance(""); setFoodAllowance(""); setIban("SA");
  };

  const empColumns: Column<Employee>[] = [
    { header: language === "ar" ? "الموظف" : "Employee", render: r => (
      <div>
        <p className="font-semibold text-slate-800">{language === "ar" ? r.nameAr : r.name}</p>
        <p className="text-xs text-slate-500">{r.role} • {r.nationalId}</p>
      </div>
    )},
    { header: language === "ar" ? "الراتب الأساسي" : "Basic Salary", render: r => <CurrencyDisplay amount={r.basicSalary} /> },
    { header: language === "ar" ? "البدلات" : "Allowances", render: r => <CurrencyDisplay amount={r.housingAllowance + r.transportAllowance + (r.foodAllowance || 0)} /> },
    { header: language === "ar" ? "الإجمالي" : "Gross", render: r => <span className="font-bold text-brand-primary"><CurrencyDisplay amount={gross(r)} /></span> },
    { header: language === "ar" ? "إجراءات" : "Actions", render: r => (
      <div className="flex gap-1">
        <button onClick={() => setPayslipEmployee(r)} className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Payslip"><FileText className="h-4 w-4" /></button>
        <button onClick={() => openEdit(r)} className="p-1 text-slate-400 hover:text-brand-primary rounded"><Pencil className="h-4 w-4" /></button>
        <button onClick={() => handleDeleteEmployee(r.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("nav.payroll")}</h2>
          <p className="text-xs text-slate-500">Log team directories, verify WPS standards, and draft bank salary transfer sheets easily.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={employees} filename="employees" headers={{ name: "Name", nameAr: "Arabic Name", role: "Role", basicSalary: "Basic Salary", iban: "IBAN" }} />
          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          {employees.length > 0 && (
            <Button onClick={() => setRunModalOpen(true)} variant="secondary" className="flex items-center gap-2 bg-white">
              <Landmark className="h-4 w-4 text-emerald-500" />{language === "ar" ? "صرف الأجور WPS" : "Run Payroll"}
            </Button>
          )}
          <Button onClick={() => setAdvanceModalOpen(true)} variant="secondary" className="flex items-center gap-2 bg-white">
            <CreditCard className="h-4 w-4 text-amber-500" />{language === "ar" ? "سلفة" : "Advance"}
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />{language === "ar" ? "إضافة موظف" : "Add Employee"}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "عدد الموظفين" : "Total Employees"}</p>
          <p className="text-2xl font-bold text-slate-800">{employees.filter(e => e.isActive).length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "إجمالي الرواتب الشهرية" : "Monthly Payroll"}</p>
          <p className="text-2xl font-bold text-brand-primary">{formatCurrency(totalPayroll, language)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "سلف مستحقة" : "Pending Advances"}</p>
          <p className="text-2xl font-bold text-amber-600">{advances.filter(a => a.status !== "settled").reduce((s, a) => s + a.amount, 0).toLocaleString("en-SA")} SAR</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: "employees", labelEn: "Employees", labelAr: "الموظفون" },
          { id: "advances", labelEn: "Salary Advances", labelAr: "السلف" },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {language === "ar" ? tab.labelAr : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Employees tab */}
      {activeTab === "employees" && (
        <DataTable columns={empColumns} data={employees}
          searchPlaceholder={language === "ar" ? "البحث بالاسم..." : "Search by name..."} searchField="name" />
      )}

      {/* Advances tab */}
      {activeTab === "advances" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{[language === "ar" ? "الموظف" : "Employee", language === "ar" ? "المبلغ" : "Amount",
                language === "ar" ? "التاريخ" : "Date", language === "ar" ? "السبب" : "Reason",
                language === "ar" ? "الحالة" : "Status", ""].map((h, i) =>
                <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advances.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400 text-sm">{language === "ar" ? "لا توجد سلف" : "No advances"}</td></tr>
              ) : advances.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{a.employeeName}</td>
                  <td className="px-4 py-3 font-bold text-amber-600">{formatCurrency(a.amount, language)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.date}</td>
                  <td className="px-4 py-3 text-slate-600">{a.reason || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status === "settled" ? "bg-emerald-100 text-emerald-700" : a.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                      {a.status === "settled" ? (language === "ar" ? "مسوّاة" : "Settled") : a.status === "approved" ? (language === "ar" ? "معتمدة" : "Approved") : (language === "ar" ? "معلقة" : "Pending")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status !== "settled" && (
                      <button onClick={() => handleSettleAdvance(a)} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title={language === "ar" ? "تسوية" : "Settle"}>
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Employee Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingId ? (language === "ar" ? "تعديل بيانات الموظف" : "Edit Employee") : (language === "ar" ? "إضافة موظف جديد" : "Add New Employee")}>
        <form onSubmit={handleSaveEmployee} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={language === "ar" ? "الاسم (إنجليزي)" : "Full Name (EN)"} value={name} onChange={e => setName(e.target.value)} required />
            <Input label={language === "ar" ? "الاسم (عربي)" : "Full Name (AR)"} value={nameAr} onChange={e => setNameAr(e.target.value)} required />
            <Input label={language === "ar" ? "رقم الهوية / الإقامة" : "National / Iqama ID"} value={nationalId} onChange={e => setNationalId(e.target.value)} />
            <Input label={language === "ar" ? "المسمى الوظيفي" : "Job Role"} value={role} onChange={e => setRole(e.target.value)} />
            <Input label={language === "ar" ? "الراتب الأساسي (ر.س)" : "Basic Salary (SAR)"} type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} required />
            <Input label={language === "ar" ? "بدل السكن" : "Housing Allowance"} type="number" value={housingAllowance} onChange={e => setHousingAllowance(e.target.value)} />
            <Input label={language === "ar" ? "بدل النقل" : "Transport Allowance"} type="number" value={transportAllowance} onChange={e => setTransportAllowance(e.target.value)} />
            <Input label={language === "ar" ? "بدل الطعام" : "Food Allowance"} type="number" value={foodAllowance} onChange={e => setFoodAllowance(e.target.value)} />
            <Input label="IBAN" value={iban} onChange={e => setIban(e.target.value)} placeholder="SA0380000000608010167519" className="md:col-span-2" />
          </div>
          {basicSalary && (
            <div className="bg-slate-50 rounded-lg p-3 flex justify-between text-sm">
              <span className="text-slate-500">{language === "ar" ? "إجمالي الراتب الشهري:" : "Total Monthly Salary:"}</span>
              <span className="font-bold text-brand-primary">{formatCurrency(+basicSalary + +housingAllowance + +transportAllowance + +foodAllowance, language)}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button type="submit" loading={loading}>{editingId ? (language === "ar" ? "حفظ التعديلات" : "Save Changes") : (language === "ar" ? "إضافة الموظف" : "Add Employee")}</Button>
          </div>
        </form>
      </Modal>

      {/* Salary Advance Modal */}
      <Modal isOpen={advanceModalOpen} onClose={() => setAdvanceModalOpen(false)} title={language === "ar" ? "تسجيل سلفة راتب" : "Record Salary Advance"}>
        <div className="flex flex-col gap-4">
          <Select label={language === "ar" ? "الموظف" : "Employee"} value={advEmpId} onChange={e => setAdvEmpId(e.target.value)}
            options={[{ value: "", label: language === "ar" ? "اختر موظف..." : "Select employee..." }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
          <Input label={language === "ar" ? "مبلغ السلفة (ر.س)" : "Advance Amount (SAR)"} type="number" value={advAmount} onChange={e => setAdvAmount(e.target.value)} min="0" />
          <Input label={language === "ar" ? "التاريخ" : "Date"} type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} />
          <Input label={language === "ar" ? "السبب" : "Reason"} value={advReason} onChange={e => setAdvReason(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdvanceModalOpen(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSaveAdvance} loading={loading}>{language === "ar" ? "تسجيل السلفة" : "Record Advance"}</Button>
          </div>
        </div>
      </Modal>

      {/* Run Payroll Modal */}
      <Modal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)} title={language === "ar" ? "صرف رواتب WPS" : "Run Payroll (WPS)"} size="lg">
        <div className="flex flex-col gap-4">
          <Input label={language === "ar" ? "شهر الصرف" : "Payroll Month"} type="month" value={runMonth} onChange={e => setRunMonth(e.target.value)} />
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">{language === "ar" ? "اختر الموظفين" : "Select Employees"}</span>
              <button onClick={() => setSelectedEmps(selectedEmps.length === employees.length ? [] : employees.map(e => e.id))}
                className="text-xs text-brand-primary font-semibold hover:underline">
                {selectedEmps.length === employees.length ? (language === "ar" ? "إلغاء الكل" : "Deselect All") : (language === "ar" ? "تحديد الكل" : "Select All")}
              </button>
            </div>
            {employees.filter(e => e.isActive).map(emp => {
              const isSelected = selectedEmps.includes(emp.id);
              return (
                <div key={emp.id} className={`flex items-center gap-4 px-4 py-3 border-b border-slate-100 last:border-0 ${isSelected ? "bg-blue-50/50" : ""}`}>
                  <input type="checkbox" checked={isSelected}
                    onChange={e => setSelectedEmps(prev => e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id))}
                    className="rounded border-slate-300" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{language === "ar" ? emp.nameAr : emp.name}</p>
                    <p className="text-xs text-slate-500">{language === "ar" ? "الراتب:" : "Salary:"} {formatCurrency(gross(emp), language)}</p>
                  </div>
                  {isSelected && (
                    <div className="flex gap-2">
                      <input type="number" value={deductions[emp.id] || ""} onChange={e => setDeductions(prev => ({ ...prev, [emp.id]: e.target.value }))}
                        placeholder={language === "ar" ? "خصومات" : "Deductions"} min="0"
                        className="w-24 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                      <input type="number" value={overtime[emp.id] || ""} onChange={e => setOvertime(prev => ({ ...prev, [emp.id]: e.target.value }))}
                        placeholder={language === "ar" ? "إضافي" : "Overtime"} min="0"
                        className="w-24 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {selectedEmps.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 flex justify-between text-sm">
              <span className="text-slate-500">{language === "ar" ? `إجمالي الرواتب (${selectedEmps.length} موظفين):` : `Total for ${selectedEmps.length} employees:`}</span>
              <span className="font-bold text-brand-primary">
                {formatCurrency(
                  employees.filter(e => selectedEmps.includes(e.id)).reduce((s, e) => s + gross(e) - +(deductions[e.id] || 0) + +(overtime[e.id] || 0), 0),
                  language
                )}
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRunModalOpen(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleRunPayroll} loading={loading} disabled={!selectedEmps.length} className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />{language === "ar" ? `صرف لـ ${selectedEmps.length} موظفين` : `Process ${selectedEmps.length} Employees`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Payslip Modal */}
      {payslipEmployee && (
        <PayslipModal employee={payslipEmployee} month={runMonth} onClose={() => setPayslipEmployee(null)} language={language} />
      )}


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "سجل الرواتب" : "Payroll Register"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Payroll Register</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (employees as any[]).map((row: any, i: number) => {
                      const cells = [String(row.name||""), String(row.department||""), String(row.basicSalary||""), String(row.status||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Payroll Register</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Payroll Register</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Employee</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Department</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Basic Salary</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Status</th>",
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
        title={language === "ar" ? "سجل الرواتب" : "Payroll Register"}
        itemCount={employees?.length}
      />
    </div>
  );
};
export default PayrollPage;
