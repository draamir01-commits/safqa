import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Users, Landmark, Banknote, Pencil, Trash2, FileText, UserPlus, CreditCard, CheckCircle, XCircle, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { useAuthStore } from "../../stores/authStore";
import { listenCompanyCollection, saveEmployee, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { db } from "../../firebase/config";
import { collection, onSnapshot } from "firebase/firestore";
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
            onClick={() => setShowPrint(true)}
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
