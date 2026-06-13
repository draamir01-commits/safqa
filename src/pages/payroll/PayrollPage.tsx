import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import {
  Plus, Users, Landmark, Banknote, Pencil, Trash2, FileText,
  CreditCard, CheckCircle, Printer, X, AlertTriangle, Download,
  ShieldCheck, TrendingUp, Clock, Calendar, UserCheck, ChevronDown, ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import {
  listenCompanyCollection, saveEmployee, addDocument,
  updateDocument, deleteDocument
} from "../../firebase/firestore";
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

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Employee {
  id: string;
  // Identity
  name: string;
  nameAr: string;
  nationality: string;
  gender: "male" | "female";
  dateOfBirth: string;
  nationalId: string;        // 10 digits starting with 1 (Saudi)
  iqamaNumber: string;       // 10 digits starting with 2 (expat)
  iqamaExpiry: string;
  workPermitNumber: string;
  workPermitExpiry: string;
  // Employment
  role: string;
  department: string;
  contractType: "unlimited" | "fixed";
  contractEndDate: string;
  joinDate: string;
  email: string;
  mobile: string;
  // Compensation
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  otherAllowances: number;
  // GOSI
  gosiEnrolled: boolean;
  gosiId: string;
  // Banking
  bankName: string;
  iban: string;
  // Status
  isActive: boolean;
}

interface PayrollRunRecord {
  id: string;
  month: string;           // "2025-01"
  periodLabel: string;     // "January 2025"
  status: "draft" | "approved" | "paid";
  employees: PayrollRunEmployee[];
  totalGross: number;
  totalGosiEmployee: number;
  totalGosiEmployer: number;
  totalDeductions: number;
  totalNet: number;
  createdBy: string;
  createdAt: any;
}

interface PayrollRunEmployee {
  employeeId: string;
  name: string;
  nameAr: string;
  nationality: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  foodAllowance: number;
  otherAllowances: number;
  grossSalary: number;
  gosiEmployee: number;
  gosiEmployer: number;
  absenceDeduction: number;
  lateDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  overtime: number;
  totalDeductions: number;
  netSalary: number;
  iban: string;
  bankName: string;
}

interface LeaveBalance {
  id: string;
  employeeId: string;
  employeeName: string;
  year: number;
  annualEntitlement: number;
  taken: number;
  balance: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const isSaudi = (emp: Employee) =>
  emp.nationality?.toLowerCase() === "saudi" ||
  emp.nationality?.toLowerCase() === "سعودي" ||
  emp.nationalId?.startsWith("1");

const calcGosi = (emp: Employee) => {
  const basic = emp.basicSalary + emp.housingAllowance;          // GOSI base
  if (!emp.gosiEnrolled) return { employee: 0, employer: 0 };
  if (isSaudi(emp)) {
    return {
      employee: Math.round(basic * 0.10 * 100) / 100,           // 9% GOSI + 1% SANED
      employer: Math.round(basic * 0.12 * 100) / 100,           // 9% GOSI + 2% hazard + 1% SANED
    };
  }
  return {
    employee: 0,
    employer: Math.round(basic * 0.02 * 100) / 100,             // 2% occupational hazard only
  };
};

const calcGross = (emp: Employee) =>
  emp.basicSalary + emp.housingAllowance + emp.transportAllowance +
  emp.foodAllowance + emp.otherAllowances;

const calcEosb = (emp: Employee) => {
  if (!emp.joinDate) return 0;
  const years = (Date.now() - new Date(emp.joinDate).getTime()) /
    (1000 * 60 * 60 * 24 * 365.25);
  if (years < 1) return 0;
  const monthly = years < 5
    ? emp.basicSalary * 0.5
    : emp.basicSalary;
  return Math.round(monthly * Math.min(years, 30) * 100) / 100;
};

const validateNationalId = (id: string) =>
  /^1\d{9}$/.test(id.trim());
const validateIqama = (iq: string) =>
  /^2\d{9}$/.test(iq.trim());

const numberToArabicWords = (n: number): string => {
  if (n === 0) return "صفر ريال سعودي";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة",
    "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر",
    "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const r = Math.round(n);
  if (r < 20) return ones[r] + " ريال سعودي";
  if (r < 100) return tens[Math.floor(r / 10)] + (r % 10 ? " و" + ones[r % 10] : "") + " ريال سعودي";
  if (r < 1000) return ones[Math.floor(r / 100)] + " مئة" + (r % 100 ? " و" + numberToArabicWords(r % 100).replace(" ريال سعودي", "") : "") + " ريال سعودي";
  if (r < 10000) return ones[Math.floor(r / 1000)] + " آلاف" + (r % 1000 ? " و" + numberToArabicWords(r % 1000).replace(" ريال سعودي", "") : "") + " ريال سعودي";
  return n.toLocaleString("ar-SA") + " ريال سعودي";
};

const daysInMonth = (monthStr: string) => {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

// ─────────────────────────────────────────────
// Generate WPS SIF file content
// ─────────────────────────────────────────────
const generateWpsSif = (
  company: any,
  employees: PayrollRunEmployee[],
  month: string,
  paymentDate: string
): string => {
  const [year, mon] = month.split("-");
  const pad = (v: string | number, len: number) => String(v).padEnd(len, " ").slice(0, len);
  const padR = (v: string | number, len: number) => String(v).padStart(len, "0").slice(0, len);
  const EIN = pad(company?.crNumber || "0000000000", 10);
  const agentId = pad(company?.wpsAgentId || "0000000000", 10);
  const salaryMonth = `${year}${mon}`;
  const payDate = paymentDate.replace(/-/g, "");
  const numEmps = padR(employees.length, 6);
  const totalAmount = padR(
    Math.round(employees.reduce((s, e) => s + e.netSalary, 0) * 100), 15
  );
  const header = `EDR${pad(EIN, 10)}${pad(agentId, 10)}${salaryMonth}${numEmps}${totalAmount}`;
  const details = employees.map(emp => {
    const idType = emp.nationality?.toLowerCase() === "saudi" ? "NI" : "IQ";
    const idNum = pad(
      idType === "NI"
        ? (emp as any).nationalId || ""
        : (emp as any).iqamaNumber || "",
      20
    );
    const net = padR(Math.round(emp.netSalary * 100), 15);
    const iban = pad(emp.iban?.replace(/\s/g, "") || "", 24);
    const bank = pad(emp.bankName || "", 4);
    return `EMP${idType}${idNum}${iban}${bank}${net}${payDate}`;
  }).join("\n");
  return `${header}\n${details}\nEOF`;
};

// ─────────────────────────────────────────────
// Payslip Modal — uses same export panel as invoices/POs
// ─────────────────────────────────────────────
const PayslipModal: React.FC<{
  employee: Employee;
  month: string;
  advanceDeduction?: number;
  onClose: () => void;
  language: "ar" | "en";
}> = ({ employee, month, advanceDeduction = 0, onClose, language }) => {
  const { currentCompany } = useCompanyStore();

  // ── Adjustments ──────────────────────────────
  const [absenceDays, setAbsenceDays] = React.useState(0);
  const [lateDays, setLateDays] = React.useState(0);
  const [otherDed, setOtherDed] = React.useState(0);
  const [overtimeHours, setOvertimeHours] = React.useState(0);

  // ── Export panel state (mirrors InvoicesPage exactly) ──
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

  // Derived salary values
  const gross = calcGross(employee);
  const gosi = calcGosi(employee);
  const dailyRate = employee.basicSalary / 30;
  const hourlyRate = employee.basicSalary / (30 * 8);
  const absenceDed = Math.round(dailyRate * absenceDays * 100) / 100;
  const lateDed = Math.round(dailyRate * lateDays * 0.5 * 100) / 100;
  const overtimePay = Math.round(hourlyRate * 1.5 * overtimeHours * 100) / 100;
  const totalDed = gosi.employee + absenceDed + lateDed + advanceDeduction + otherDed;
  const net = gross + overtimePay - totalDed;

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
            const found = sigs.find((s: any) => s.id === co.defaultSignatoryId);
            if (found) { setExpSigId(found.id); setExpIncludeSig(!!(found as any).signatureUrl); }
          }
        }).catch(() => {});
    }
    setShowExportPanel(true);
  };

  return (
    <>
      <Modal isOpen title={language === "ar" ? "كشف الراتب" : "Generate Payslip"} onClose={onClose} size="lg">
        <div className="space-y-4">

          {/* Employee summary */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800">{employee.name}</p>
              <p className="text-xs text-slate-500">{employee.role}{employee.department ? ` • ${employee.department}` : ""}</p>
              <p className="text-xs text-slate-400">{month}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Gross</p>
              <p className="font-bold text-brand-primary text-lg">{formatCurrency(gross, language)}</p>
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Absence Days</label>
              <input type="number" min={0} max={30} value={absenceDays}
                onChange={e => setAbsenceDays(+e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Late Days (½-day deduction)</label>
              <input type="number" min={0} max={30} value={lateDays}
                onChange={e => setLateDays(+e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Overtime Hours @ 150%</label>
              <input type="number" min={0} value={overtimeHours}
                onChange={e => setOvertimeHours(+e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Other Deductions (SAR)</label>
              <input type="number" min={0} value={otherDed}
                onChange={e => setOtherDed(+e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary" />
            </div>
          </div>

          {/* GOSI preview */}
          {employee.gosiEnrolled && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Employee GOSI ({isSaudi(employee) ? "10%" : "0%"})</span>
                <span className="float-right font-bold text-red-600">- SAR {gosi.employee.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500">Employer GOSI ({isSaudi(employee) ? "12%" : "2%"})</span>
                <span className="float-right font-bold text-emerald-600">SAR {gosi.employer.toFixed(2)}</span>
              </div>
            </div>
          )}

          {advanceDeduction > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              ⚠ Advance deduction of SAR {advanceDeduction.toFixed(2)} will appear on this payslip.
            </div>
          )}

          {/* Net */}
          <div className="bg-slate-900 text-white rounded-xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400">Net Salary — صافي الراتب</p>
              <p className="text-[10px] text-slate-500 mt-1">{numberToArabicWords(Math.round(net))}</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(net, language)}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>{language === "ar" ? "إغلاق" : "Close"}</Button>
            <Button onClick={openExportPanel} className="flex items-center gap-2">
              <Printer className="h-4 w-4" />
              {language === "ar" ? "طباعة / PDF" : "Print / PDF"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Export Panel (same style as invoices) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-[60] flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "تصدير كشف الراتب" : "Export Payslip PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{employee.name} — {month}</p>
              </div>
              <button onClick={() => setShowExportPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto">

              {/* Letterhead */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "الترويسة" : "Letterhead"}
                </p>
                <div className="space-y-2">
                  {([
                    { mode: "none",   icon: "⊘", labelEn: "No Letterhead",        descEn: "Plain company text header" },
                    { mode: "header", icon: "▬", labelEn: "Header + Footer",       descEn: "Banner image top & bottom" },
                    { mode: "full",   icon: "▮", labelEn: "Full Page Letterhead",  descEn: "Full A4 background every page" },
                  ] as const).map(opt => (
                    <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${expLHMode === opt.mode ? "border-brand-primary bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="radio" name="psLHMode" checked={expLHMode === opt.mode} onChange={() => setExpLHMode(opt.mode)} className="mt-0.5 text-brand-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <span className="text-xs font-semibold text-slate-700">{opt.labelEn}</span>
                          {opt.mode === "full" && !(currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-amber-500 font-semibold">not uploaded</span>}
                          {opt.mode === "full" && (currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-emerald-500 font-semibold">✓ A4</span>}
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
                        {lh.url ? <img src={lh.url} alt={lh.name} className="h-7 object-contain rounded border border-slate-200 bg-white" /> : <div className="h-7 w-10 bg-slate-100 rounded border" />}
                        <span className="text-xs font-medium text-slate-700">{lh.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Logo & Stamp */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "الشعار والختم" : "Logo & Stamp"}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Include Logo</span>
                      {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">No logo uploaded</p>}
                    </div>
                    <input type="checkbox" checked={expLogo} onChange={e => setExpLogo(e.target.checked)}
                      disabled={!(currentCompany as any)?.logo} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">Include Stamp</span>
                      {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">No stamp uploaded</p>}
                    </div>
                    <input type="checkbox" checked={expStamp} onChange={e => setExpStamp(e.target.checked)}
                      disabled={!(currentCompany as any)?.stamp} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                </div>
              </div>

              {/* Signatory */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "التوقيع المفوض" : "Authorized Signatory"}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={expSigId} onChange={e => setExpSigId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">None</option>
                    {expSignatories.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>
                  {expSigId && expSignatories.find((s: any) => s.id === expSigId)?.signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer mt-1">
                      <span className="text-xs text-slate-600">Include signature image</span>
                      <input type="checkbox" checked={expIncludeSig} onChange={e => setExpIncludeSig(e.target.checked)}
                        className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                  {expSignatories.length === 0 && <p className="text-[10px] text-slate-400">Add signatories in Settings</p>}
                </div>
              </div>

              {/* Preview strip */}
              {(expLHMode !== "none" || expLogo || expStamp || expSigId) && (
                <div className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 space-y-1">
                  <p className="font-bold text-white text-xs mb-2">PDF will include:</p>
                  {expLHMode === "full"   && <p>✓ Full page letterhead</p>}
                  {expLHMode === "header" && <p>✓ Header + footer banner</p>}
                  {expLogo && (currentCompany as any)?.logo && <p>✓ Company logo</p>}
                  {expStamp && (currentCompany as any)?.stamp && <p>✓ Company stamp</p>}
                  {expSigId && <p>✓ {expSignatories.find((s: any) => s.id === expSigId)?.name}</p>}
                </div>
              )}
            </div>

            {/* Generate button */}
            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                disabled={expGenerating}
                onClick={async () => {
                  const win = window.open("", "_blank", "width=960,height=800");
                  if (!win) { toast.error("Please allow popups"); return; }
                  win.document.write("<html><body style='font-family:sans-serif;padding:40px;color:#555'>Generating Payslip...</body></html>");
                  setExpGenerating(true);
                  setShowExportPanel(false);
                  try {
                    const co = currentCompany as any;
                    const selLH = expLetterheads.find((l: any) => l.id === expLHId) || expLetterheads[0];
                    const lhUrl = selLH?.url || co?.fullLetterhead || "";
                    const headerUrl = co?.headerAsset || co?.letterheadHeader || "";
                    const footerUrl = co?.footerAsset || co?.letterheadFooter || "";
                    const sigObj = expSignatories.find((s: any) => s.id === expSigId);

                    // ── Build headerHTML / footerHTML / padTop / padBot ──
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
                      const leftLines = [co?.address, co?.city ? co.city + ", KSA" : "", co?.phone,
                        co?.vatNumber ? "VAT: " + co.vatNumber : "", co?.crNumber ? "CR: " + co.crNumber : ""]
                        .filter(Boolean).map((l: string) => `<div style="font-size:7.5pt;color:#444;line-height:1.7">${l}</div>`).join("");
                      headerHTML = `<table style="width:100%;border-bottom:2px solid #e2e8f0;margin-bottom:12px;border-collapse:collapse"><tr>
                        <td style="width:38%;vertical-align:top;padding-bottom:10px"><div style="font-size:11pt;font-weight:700;margin-bottom:4px">${co?.name || ""}</div>${leftLines}</td>
                        <td style="width:24%;text-align:center;vertical-align:middle;padding:0 8px 10px">
                          ${expLogo && co?.logo ? `<img src="${co.logo}" style="max-height:55px;max-width:110px;object-fit:contain;display:block;margin:0 auto"/>` : ""}
                        </td>
                        <td style="width:38%;text-align:right;vertical-align:top;padding-bottom:10px">
                          <div style="font-family:Cairo,Arial,sans-serif;font-size:11pt;font-weight:700;direction:rtl;margin-bottom:4px">${co?.nameAr || co?.name || ""}</div>
                        </td>
                      </tr></table>`;
                    }

                    const pgNum = `<div style="display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name || ""}</span><span>Payslip — ${employee.name} — ${month}</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;z-index:10">${pgNum}</div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff">
                        <div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0">${pgNum}</div>
                        <img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/>
                      </div>`;
                      padBot = "32mm";
                    }

                    // ── Signatory block ──
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `
                      <div style="margin-top:20px;padding-top:12px;border-top:1.5px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px">
                        <div style="text-align:center;font-size:8pt">
                          <div style="border-bottom:1px solid #1a1a1a;width:140px;margin:32px auto 5px"></div>
                          <div style="font-weight:600">${employee.name}</div>
                          <div style="color:#9ca3af;font-size:7.5pt">Employee Signature — توقيع الموظف</div>
                        </div>
                        ${sigObj ? `<div style="text-align:center;font-size:8pt">
                          ${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin:0 auto 6px"/>` : `<div style="height:36px"></div>`}
                          <div style="border-bottom:1.5px solid #1a1a1a;width:160px;margin-bottom:5px"></div>
                          <div style="font-weight:700">${sigObj.name}</div>
                          <div style="font-size:7.5pt;color:#6b7280">${sigObj.designation || "Authorized Signatory"}</div>
                        </div>` : ""}
                        ${expStamp && co?.stamp ? `<div style="text-align:center">
                          <img src="${co.stamp}" style="width:75px;height:75px;object-fit:contain;opacity:0.8"/>
                          <div style="font-size:7pt;color:#9ca3af;margin-top:3px">Company Stamp</div>
                        </div>` : ""}
                      </div>` : "";

                    // ── Earnings/deductions rows ──
                    const earningRows = [
                      ["Basic Salary — الراتب الأساسي", employee.basicSalary],
                      ["Housing Allowance — بدل السكن", employee.housingAllowance],
                      ["Transport Allowance — بدل النقل", employee.transportAllowance],
                      ...(employee.foodAllowance ? [["Food Allowance — بدل الطعام", employee.foodAllowance]] : []),
                      ...(employee.otherAllowances ? [["Other Allowances", employee.otherAllowances]] : []),
                      ...(overtimePay > 0 ? [[`Overtime (${overtimeHours}h × 150%)`, overtimePay]] : []),
                    ].map(([label, val]) =>
                      `<tr><td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${label}</td><td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right">${Number(val).toFixed(2)}</td></tr>`
                    ).join("");

                    const deductionRows = [
                      ...(gosi.employee > 0 ? [[`GOSI Employee (${isSaudi(employee) ? "10%" : "0%"}) — اشتراك التأمينات`, gosi.employee]] : []),
                      ...(absenceDed > 0 ? [[`Absence (${absenceDays} days)`, absenceDed]] : []),
                      ...(lateDed > 0 ? [[`Late Deduction (${lateDays} days)`, lateDed]] : []),
                      ...(advanceDeduction > 0 ? [["Advance Deduction — استقطاع سلفة", advanceDeduction]] : []),
                      ...(otherDed > 0 ? [["Other Deductions", otherDed]] : []),
                    ].map(([label, val]) =>
                      `<tr><td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${label}</td><td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right;color:#dc2626">${Number(val).toFixed(2)}</td></tr>`
                    ).join("");

                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      `<title>Payslip - ${employee.name} - ${month}</title>`,
                      "<style>",
                      "*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,

                      // Title
                      `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
                        <div>
                          <div style="font-size:18pt;font-weight:800;color:#1a1a1a">Payslip</div>
                          <div style="font-size:10pt;color:#6b7280;margin-top:2px;font-family:Cairo,Arial,sans-serif;direction:rtl">كشف الراتب</div>
                        </div>
                        <div style="text-align:right">
                          <div style="font-size:11pt;font-weight:700;color:#1e40af">${month}</div>
                          <div style="font-size:8pt;color:#6b7280;margin-top:2px">Payment via Bank Transfer — WPS</div>
                        </div>
                      </div>`,

                      // Employee info table
                      `<table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:14px">
                        <tr>
                          <td style="width:22%;padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">Employee</td>
                          <td style="width:28%;padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt;font-weight:600">${employee.name}</td>
                          <td style="width:22%;padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151;font-family:Cairo,Arial,sans-serif;direction:rtl">الموظف</td>
                          <td style="width:28%;padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt;direction:rtl;font-family:Cairo,Arial,sans-serif">${employee.nameAr}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">Job Title</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.role}</td>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">Department</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.department || "—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">ID / Iqama</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.nationalId || employee.iqamaNumber || "—"}</td>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">GOSI ID</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.gosiId || "—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">Bank</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.bankName || "—"}</td>
                          <td style="padding:6px 10px;background:#f8fafc;border:1px solid #cbd5e1;font-size:7.5pt;font-weight:700;color:#374151">IBAN</td>
                          <td style="padding:6px 10px;border:1px solid #cbd5e1;font-size:8pt">${employee.iban || "—"}</td>
                        </tr>
                      </table>`,

                      // Earnings
                      `<div style="display:flex;gap:12px;margin-bottom:14px">
                        <div style="flex:1">
                          <div style="background:#16a34a;color:#fff;padding:7px 10px;font-size:7.5pt;font-weight:800;letter-spacing:1px;text-transform:uppercase">Earnings — المستحقات</div>
                          <table style="width:100%;border-collapse:collapse">
                            ${earningRows}
                            <tr style="background:#f0fdf4">
                              <td style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:8.5pt;font-weight:700">Gross Salary — إجمالي الراتب</td>
                              <td style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:8.5pt;font-weight:700;text-align:right">${(gross + overtimePay).toFixed(2)}</td>
                            </tr>
                          </table>
                        </div>
                        <div style="flex:1">
                          <div style="background:#dc2626;color:#fff;padding:7px 10px;font-size:7.5pt;font-weight:800;letter-spacing:1px;text-transform:uppercase">Deductions — الاستقطاعات</div>
                          <table style="width:100%;border-collapse:collapse">
                            ${deductionRows || `<tr><td colspan="2" style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:8pt;color:#9ca3af">No deductions</td></tr>`}
                            <tr style="background:#fef2f2">
                              <td style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:8.5pt;font-weight:700">Total Deductions</td>
                              <td style="padding:6px 8px;border:0.5px solid #e2e8f0;font-size:8.5pt;font-weight:700;text-align:right;color:#dc2626">${totalDed.toFixed(2)}</td>
                            </tr>
                          </table>
                        </div>
                      </div>`,

                      // Net salary
                      `<table style="width:100%;border-collapse:collapse;margin-bottom:8px">
                        <tr style="background:#1e3a8a">
                          <td style="padding:10px 12px;font-size:11pt;font-weight:800;color:#fff">NET SALARY — صافي الراتب</td>
                          <td style="padding:10px 12px;font-size:11pt;font-weight:800;color:#fff;text-align:right">SAR ${net.toFixed(2)}</td>
                        </tr>
                      </table>`,

                      // Amount in Arabic words
                      `<div style="padding:7px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px;font-size:8pt;color:#166534;margin-bottom:8px">
                        المبلغ كتابةً: ${numberToArabicWords(Math.round(net))}
                      </div>`,

                      // Employer GOSI note
                      gosi.employer > 0 ? `<div style="padding:6px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:4px;font-size:7.5pt;color:#1e40af;margin-bottom:14px">
                        Employer GOSI Contribution (${isSaudi(employee) ? "12%" : "2%"}): SAR ${gosi.employer.toFixed(2)} — paid by employer (not deducted from salary)
                      </div>` : "",

                      sigHTML,
                      footerHTML,
                      "<script>window.onload=function(){setTimeout(function(){window.print()},1200)}</script>",
                      "</body></html>",
                    ].join("\n");

                    win.document.open(); win.document.write(html); win.document.close();
                  } catch (e) { win?.close(); toast.error("Failed to generate payslip"); }
                  finally { setExpGenerating(false); }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-brand-primary text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {expGenerating ? "Generating..." : (language === "ar" ? "تحميل PDF" : "Download PDF")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────
// Main PayrollPage
// ─────────────────────────────────────────────
export const PayrollPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const { user } = useAuthStore();

  type Tab = "employees" | "advances" | "payrollHistory" | "nitaqat" | "eosb";
  const [activeTab, setActiveTab] = React.useState<Tab>("employees");
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [advances, setAdvances] = React.useState<SalaryAdvance[]>([]);
  const [payrollHistory, setPayrollHistory] = React.useState<PayrollRunRecord[]>([]);
  const [leaveBalances, setLeaveBalances] = React.useState<LeaveBalance[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [advanceModalOpen, setAdvanceModalOpen] = React.useState(false);
  const [payslipEmployee, setPayslipEmployee] = React.useState<Employee | null>(null);
  const [runModalOpen, setRunModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = React.useState<string | null>(null);

  // ── Employee form fields ──────────────────────────────────────
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [nationality, setNationality] = React.useState("Saudi");
  const [gender, setGender] = React.useState<"male" | "female">("male");
  const [dateOfBirth, setDateOfBirth] = React.useState("");
  const [nationalId, setNationalId] = React.useState("");
  const [iqamaNumber, setIqamaNumber] = React.useState("");
  const [iqamaExpiry, setIqamaExpiry] = React.useState("");
  const [workPermitNumber, setWorkPermitNumber] = React.useState("");
  const [workPermitExpiry, setWorkPermitExpiry] = React.useState("");
  const [role, setRole] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [contractType, setContractType] = React.useState<"unlimited" | "fixed">("unlimited");
  const [contractEndDate, setContractEndDate] = React.useState("");
  const [joinDate, setJoinDate] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [mobile, setMobile] = React.useState("");
  const [basicSalary, setBasicSalary] = React.useState("");
  const [housingAllowance, setHousingAllowance] = React.useState("");
  const [transportAllowance, setTransportAllowance] = React.useState("");
  const [foodAllowance, setFoodAllowance] = React.useState("");
  const [otherAllowances, setOtherAllowances] = React.useState("");
  const [gosiEnrolled, setGosiEnrolled] = React.useState(true);
  const [gosiId, setGosiId] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [iban, setIban] = React.useState("SA");

  // ── Advance form ──────────────────────────────────────────────
  const [advEmpId, setAdvEmpId] = React.useState("");
  const [advAmount, setAdvAmount] = React.useState("");
  const [advDate, setAdvDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [advReason, setAdvReason] = React.useState("");
  const [advInstalments, setAdvInstalments] = React.useState("1");

  // ── Payroll run ───────────────────────────────────────────────
  const [runMonth, setRunMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [selectedEmps, setSelectedEmps] = React.useState<string[]>([]);
  const [runDeductions, setRunDeductions] = React.useState<Record<string, string>>({});
  const [runOvertime, setRunOvertime] = React.useState<Record<string, string>>({});
  const [runAbsence, setRunAbsence] = React.useState<Record<string, string>>({});
  const [runLate, setRunLate] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "employees", d => setEmployees(d as Employee[]));
    const u2 = listenCompanyCollection(currentCompany.id, "salaryAdvances", d => setAdvances(d as SalaryAdvance[]));
    const u3 = listenCompanyCollection(currentCompany.id, "payrollRuns", d =>
      setPayrollHistory((d as PayrollRunRecord[]).sort((a, b) => b.month.localeCompare(a.month))));
    const u4 = listenCompanyCollection(currentCompany.id, "leaveBalances", d => setLeaveBalances(d as LeaveBalance[]));
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentCompany]);

  const activeEmployees = employees.filter(e => e.isActive);
  const totalPayroll = activeEmployees.reduce((s, e) => s + calcGross(e), 0);
  const totalGosiEmployer = activeEmployees.reduce((s, e) => s + calcGosi(e).employer, 0);
  const saudiCount = activeEmployees.filter(e => isSaudi(e)).length;
  const nitaqatPct = activeEmployees.length > 0 ? (saudiCount / activeEmployees.length) * 100 : 0;
  const nitaqatBand = nitaqatPct >= 40 ? "Platinum" : nitaqatPct >= 25 ? "Green" : nitaqatPct >= 15 ? "Yellow" : "Red";
  const nitaqatColor = nitaqatPct >= 40 ? "text-violet-600 bg-violet-50 border-violet-200"
    : nitaqatPct >= 25 ? "text-emerald-700 bg-emerald-50 border-emerald-200"
    : nitaqatPct >= 15 ? "text-amber-700 bg-amber-50 border-amber-200"
    : "text-red-700 bg-red-50 border-red-200";

  const pendingAdvances = advances.filter(a => a.status !== "settled");
  const pendingAdvTotal = pendingAdvances.reduce((s, a) => s + a.amount, 0);

  // ── Expiry alerts ─────────────────────────────────────────────
  const today = new Date();
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);
  const expiryAlerts = employees.filter(e => {
    if (!e.isActive) return false;
    const iq = e.iqamaExpiry ? new Date(e.iqamaExpiry) : null;
    const wp = e.workPermitExpiry ? new Date(e.workPermitExpiry) : null;
    return (iq && iq <= in30) || (wp && wp <= in30);
  });

  const openEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setName(emp.name); setNameAr(emp.nameAr);
    setNationality(emp.nationality || "Saudi");
    setGender(emp.gender || "male");
    setDateOfBirth(emp.dateOfBirth || "");
    setNationalId(emp.nationalId || ""); setIqamaNumber(emp.iqamaNumber || "");
    setIqamaExpiry(emp.iqamaExpiry || ""); setWorkPermitNumber(emp.workPermitNumber || "");
    setWorkPermitExpiry(emp.workPermitExpiry || "");
    setRole(emp.role); setDepartment(emp.department || "");
    setContractType(emp.contractType || "unlimited");
    setContractEndDate(emp.contractEndDate || "");
    setJoinDate(emp.joinDate || ""); setEmail(emp.email || ""); setMobile(emp.mobile || "");
    setBasicSalary(String(emp.basicSalary));
    setHousingAllowance(String(emp.housingAllowance));
    setTransportAllowance(String(emp.transportAllowance));
    setFoodAllowance(String(emp.foodAllowance || ""));
    setOtherAllowances(String(emp.otherAllowances || ""));
    setGosiEnrolled(emp.gosiEnrolled !== false);
    setGosiId(emp.gosiId || "");
    setBankName(emp.bankName || ""); setIban(emp.iban || "SA");
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null); setName(""); setNameAr(""); setNationality("Saudi");
    setGender("male"); setDateOfBirth(""); setNationalId(""); setIqamaNumber("");
    setIqamaExpiry(""); setWorkPermitNumber(""); setWorkPermitExpiry("");
    setRole(""); setDepartment(""); setContractType("unlimited");
    setContractEndDate(""); setJoinDate(""); setEmail(""); setMobile("");
    setBasicSalary(""); setHousingAllowance(""); setTransportAllowance("");
    setFoodAllowance(""); setOtherAllowances("");
    setGosiEnrolled(true); setGosiId(""); setBankName(""); setIban("SA");
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !basicSalary || !currentCompany) return;
    const isSaudiEmp = nationality.toLowerCase().includes("saudi");
    if (isSaudiEmp && nationalId && !validateNationalId(nationalId))
      return toast.error("National ID must be 10 digits starting with 1");
    if (!isSaudiEmp && iqamaNumber && !validateIqama(iqamaNumber))
      return toast.error("Iqama must be 10 digits starting with 2");
    if (iban && iban.length > 2 && !isValidSaudiIban(iban))
      return toast.error("Invalid Saudi IBAN");
    setLoading(true);
    try {
      const data: Omit<Employee, "id"> = {
        name, nameAr, nationality, gender, dateOfBirth,
        nationalId, iqamaNumber, iqamaExpiry, workPermitNumber, workPermitExpiry,
        role, department, contractType, contractEndDate, joinDate, email, mobile,
        basicSalary: +basicSalary, housingAllowance: +housingAllowance || 0,
        transportAllowance: +transportAllowance || 0, foodAllowance: +foodAllowance || 0,
        otherAllowances: +otherAllowances || 0,
        gosiEnrolled, gosiId, bankName, iban, isActive: true,
      };
      const id = editingId || "emp_" + Math.random().toString(36).substr(2, 9);
      await saveEmployee(currentCompany.id, id, data);
      // Ensure leave balance exists for this year
      const thisYear = new Date().getFullYear();
      const existingLeave = leaveBalances.find(lb => lb.employeeId === id && lb.year === thisYear);
      if (!existingLeave) {
        const yearsOfService = joinDate
          ? (Date.now() - new Date(joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
          : 0;
        const entitlement = yearsOfService >= 5 ? 30 : 21;
        await addDocument(`companies/${currentCompany.id}/leaveBalances`, {
          employeeId: id, employeeName: name, year: thisYear,
          annualEntitlement: entitlement, taken: 0, balance: entitlement,
        });
      }
      toast.success(editingId
        ? (language === "ar" ? "تم التحديث" : "Employee updated")
        : (language === "ar" ? "تمت الإضافة" : "Employee added"));
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
    if (!advEmpId || !advAmount || !currentCompany || !user)
      return toast.error("Fill all fields");
    const emp = employees.find(e => e.id === advEmpId);
    await addDocument(`companies/${currentCompany.id}/salaryAdvances`, {
      employeeId: advEmpId, employeeName: emp?.name || "",
      amount: +advAmount, date: advDate, reason: advReason,
      instalments: +advInstalments, remainingInstalments: +advInstalments,
      status: "approved", createdBy: user.uid, createdAt: new Date(),
    });
    toast.success(language === "ar" ? "تم تسجيل السلفة" : "Advance recorded");
    setAdvanceModalOpen(false);
    setAdvEmpId(""); setAdvAmount(""); setAdvReason(""); setAdvInstalments("1");
  };

  const handleSettleAdvance = async (adv: SalaryAdvance) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/salaryAdvances`, adv.id,
      { status: "settled", updatedAt: new Date() });
    toast.success(language === "ar" ? "تمت التسوية" : "Settled");
  };

  const handleRunPayroll = async () => {
    if (!currentCompany || !user || !selectedEmps.length)
      return toast.error("Select at least one employee");
    setLoading(true);
    try {
      const periodLabel = new Date(runMonth + "-01").toLocaleString("en-US", { month: "long", year: "numeric" });
      const runEmployees: PayrollRunEmployee[] = selectedEmps.map(empId => {
        const emp = employees.find(e => e.id === empId)!;
        const gross = calcGross(emp);
        const gosi = calcGosi(emp);
        const dailyRate = emp.basicSalary / 30;
        const absenceDays = +(runAbsence[empId] || 0);
        const lateDays = +(runLate[empId] || 0);
        const absenceDed = dailyRate * absenceDays;
        const lateDed = dailyRate * lateDays * 0.5;
        const otherDed = +(runDeductions[empId] || 0);
        const overtime = +(runOvertime[empId] || 0);
        const advDed = pendingAdvances
          .filter(a => a.employeeId === empId)
          .reduce((s, a) => s + ((a as any).instalments ? a.amount / (a as any).instalments : a.amount), 0);
        const totalDed = gosi.employee + absenceDed + lateDed + otherDed + advDed;
        const overtimePay = (emp.basicSalary / (30 * 8)) * 1.5 * overtime;
        const net = gross + overtimePay - totalDed;
        return {
          employeeId: empId, name: emp.name, nameAr: emp.nameAr,
          nationality: emp.nationality,
          basicSalary: emp.basicSalary, housingAllowance: emp.housingAllowance,
          transportAllowance: emp.transportAllowance, foodAllowance: emp.foodAllowance,
          otherAllowances: emp.otherAllowances,
          grossSalary: gross + overtimePay,
          gosiEmployee: gosi.employee, gosiEmployer: gosi.employer,
          absenceDeduction: absenceDed, lateDeduction: lateDed,
          advanceDeduction: advDed, otherDeductions: otherDed,
          overtime: overtimePay, totalDeductions: totalDed,
          netSalary: net, iban: emp.iban, bankName: emp.bankName,
        };
      });
      const runId = "pr_" + runMonth.replace("-", "") + "_" + Date.now();
      await addDocument(`companies/${currentCompany.id}/payrollRuns`, {
        id: runId, month: runMonth, periodLabel, status: "draft",
        employees: runEmployees,
        totalGross: runEmployees.reduce((s, e) => s + e.grossSalary, 0),
        totalGosiEmployee: runEmployees.reduce((s, e) => s + e.gosiEmployee, 0),
        totalGosiEmployer: runEmployees.reduce((s, e) => s + e.gosiEmployer, 0),
        totalDeductions: runEmployees.reduce((s, e) => s + e.totalDeductions, 0),
        totalNet: runEmployees.reduce((s, e) => s + e.netSalary, 0),
        paymentDate, createdBy: user.uid, createdAt: new Date(),
      });
      // Mark advances as settled if fully deducted
      for (const adv of pendingAdvances.filter(a => selectedEmps.includes(a.employeeId))) {
        if ((adv as any).instalments <= 1) {
          await updateDocument(`companies/${currentCompany.id}/salaryAdvances`, adv.id,
            { status: "settled", settledInPayrollId: runId, updatedAt: new Date() });
        } else {
          await updateDocument(`companies/${currentCompany.id}/salaryAdvances`, adv.id,
            { remainingInstalments: ((adv as any).remainingInstalments || 1) - 1, updatedAt: new Date() });
        }
      }
      toast.success(`Payroll processed for ${selectedEmps.length} employees`);
      setRunModalOpen(false); setSelectedEmps([]);
      setRunDeductions({}); setRunOvertime({}); setRunAbsence({}); setRunLate({});
      setActiveTab("payrollHistory");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const downloadWpsSif = (run: PayrollRunRecord) => {
    const content = generateWpsSif(currentCompany, run.employees, run.month, (run as any).paymentDate || run.month + "-28");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `WPS_${run.month}_${currentCompany?.name || "payroll"}.sif`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Columns ────────────────────────────────────────────────────
  const empColumns: Column<Employee>[] = [
    {
      header: language === "ar" ? "الموظف" : "Employee",
      render: r => (
        <div>
          <p className="font-semibold text-slate-800">{language === "ar" ? r.nameAr : r.name}</p>
          <p className="text-xs text-slate-500">{r.role} {r.department ? `• ${r.department}` : ""}</p>
          <p className="text-xs text-slate-400">{r.nationalId || r.iqamaNumber}</p>
        </div>
      ),
    },
    {
      header: "Nationality / جنسية",
      render: r => (
        <div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isSaudi(r) ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
            {r.nationality}
          </span>
        </div>
      ),
    },
    {
      header: language === "ar" ? "الراتب الأساسي" : "Basic Salary",
      render: r => <CurrencyDisplay amount={r.basicSalary} />,
    },
    {
      header: language === "ar" ? "الإجمالي" : "Gross",
      render: r => <span className="font-bold text-brand-primary"><CurrencyDisplay amount={calcGross(r)} /></span>,
    },
    {
      header: "GOSI",
      render: r => r.gosiEnrolled
        ? <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Enrolled</span>
        : <span className="text-[10px] text-slate-400">—</span>,
    },
    {
      header: language === "ar" ? "إجراءات" : "Actions",
      render: r => (
        <div className="flex gap-1">
          <button onClick={() => setPayslipEmployee(r)}
            className="p-1 text-slate-400 hover:text-blue-600 rounded" title="Payslip">
            <FileText className="h-4 w-4" />
          </button>
          <button onClick={() => openEdit(r)}
            className="p-1 text-slate-400 hover:text-brand-primary rounded">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => handleDeleteEmployee(r.id)}
            className="p-1 text-slate-400 hover:text-red-500 rounded">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const isSaudiEmp = nationality.toLowerCase().includes("saudi");
  const previewGross = (+basicSalary || 0) + (+housingAllowance || 0) +
    (+transportAllowance || 0) + (+foodAllowance || 0) + (+otherAllowances || 0);
  const previewGosi = isSaudiEmp
    ? { employee: (+basicSalary + +housingAllowance) * 0.10, employer: (+basicSalary + +housingAllowance) * 0.12 }
    : { employee: 0, employer: (+basicSalary + +housingAllowance) * 0.02 };

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 font-sans">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {language === "ar" ? "الرواتب والموارد البشرية" : "Payroll & HR"}
          </h2>
          <p className="text-xs text-slate-500">
            WPS-compliant payroll · GOSI · Nitaqat · EOSB · Saudi Labour Law
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportMenu data={employees} filename="employees"
            headers={{ name: "Name", nameAr: "Arabic Name", role: "Role", nationality: "Nationality", basicSalary: "Basic Salary", iban: "IBAN" }} />
          {activeEmployees.length > 0 && (
            <Button onClick={() => setRunModalOpen(true)} variant="secondary" className="flex items-center gap-2 bg-white">
              <Landmark className="h-4 w-4 text-emerald-500" />
              {language === "ar" ? "صرف الأجور WPS" : "Run Payroll (WPS)"}
            </Button>
          )}
          <Button onClick={() => setAdvanceModalOpen(true)} variant="secondary" className="flex items-center gap-2 bg-white">
            <CreditCard className="h-4 w-4 text-amber-500" />
            {language === "ar" ? "سلفة راتب" : "Salary Advance"}
          </Button>
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة موظف" : "Add Employee"}
          </Button>
        </div>
      </div>

      {/* ── Expiry Alerts ── */}
      {expiryAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-bold text-red-700">
              {expiryAlerts.length} Document{expiryAlerts.length > 1 ? "s" : ""} Expiring Within 30 Days
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiryAlerts.map(e => (
              <span key={e.id} className="text-xs bg-white border border-red-200 text-red-700 px-2 py-1 rounded-lg">
                {e.name} — Iqama: {e.iqamaExpiry || "—"} / Permit: {e.workPermitExpiry || "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "الموظفون" : "Employees"}</p>
          <p className="text-2xl font-bold text-slate-800">{activeEmployees.length}</p>
          <p className="text-[10px] text-slate-400">{saudiCount} Saudi</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "إجمالي الرواتب" : "Monthly Payroll"}</p>
          <p className="text-xl font-bold text-brand-primary">{formatCurrency(totalPayroll, language)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">GOSI Employer Cost</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(totalGosiEmployer, language)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${nitaqatColor}`}>
          <p className="text-xs font-semibold opacity-70">Nitaqat Band</p>
          <p className="text-2xl font-bold">{nitaqatBand}</p>
          <p className="text-[10px] opacity-60">{nitaqatPct.toFixed(1)}% Saudi</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-slate-500">{language === "ar" ? "سلف مستحقة" : "Pending Advances"}</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingAdvTotal, language)}</p>
          <p className="text-[10px] text-slate-400">{pendingAdvances.length} advances</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-slate-200 flex-wrap">
        {([
          { id: "employees", en: "Employees", ar: "الموظفون" },
          { id: "advances", en: "Advances", ar: "السلف" },
          { id: "payrollHistory", en: "Payroll History", ar: "سجل الرواتب" },
          { id: "nitaqat", en: "Nitaqat / EOSB", ar: "نطاقات / مكافآت" },
          { id: "eosb", en: "Leave Balances", ar: "رصيد الإجازات" },
        ] as { id: Tab; en: string; ar: string }[]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id
              ? "border-brand-primary text-brand-primary"
              : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {language === "ar" ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* ── Employees Tab ── */}
      {activeTab === "employees" && (
        <DataTable columns={empColumns} data={employees}
          searchPlaceholder={language === "ar" ? "البحث بالاسم..." : "Search by name..."}
          searchField="name" />
      )}

      {/* ── Advances Tab ── */}
      {activeTab === "advances" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Employee", "Amount", "Date", "Instalments", "Reason", "Status", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {advances.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400 text-sm">No advances recorded</td></tr>
              ) : advances.map(a => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{a.employeeName}</td>
                  <td className="px-4 py-3 font-bold text-amber-600">{formatCurrency(a.amount, language)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.date}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{(a as any).instalments || 1}</td>
                  <td className="px-4 py-3 text-slate-600">{a.reason || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.status === "settled" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {a.status === "settled" ? "Settled" : "Pending"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status !== "settled" && (
                      <button onClick={() => handleSettleAdvance(a)}
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded" title="Settle">
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

      {/* ── Payroll History Tab ── */}
      {activeTab === "payrollHistory" && (
        <div className="space-y-3">
          {payrollHistory.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
              <Landmark className="h-8 w-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payroll runs yet. Use "Run Payroll (WPS)" to process your first month.</p>
            </div>
          ) : payrollHistory.map(run => (
            <div key={run.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-bold text-slate-800">{run.periodLabel}</p>
                    <p className="text-xs text-slate-500">{run.employees.length} employees</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${run.status === "paid" ? "bg-emerald-100 text-emerald-700" : run.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {run.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Net Total</p>
                    <p className="font-bold text-slate-800">{formatCurrency(run.totalNet, language)}</p>
                  </div>
                  <button onClick={() => downloadWpsSif(run)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                    title="Download WPS SIF File">
                    <Download className="h-3.5 w-3.5" /> WPS SIF
                  </button>
                  <button onClick={() => setExpandedHistory(expandedHistory === run.id ? null : run.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50">
                    {expandedHistory === run.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {expandedHistory === run.id && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        {["Employee", "Gross", "GOSI (Emp)", "GOSI (Er)", "Deductions", "Net"].map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {run.employees.map(e => (
                        <tr key={e.employeeId} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{e.name}</td>
                          <td className="px-3 py-2">{e.grossSalary.toFixed(2)}</td>
                          <td className="px-3 py-2 text-red-600">-{e.gosiEmployee.toFixed(2)}</td>
                          <td className="px-3 py-2 text-blue-600">{e.gosiEmployer.toFixed(2)}</td>
                          <td className="px-3 py-2 text-red-600">-{e.totalDeductions.toFixed(2)}</td>
                          <td className="px-3 py-2 font-bold text-emerald-700">{e.netSalary.toFixed(2)}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold text-xs">
                        <td className="px-3 py-2">TOTAL</td>
                        <td className="px-3 py-2">{run.totalGross.toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-600">-{run.totalGosiEmployee.toFixed(2)}</td>
                        <td className="px-3 py-2 text-blue-600">{run.totalGosiEmployer.toFixed(2)}</td>
                        <td className="px-3 py-2 text-red-600">-{run.totalDeductions.toFixed(2)}</td>
                        <td className="px-3 py-2 text-emerald-700">{run.totalNet.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Nitaqat / EOSB Tab ── */}
      {activeTab === "nitaqat" && (
        <div className="space-y-5">
          {/* Nitaqat */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-brand-primary" />
              Nitaqat Saudization Status
            </h3>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total Active", val: activeEmployees.length, color: "text-slate-800" },
                { label: "Saudi Nationals", val: saudiCount, color: "text-emerald-700" },
                { label: "Non-Saudi", val: activeEmployees.length - saudiCount, color: "text-blue-700" },
                { label: "Saudization %", val: `${nitaqatPct.toFixed(1)}%`, color: "text-violet-700" },
              ].map((kpi, i) => (
                <div key={i} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.val}</p>
                </div>
              ))}
            </div>
            <div className={`p-4 border rounded-xl ${nitaqatColor}`}>
              <p className="font-bold text-sm">Current Band: {nitaqatBand}</p>
              <p className="text-xs mt-1 opacity-70">
                Platinum ≥40% · Green ≥25% · Yellow ≥15% · Red &lt;15%
              </p>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Employee", "Nationality", "ID Type", "Join Date", "Contract"].map((h, i) => (
                      <th key={i} className="px-4 py-2 text-xs font-semibold text-slate-600 text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeEmployees.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{e.name}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isSaudi(e) ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                          {e.nationality}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {e.nationalId ? "National ID" : e.iqamaNumber ? "Iqama" : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{e.joinDate || "—"}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{e.contractType || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* EOSB */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand-primary" />
              EOSB Accrual — مكافأة نهاية الخدمة (Article 84)
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Employee", "Join Date", "Years", "Basic Salary", "EOSB Accrued (SAR)", "Rule"].map((h, i) => (
                      <th key={i} className="px-4 py-2 text-xs font-semibold text-slate-600 text-start">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeEmployees.filter(e => e.joinDate).map(e => {
                    const years = (Date.now() - new Date(e.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                    const eosb = calcEosb(e);
                    return (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium">{e.name}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{e.joinDate}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{years.toFixed(1)}</td>
                        <td className="px-4 py-2">{formatCurrency(e.basicSalary, language)}</td>
                        <td className="px-4 py-2 font-bold text-emerald-700">{formatCurrency(eosb, language)}</td>
                        <td className="px-4 py-2 text-xs text-slate-400">
                          {years < 1 ? "< 1yr (no entitlement)" : years < 5 ? "½ month/year" : "1 month/year"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan={4} className="px-4 py-2 text-xs">Total EOSB Liability</td>
                    <td className="px-4 py-2 text-emerald-700">
                      {formatCurrency(activeEmployees.filter(e => e.joinDate).reduce((s, e) => s + calcEosb(e), 0), language)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Leave Balances Tab ── */}
      {activeTab === "eosb" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-primary" />
            <span className="font-bold text-sm text-slate-800">
              Annual Leave Balances {new Date().getFullYear()} — (Article 109: 21 days / 30 days after 5 years)
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Employee", "Entitlement", "Taken", "Balance", "Actions"].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaveBalances.filter(lb => lb.year === new Date().getFullYear()).length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">
                  Add employees first — leave balances are created automatically.
                </td></tr>
              ) : leaveBalances
                .filter(lb => lb.year === new Date().getFullYear())
                .map(lb => (
                  <tr key={lb.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{lb.employeeName}</td>
                    <td className="px-4 py-3">{lb.annualEntitlement} days</td>
                    <td className="px-4 py-3 text-red-600">{lb.taken} days</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${lb.balance <= 3 ? "text-red-600" : lb.balance <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                        {lb.balance} days
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            const days = +(prompt("Days taken (leave deduction):") || "0");
                            if (!days || !currentCompany) return;
                            const newTaken = lb.taken + days;
                            const newBal = Math.max(0, lb.annualEntitlement - newTaken);
                            await updateDocument(`companies/${currentCompany.id}/leaveBalances`, lb.id,
                              { taken: newTaken, balance: newBal });
                            toast.success("Leave updated");
                          }}
                          className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100">
                          - Take Leave
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Add/Edit Employee Modal ── */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingId
          ? (language === "ar" ? "تعديل بيانات الموظف" : "Edit Employee")
          : (language === "ar" ? "إضافة موظف جديد" : "Add New Employee")}
        size="xl">
        <form onSubmit={handleSaveEmployee} className="flex flex-col gap-5">

          {/* Section: Identity */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Identity — الهوية</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Full Name (EN)" value={name} onChange={e => setName(e.target.value)} required />
              <Input label="الاسم (عربي)" value={nameAr} onChange={e => setNameAr(e.target.value)} required />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality</label>
                <select value={nationality} onChange={e => setNationality(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary bg-white">
                  <option>Saudi</option>
                  <option>Egyptian</option>
                  <option>Pakistani</option>
                  <option>Indian</option>
                  <option>Yemeni</option>
                  <option>Syrian</option>
                  <option>Jordanian</option>
                  <option>Filipino</option>
                  <option>Bangladeshi</option>
                  <option>Sudanese</option>
                  <option>Ethiopian</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary bg-white">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <Input label="Date of Birth" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
              {isSaudiEmp
                ? <Input label="National ID (10 digits, starts with 1)" value={nationalId} onChange={e => setNationalId(e.target.value)}
                    placeholder="1XXXXXXXXX" />
                : <>
                    <Input label="Iqama Number (10 digits, starts with 2)" value={iqamaNumber} onChange={e => setIqamaNumber(e.target.value)}
                      placeholder="2XXXXXXXXX" />
                    <Input label="Iqama Expiry Date" type="date" value={iqamaExpiry} onChange={e => setIqamaExpiry(e.target.value)} />
                    <Input label="Work Permit Number" value={workPermitNumber} onChange={e => setWorkPermitNumber(e.target.value)} />
                    <Input label="Work Permit Expiry" type="date" value={workPermitExpiry} onChange={e => setWorkPermitExpiry(e.target.value)} />
                  </>
              }
            </div>
          </div>

          {/* Section: Employment */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Employment — التوظيف</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input label="Job Title" value={role} onChange={e => setRole(e.target.value)} required />
              <Input label="Department" value={department} onChange={e => setDepartment(e.target.value)} />
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Contract Type</label>
                <select value={contractType} onChange={e => setContractType(e.target.value as any)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary bg-white">
                  <option value="unlimited">Unlimited / غير محددة المدة</option>
                  <option value="fixed">Fixed Term / محددة المدة</option>
                </select>
              </div>
              {contractType === "fixed" && (
                <Input label="Contract End Date" type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
              )}
              <Input label="Join Date (تاريخ التعيين)" type="date" value={joinDate} onChange={e => setJoinDate(e.target.value)} required />
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <Input label="Mobile" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+9665XXXXXXXX" />
            </div>
          </div>

          {/* Section: Compensation */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Compensation — الراتب</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input label="Basic Salary (SAR)" type="number" value={basicSalary} onChange={e => setBasicSalary(e.target.value)} required />
              <Input label="Housing Allowance" type="number" value={housingAllowance} onChange={e => setHousingAllowance(e.target.value)} />
              <Input label="Transport Allowance" type="number" value={transportAllowance} onChange={e => setTransportAllowance(e.target.value)} />
              <Input label="Food Allowance" type="number" value={foodAllowance} onChange={e => setFoodAllowance(e.target.value)} />
              <Input label="Other Allowances" type="number" value={otherAllowances} onChange={e => setOtherAllowances(e.target.value)} />
            </div>
            {basicSalary && (
              <div className="mt-3 bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Gross Salary</span>
                  <p className="font-bold text-slate-800">{formatCurrency(previewGross, language)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Employee GOSI ({isSaudiEmp ? "10%" : "0%"})</span>
                  <p className="font-bold text-red-600">- {formatCurrency(previewGosi.employee, language)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Employer GOSI ({isSaudiEmp ? "12%" : "2%"})</span>
                  <p className="font-bold text-blue-600">{formatCurrency(previewGosi.employer, language)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Section: GOSI */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">GOSI — التأمينات الاجتماعية</p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={gosiEnrolled} onChange={e => setGosiEnrolled(e.target.checked)}
                  className="rounded border-slate-300 text-brand-primary" />
                <span className="text-sm text-slate-600">Enrolled in GOSI</span>
              </label>
            </div>
            {gosiEnrolled && (
              <div className="mt-3">
                <Input label="GOSI Registration Number" value={gosiId} onChange={e => setGosiId(e.target.value)} placeholder="GOSI ID" />
              </div>
            )}
          </div>

          {/* Section: Banking */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Banking — البنك</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Al Rajhi / Riyad Bank..." />
              <Input label="IBAN" value={iban} onChange={e => setIban(e.target.value)} placeholder="SA0380000000608010167519" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button type="submit" loading={loading}>
              {editingId
                ? (language === "ar" ? "حفظ التعديلات" : "Save Changes")
                : (language === "ar" ? "إضافة الموظف" : "Add Employee")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Salary Advance Modal ── */}
      <Modal isOpen={advanceModalOpen} onClose={() => setAdvanceModalOpen(false)}
        title={language === "ar" ? "تسجيل سلفة راتب" : "Record Salary Advance"}>
        <div className="flex flex-col gap-4">
          <Select label={language === "ar" ? "الموظف" : "Employee"} value={advEmpId}
            onChange={e => setAdvEmpId(e.target.value)}
            options={[{ value: "", label: "Select employee..." }, ...employees.map(e => ({ value: e.id, label: e.name }))]} />
          <Input label="Advance Amount (SAR)" type="number" value={advAmount} onChange={e => setAdvAmount(e.target.value)} min="0" />
          <Input label="Date" type="date" value={advDate} onChange={e => setAdvDate(e.target.value)} />
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Repayment Instalments</label>
            <select value={advInstalments} onChange={e => setAdvInstalments(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-brand-primary bg-white">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <option key={n} value={n}>{n} month{n > 1 ? "s" : ""} — SAR {advAmount ? (+advAmount / n).toFixed(2) : "—"}/month</option>
              ))}
            </select>
          </div>
          <Input label="Reason (optional)" value={advReason} onChange={e => setAdvReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAdvanceModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAdvance} loading={loading}>Record Advance</Button>
          </div>
        </div>
      </Modal>

      {/* ── Run Payroll Modal ── */}
      <Modal isOpen={runModalOpen} onClose={() => setRunModalOpen(false)}
        title={language === "ar" ? "صرف رواتب WPS" : "Run Payroll — WPS"} size="xl">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Payroll Month" type="month" value={runMonth} onChange={e => setRunMonth(e.target.value)} />
            <Input label="Payment Date" type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            ⚠ WPS requires salary to be paid by the last day of each month. Late payment is subject to fines.
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">Select Employees</span>
              <button onClick={() => setSelectedEmps(
                selectedEmps.length === activeEmployees.length ? [] : activeEmployees.map(e => e.id)
              )} className="text-xs text-brand-primary font-semibold hover:underline">
                {selectedEmps.length === activeEmployees.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
              <div className="col-span-1"></div>
              <div className="col-span-3">Employee</div>
              <div className="col-span-2 text-right">Gross</div>
              <div className="col-span-1 text-center">Absent</div>
              <div className="col-span-1 text-center">Late</div>
              <div className="col-span-2 text-center">OT (hrs)</div>
              <div className="col-span-2 text-right">Net Est.</div>
            </div>
            {activeEmployees.map(emp => {
              const isSelected = selectedEmps.includes(emp.id);
              const gross = calcGross(emp);
              const gosi = calcGosi(emp);
              const absence = +(runAbsence[emp.id] || 0) * (emp.basicSalary / 30);
              const late = +(runLate[emp.id] || 0) * (emp.basicSalary / 30) * 0.5;
              const ot = +(runOvertime[emp.id] || 0) * (emp.basicSalary / (30 * 8)) * 1.5;
              const otherDed = +(runDeductions[emp.id] || 0);
              const advDed = pendingAdvances
                .filter(a => a.employeeId === emp.id)
                .reduce((s, a) => s + ((a as any).instalments ? a.amount / (a as any).instalments : a.amount), 0);
              const netEst = gross + ot - gosi.employee - absence - late - otherDed - advDed;
              return (
                <div key={emp.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-100 last:border-0 items-center ${isSelected ? "bg-blue-50/40" : ""}`}>
                  <div className="col-span-1">
                    <input type="checkbox" checked={isSelected}
                      onChange={e => setSelectedEmps(prev =>
                        e.target.checked ? [...prev, emp.id] : prev.filter(id => id !== emp.id)
                      )} className="rounded border-slate-300" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-xs font-semibold">{emp.name}</p>
                    <p className="text-[10px] text-slate-400">{emp.role}</p>
                    {advDed > 0 && <p className="text-[10px] text-amber-600">Advance: -{advDed.toFixed(2)}</p>}
                  </div>
                  <div className="col-span-2 text-right text-xs font-medium">{gross.toFixed(2)}</div>
                  {isSelected ? <>
                    <div className="col-span-1">
                      <input type="number" min={0} max={30} value={runAbsence[emp.id] || ""}
                        onChange={e => setRunAbsence(p => ({ ...p, [emp.id]: e.target.value }))}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none text-center" />
                    </div>
                    <div className="col-span-1">
                      <input type="number" min={0} max={30} value={runLate[emp.id] || ""}
                        onChange={e => setRunLate(p => ({ ...p, [emp.id]: e.target.value }))}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none text-center" />
                    </div>
                    <div className="col-span-2">
                      <input type="number" min={0} value={runOvertime[emp.id] || ""}
                        onChange={e => setRunOvertime(p => ({ ...p, [emp.id]: e.target.value }))}
                        placeholder="0" className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 focus:outline-none text-center" />
                    </div>
                    <div className="col-span-2 text-right text-xs font-bold text-emerald-700">{netEst.toFixed(2)}</div>
                  </> : <div className="col-span-6 text-xs text-slate-300 text-center">Select to configure</div>}
                </div>
              );
            })}
          </div>
          {selectedEmps.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Total Gross</p>
                <p className="font-bold">{formatCurrency(
                  employees.filter(e => selectedEmps.includes(e.id)).reduce((s, e) => s + calcGross(e), 0), language)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total GOSI (Employer)</p>
                <p className="font-bold text-blue-600">{formatCurrency(
                  employees.filter(e => selectedEmps.includes(e.id)).reduce((s, e) => s + calcGosi(e).employer, 0), language)}</p>
              </div>
              <div>
                <p className="text-slate-500">Est. Net to Pay</p>
                <p className="font-bold text-emerald-700">{formatCurrency(
                  employees.filter(e => selectedEmps.includes(e.id)).reduce((s, e) => {
                    const gross = calcGross(e);
                    const gosi = calcGosi(e);
                    const ot = +(runOvertime[e.id] || 0) * (e.basicSalary / (30 * 8)) * 1.5;
                    const absence = +(runAbsence[e.id] || 0) * (e.basicSalary / 30);
                    const late = +(runLate[e.id] || 0) * (e.basicSalary / 30) * 0.5;
                    const otherDed = +(runDeductions[e.id] || 0);
                    const advDed = pendingAdvances
                      .filter(a => a.employeeId === e.id)
                      .reduce((s2, a) => s2 + ((a as any).instalments ? a.amount / (a as any).instalments : a.amount), 0);
                    return s + gross + ot - gosi.employee - absence - late - otherDed - advDed;
                  }, 0), language)}</p>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRunModalOpen(false)}>Cancel</Button>
            <Button onClick={handleRunPayroll} loading={loading} disabled={!selectedEmps.length}
              className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Process {selectedEmps.length} Employee{selectedEmps.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Payslip Modal ── */}
      {payslipEmployee && (
        <PayslipModal
          employee={payslipEmployee}
          month={runMonth}
          advanceDeduction={pendingAdvances
            .filter(a => a.employeeId === payslipEmployee.id)
            .reduce((s, a) => s + ((a as any).instalments ? a.amount / (a as any).instalments : a.amount), 0)}
          onClose={() => setPayslipEmployee(null)}
          language={language}
        />
      )}
    </div>
  );
};

export default PayrollPage;
