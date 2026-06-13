import * as React from "react";
import {
  Building2, UserCheck, FileText, List, Database,
  Save, Plus, Trash2, Upload, X, ShieldCheck,
  Download, RefreshCw, AlertTriangle, Pencil, Check, PieChart, ImageIcon
} from "lucide-react";
import toast from "react-hot-toast";
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, getDocs
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { uploadFile } from "../../firebase/storage";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Signatory {
  id: string;
  name: string;
  designation: string;
  isActive: boolean;
}

interface CustomList {
  expenseCategories: string[];
  incomeCategories: string[];
  designations: string[];
  paymentMethods: string[];
  units: string[];
}

const DEFAULT_LISTS: CustomList = {
  expenseCategories: ["Office", "Travel", "Meals", "IT", "Marketing", "Maintenance", "Utilities", "Other"],
  incomeCategories: ["Sales", "Services", "Consulting", "Rental", "Other"],
  designations: ["Manager", "Accountant", "Engineer", "Specialist", "Director", "CEO", "CFO"],
  paymentMethods: ["Cash", "Bank Transfer", "Cheque", "Credit Card", "STC Pay", "Apple Pay"],
  units: ["PCE", "KG", "L", "M", "Box", "Hour", "Day", "Month"],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ListEditor: React.FC<{
  label: string; labelAr: string; items: string[];
  onAdd: (v: string) => void; onRemove: (i: number) => void;
}> = ({ label, labelAr, items, onAdd, onRemove }) => {
  const { language } = useUIStore();
  const [val, setVal] = React.useState("");
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{language === "ar" ? labelAr : label}</p>
      <div className="flex gap-2">
        <input value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
          placeholder={language === "ar" ? "أضف عنصراً..." : "Add item..."}
          className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
        <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
          className="px-3 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-dark transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-lg font-medium">
            {item}
            <button onClick={() => onRemove(i)} className="text-slate-400 hover:text-red-500 transition-colors"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400 italic">{language === "ar" ? "لا توجد عناصر" : "No items yet"}</p>}
      </div>
    </div>
  );
};

// ─── Main Settings Page ───────────────────────────────────────────────────────

export const SettingsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany, updateCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [activeTab, setActiveTab] = React.useState("company");
  const [saving, setSaving] = React.useState(false);

  // Company profile form
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [vatNumber, setVatNumber] = React.useState("");
  const [crNumber, setCrNumber] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [addressAr, setAddressAr] = React.useState("");
  const [city, setCity] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [zatcaPhase, setZatcaPhase] = React.useState<"1" | "2">("1");
  const [defaultVatRate, setDefaultVatRate] = React.useState("15");
  const [fiscalYearStart, setFiscalYearStart] = React.useState("01-01");

  // Signatories
  const [signatories, setSignatories] = React.useState<Signatory[]>([]);
  const [showSigModal, setShowSigModal] = React.useState(false);
  const [editingSig, setEditingSig] = React.useState<Signatory | null>(null);
  const [sigName, setSigName] = React.useState("");
  const [sigDesignation, setSigDesignation] = React.useState("");
  const [sigSignatureUrl, setSigSignatureUrl] = React.useState("");

  // Additional letterheads
  const [additionalLetterheads, setAdditionalLetterheads] = React.useState<{ id: string; name: string; url: string }[]>([]);
  const [fullLetterhead, setFullLetterhead] = React.useState("");
  const fullLHFileRef = React.useRef<HTMLInputElement>(null);
  const [newLHName, setNewLHName] = React.useState("");
  const [newLHUrl, setNewLHUrl] = React.useState("");
  const [footerAssetUrl, setFooterAssetUrl] = React.useState("");
  const [headerAssetUrl, setHeaderAssetUrl] = React.useState("");
  const headerAssetFileRef = React.useRef<HTMLInputElement>(null);
  const [lhSaving, setLhSaving] = React.useState(false);

  // Equity share
  const [equityPartners, setEquityPartners] = React.useState<{ id: string; name: string; percent: number; targetCapital: number }[]>([]);
  const [equitySaving, setEquitySaving] = React.useState(false);

  // Custom lists
  const [lists, setLists] = React.useState<CustomList>(DEFAULT_LISTS);
  const [listsSaving, setListsSaving] = React.useState(false);

  // Backup
  const [backingUp, setBackingUp] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState<{ current: number; total: number; collection: string } | null>(null);
  const [importResult, setImportResult] = React.useState<{ success: number; failed: number } | null>(null);
  const importFileRef = React.useRef<HTMLInputElement>(null);
  const lhFileRef = React.useRef<HTMLInputElement>(null);
  const footerFileRef = React.useRef<HTMLInputElement>(null);
  const sigFileRef = React.useRef<HTMLInputElement>(null);
  const [newLHFile, setNewLHFile] = React.useState<string>("");
  const [uploadingLH, setUploadingLH] = React.useState(false);
  const stampFileRef = React.useRef<HTMLInputElement>(null);
  const logoFileRef = React.useRef<HTMLInputElement>(null);
  const [stampUrl, setStampUrl] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");

  // Load company data into form
  React.useEffect(() => {
    if (!currentCompany) return;
    setName(currentCompany.name || "");
    setNameAr(currentCompany.nameAr || "");
    setVatNumber(currentCompany.vatNumber || "");
    setCrNumber(currentCompany.crNumber || "");
    setAddress(currentCompany.address || "");
    setAddressAr(currentCompany.addressAr || "");
    setCity(currentCompany.city || "");
    setPhone(currentCompany.phone || "");
    setEmail(currentCompany.email || "");
    setZatcaPhase(String(currentCompany.zatcaPhase || 1) as "1" | "2");
    setDefaultVatRate(String(currentCompany.defaultVatRate || 15));
    setFiscalYearStart(currentCompany.fiscalYearStart || "01-01");
    setAdditionalLetterheads((currentCompany as any).additionalLetterheads || []);
    setFooterAssetUrl((currentCompany as any).footerAsset || "");
    setHeaderAssetUrl((currentCompany as any).headerAsset || "");
    setFullLetterhead((currentCompany as any).fullLetterhead || "");
    setEquityPartners((currentCompany as any).equityPartners || []);
    setStampUrl((currentCompany as any).stamp || "");
    setLogoUrl((currentCompany as any).logo || "");
  }, [currentCompany]);

  // Load signatories
  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = onSnapshot(
      collection(db, "companies", currentCompany.id, "signatories"),
      snap => setSignatories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Signatory)))
    );
    return unsub;
  }, [currentCompany]);

  // Load custom lists
  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = onSnapshot(
      doc(db, "companies", currentCompany.id, "settings", "lists"),
      snap => { if (snap.exists()) setLists({ ...DEFAULT_LISTS, ...snap.data() as CustomList }); }
    );
    return unsub;
  }, [currentCompany]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSaveCompany = async () => {
    if (!currentCompany) return;
    setSaving(true);
    try {
      await updateCompany(currentCompany.id, {
        name, nameAr, vatNumber, crNumber, address, addressAr,
        city, phone, email,
        zatcaPhase: parseInt(zatcaPhase) as 1 | 2,
        defaultVatRate: parseFloat(defaultVatRate),
        fiscalYearStart,
        logo: logoUrl,
        stamp: stampUrl,
      } as any);
      toast.success(language === "ar" ? "تم حفظ بيانات الشركة" : "Company profile saved");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSig = async () => {
    if (!sigName || !currentCompany) return;
    setSaving(true);
    try {
      const sigData = { name: sigName, designation: sigDesignation, isActive: true, signatureUrl: sigSignatureUrl };
      if (editingSig) {
        await updateDoc(doc(db, "companies", currentCompany.id, "signatories", editingSig.id), sigData);
        toast.success(language === "ar" ? "تم التحديث" : "Updated");
      } else {
        const id = "sig_" + Math.random().toString(36).substr(2, 8);
        await setDoc(doc(db, "companies", currentCompany.id, "signatories", id), sigData);
        toast.success(language === "ar" ? "تمت الإضافة" : "Added");
      }
      setShowSigModal(false); setSigName(""); setSigDesignation(""); setSigSignatureUrl(""); setEditingSig(null);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteSig = async (id: string) => {
    if (!currentCompany) return;
    await deleteDoc(doc(db, "companies", currentCompany.id, "signatories", id));
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const handleSaveLetterheads = async () => {
    if (!currentCompany) return;
    setLhSaving(true);
    try {
      await updateCompany(currentCompany.id, {
        additionalLetterheads,
        footerAsset: footerAssetUrl,
        headerAsset: headerAssetUrl,
        fullLetterhead,
      } as any);
      toast.success(language === "ar" ? "تم حفظ الترويسات" : "Letterheads saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setLhSaving(false); }
  };

  const handleSaveEquity = async () => {
    if (!currentCompany) return;
    setEquitySaving(true);
    try {
      const total = equityPartners.reduce((s, p) => s + p.percent, 0);
      if (total > 100) {
        toast.error(language === "ar" ? "مجموع النسب يتجاوز 100%" : "Total percentages exceed 100%");
        return;
      }
      await updateCompany(currentCompany.id, { equityPartners } as any);
      toast.success(language === "ar" ? "تم حفظ توزيع الحصص" : "Equity distribution saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setEquitySaving(false); }
  };

  const addEquityPartner = () => setEquityPartners(p => [...p, { id: Math.random().toString(36).slice(2), name: "", percent: 0, targetCapital: 0 }]);
  const removeEquityPartner = (id: string) => setEquityPartners(p => p.filter(x => x.id !== id));
  const updateEquityPartner = (id: string, field: string, val: any) =>
    setEquityPartners(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));

  const handleSaveLists = async () => {
    if (!currentCompany) return;
    setListsSaving(true);
    try {
      await setDoc(doc(db, "companies", currentCompany.id, "settings", "lists"), lists, { merge: true });
      toast.success(language === "ar" ? "تم حفظ القوائم" : "Lists saved");
    } catch (err: any) { toast.error(err.message); }
    finally { setListsSaving(false); }
  };

  const handleImport = async (file: File) => {
    if (!currentCompany) return;
    setImporting(true);
    setImportResult(null);
    setImportProgress(null);

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const COLLECTIONS = [
        "invoices","bills","expenses","customers","suppliers","products",
        "employees","quotations","purchaseOrders","deliveryNotes","pettyCash",
        "overheads","projects","attendance","vatReturns","profitDistributions",
        "journalEntries","chartOfAccounts","income","salaryAdvances"
      ];

      let successCount = 0;
      let failCount = 0;
      const total = COLLECTIONS.filter(col => backup[col]?.length > 0).length;
      let current = 0;

      for (const col of COLLECTIONS) {
        if (!backup[col] || backup[col].length === 0) continue;
        current++;
        setImportProgress({ current, total, collection: col });

        for (const record of backup[col]) {
          try {
            const { id, ...data } = record;
            // Convert Firestore timestamp objects back to dates
            const clean = JSON.parse(JSON.stringify(data), (key, val) => {
              if (val && typeof val === 'object' && val._seconds) {
                return new Date(val._seconds * 1000);
              }
              return val;
            });
            await setDoc(
              doc(db, "companies", currentCompany.id, col, id || Math.random().toString(36).slice(2)),
              clean,
              { merge: true }
            );
            successCount++;
          } catch {
            failCount++;
          }
        }
      }

      setImportResult({ success: successCount, failed: failCount });
      toast.success(
        language === "ar"
          ? `تم استيراد ${successCount} سجل بنجاح`
          : `Successfully imported ${successCount} records`
      );
    } catch (err: any) {
      toast.error(
        language === "ar"
          ? "ملف غير صالح — تأكد أنه ملف JSON من نسخة صفقة الاحتياطية"
          : "Invalid file — make sure it is a Safqa backup JSON file"
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  };

  const updateList = (key: keyof CustomList, items: string[]) => {
    const updated = { ...lists, [key]: items };
    setLists(updated);
    // Auto-persist the lists document so users don't have to remember to click Save
    if (currentCompany) {
      setDoc(doc(db, "companies", currentCompany.id, "settings", "lists"), updated, { merge: true })
        .catch(err => console.error("Auto-save lists failed:", err));
    }
  };
  const addToList = (key: keyof CustomList, val: string) => updateList(key, [...lists[key], val]);
  const removeFromList = (key: keyof CustomList, idx: number) => updateList(key, lists[key].filter((_, i) => i !== idx));

  const handleBackup = async () => {
    if (!currentCompany) return;
    setBackingUp(true);
    try {
      const collections = ["invoices","bills","expenses","customers","suppliers","products","employees","quotations","purchaseOrders","deliveryNotes","pettyCash","overheads","projects","attendance","vatReturns","profitDistributions","journalEntries","chartOfAccounts"];
      const backup: Record<string, any[]> = { company: [currentCompany] };
      for (const col of collections) {
        const snap = await getDocs(collection(db, "companies", currentCompany.id, col));
        backup[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `safqa-backup-${currentCompany.name}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(language === "ar" ? "تم تصدير النسخة الاحتياطية" : "Backup exported successfully");
    } catch (err: any) { toast.error(err.message); }
    finally { setBackingUp(false); }
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs = [
    { id: "company",      icon: Building2,   labelEn: "Company Profile",   labelAr: "بيانات الشركة" },
    { id: "signatories",  icon: UserCheck,   labelEn: "Signatories",       labelAr: "المفوضون بالتوقيع" },
    { id: "letterheads",  icon: FileText,    labelEn: "Letterheads",       labelAr: "الترويسات" },
    { id: "equity",       icon: PieChart,    labelEn: "Equity Share",      labelAr: "توزيع حصص الملكية" },
    { id: "lists",        icon: List,        labelEn: "Custom Lists",      labelAr: "القوائم المخصصة" },
    { id: "zatca",        icon: ShieldCheck, labelEn: "ZATCA Settings",    labelAr: "إعدادات زاتكا" },
    { id: "backup",       icon: Database,    labelEn: "Data Backup",       labelAr: "النسخ الاحتياطي" },
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          {language === "ar" ? "الإعدادات" : "Settings"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {language === "ar" ? "إدارة إعدادات الشركة والنظام" : "Manage company profile and system settings"}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-52 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-b border-slate-100 last:border-0 ${activeTab === tab.id ? "bg-brand-primary text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {language === "ar" ? tab.labelAr : tab.labelEn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── Company Profile ── */}
          {activeTab === "company" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-brand-primary" />
                {language === "ar" ? "بيانات الشركة" : "Company Profile"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={language === "ar" ? "اسم الشركة (إنجليزي)" : "Company Name (EN)"} value={name} onChange={e => setName(e.target.value)} />
                <Input label={language === "ar" ? "اسم الشركة (عربي)" : "Company Name (AR)"} value={nameAr} onChange={e => setNameAr(e.target.value)} />
                <Input label={language === "ar" ? "الرقم الضريبي (VAT)" : "VAT Number"} value={vatNumber} onChange={e => setVatNumber(e.target.value)} placeholder="300XXXXXXXXXXX" />
                <Input label={language === "ar" ? "رقم السجل التجاري" : "CR Number"} value={crNumber} onChange={e => setCrNumber(e.target.value)} />
                <Input label={language === "ar" ? "العنوان (إنجليزي)" : "Address (EN)"} value={address} onChange={e => setAddress(e.target.value)} />
                <Input label={language === "ar" ? "العنوان (عربي)" : "Address (AR)"} value={addressAr} onChange={e => setAddressAr(e.target.value)} />
                <Input label={language === "ar" ? "المدينة" : "City"} value={city} onChange={e => setCity(e.target.value)} />
                <Input label={language === "ar" ? "رقم الهاتف" : "Phone"} value={phone} onChange={e => setPhone(e.target.value)} />
                <Input label={language === "ar" ? "البريد الإلكتروني" : "Email"} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <Select label={language === "ar" ? "نسبة ضريبة القيمة المضافة الافتراضية" : "Default VAT Rate"}
                  value={defaultVatRate} onChange={e => setDefaultVatRate(e.target.value)}
                  options={[{ value: "0", label: "0%" }, { value: "5", label: "5%" }, { value: "15", label: "15%" }]} />
                <Input label={language === "ar" ? "بداية السنة المالية" : "Fiscal Year Start"} value={fiscalYearStart} onChange={e => setFiscalYearStart(e.target.value)} placeholder="01-01" />
              </div>
              {/* Logo + Stamp uploads */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <p className="text-sm font-bold text-slate-700">
                  {language === "ar" ? "الشعار والختم" : "Logo & Stamp"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Logo */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      {language === "ar" ? "شعار الشركة" : "Company Logo"}
                    </label>
                    <div
                      onClick={() => logoFileRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors min-h-[100px]"
                    >
                      {logoUrl ? (
                        <img src={logoUrl} alt="logo" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-slate-300" />
                          <p className="text-xs text-slate-400 text-center">
                            {language === "ar" ? "انقر لرفع الشعار" : "Click to upload logo"}
                          </p>
                          <p className="text-xs text-slate-300 text-center">PNG شفاف موصى به</p>
                        </>
                      )}
                      <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadFile(currentCompany!.id, "logos", file);
                          setLogoUrl(url);
                          if (logoFileRef.current) logoFileRef.current.value = "";
                        }}
                      />
                    </div>
                    {logoUrl && (
                      <button onClick={() => setLogoUrl("")} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {language === "ar" ? "إزالة الشعار" : "Remove logo"}
                      </button>
                    )}
                  </div>

                  {/* Stamp */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-slate-600">
                      {language === "ar" ? "ختم الشركة" : "Company Stamp"}
                    </label>
                    <div
                      onClick={() => stampFileRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors min-h-[100px]"
                    >
                      {stampUrl ? (
                        <img src={stampUrl} alt="stamp" className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-slate-300" />
                          <p className="text-xs text-slate-400 text-center">
                            {language === "ar" ? "انقر لرفع الختم" : "Click to upload stamp"}
                          </p>
                          <p className="text-xs text-slate-300 text-center">
                            {language === "ar" ? "PNG شفاف موصى به" : "Transparent PNG recommended"}
                          </p>
                        </>
                      )}
                      <input
                        ref={stampFileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const url = await uploadFile(currentCompany!.id, "stamps", file);
                          setStampUrl(url);
                          if (stampFileRef.current) stampFileRef.current.value = "";
                        }}
                      />
                    </div>
                    {stampUrl && (
                      <button onClick={() => setStampUrl("")} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {language === "ar" ? "إزالة الختم" : "Remove stamp"}
                      </button>
                    )}
                  </div>

                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveCompany} loading={saving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {language === "ar" ? "حفظ التغييرات" : "Save Changes"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Signatories ── */}
          {activeTab === "signatories" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-brand-primary" />
                  {language === "ar" ? "المفوضون بالتوقيع" : "Authorized Signatories"}
                </h3>
                <Button onClick={() => { setEditingSig(null); setSigName(""); setSigDesignation(""); setSigSignatureUrl(""); setShowSigModal(true); }} className="flex items-center gap-2 text-xs">
                  <Plus className="h-4 w-4" />
                  {language === "ar" ? "إضافة مفوض" : "Add Signatory"}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {language === "ar" ? "تُستخدم هذه الأسماء في تصدير الوثائق (PDF) عند اختيار المفوض بالتوقيع" : "These appear in PDF exports when you select an authorized signatory"}
              </p>
              {signatories.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">
                  <UserCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  {language === "ar" ? "لا يوجد مفوضون بالتوقيع" : "No signatories yet"}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {signatories.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.designation}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {s.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                        </span>
                        <button onClick={() => { setEditingSig(s); setSigName(s.name); setSigDesignation(s.designation); setSigSignatureUrl((s as any).signatureUrl || ""); setShowSigModal(true); }}
                          className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-slate-50 rounded-lg transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteSig(s.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Letterheads ── */}
          {activeTab === "letterheads" && (
            <div className="space-y-5">
              {/* ── Primary Full Page Letterhead ── */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brand-primary" />
                    {language === "ar" ? "الترويسة الرئيسية (صفحة كاملة A4)" : "Primary Letterhead (Full Page A4)"}
                  </h3>
                  {fullLetterhead && (
                    <button onClick={() => setFullLetterhead("")} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                      <X className="h-3 w-3" />
                      {language === "ar" ? "إزالة" : "Remove"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {language === "ar"
                    ? "صورة بحجم A4 كامل تُستخدم كخلفية لجميع صفحات المستند المصدَّر. الحجم الموصى به: 2480×3508 بكسل (A4 بدقة 300)"
                    : "A full A4-size image used as background on all pages of the exported document. Recommended: 2480×3508px (A4 at 300dpi) or 794×1123px (96dpi)"}
                </p>

                <div
                  onClick={() => fullLHFileRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors min-h-[140px] relative overflow-hidden"
                >
                  {fullLetterhead ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <img src={fullLetterhead} alt="Primary Letterhead" className="max-h-40 object-contain rounded border border-slate-200 shadow-sm" />
                      <p className="text-xs text-emerald-600 font-semibold">✓ {language === "ar" ? "تم رفع الترويسة الرئيسية" : "Primary letterhead uploaded"}</p>
                      <p className="text-[10px] text-slate-400">{language === "ar" ? "انقر لتغييرها" : "Click to change"}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Upload className="h-8 w-8 opacity-30" />
                      <p className="text-sm font-semibold">{language === "ar" ? "انقر لرفع الترويسة الرئيسية" : "Click to upload primary letterhead"}</p>
                      <p className="text-xs">{language === "ar" ? "PNG أو JPG — صفحة كاملة A4" : "PNG or JPG — Full A4 page"}</p>
                    </div>
                  )}
                  <input
                    ref={fullLHFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadFile(currentCompany!.id, "letterheads", file);
                      setFullLetterhead(url);
                      if (fullLHFileRef.current) fullLHFileRef.current.value = "";
                    }}
                  />
                </div>

                {fullLetterhead && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
                    <p className="font-semibold">{language === "ar" ? "كيف تُطبَّق الترويسة الرئيسية:" : "How the primary letterhead is applied:"}</p>
                    <p>• {language === "ar" ? "تُرسم كخلفية كاملة على كل صفحة في الملف المصدَّر" : "Drawn as full-page background on every page of exported files"}</p>
                    <p>• {language === "ar" ? "يبدأ المحتوى بعد 48mm من الأعلى (منطقة آمنة)" : "Content starts 48mm from top to avoid overlapping header area"}</p>
                    <p>• {language === "ar" ? "تظهر كخيار «الترويسة الرئيسية» في لوحة التصدير" : "Appears as «Primary Letterhead» option in the export panel"}</p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-brand-primary" />
                  {language === "ar" ? "الترويسات الإضافية" : "Additional Letterheads"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ar"
                    ? "أضف ترويسات متعددة للشركة — تظهر كخيارات عند تصدير المستندات"
                    : "Add multiple letterheads for your company — selectable when exporting documents"}
                </p>

                {/* Existing letterheads */}
                {additionalLetterheads.length > 0 && (
                  <div className="space-y-3">
                    {additionalLetterheads.map(lh => (
                      <div key={lh.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                        {lh.url ? (
                          <img src={lh.url} alt={lh.name} className="h-10 w-16 object-contain rounded border border-slate-200 bg-white shrink-0" />
                        ) : (
                          <div className="h-10 w-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0">
                            <ImageIcon className="h-5 w-5 text-slate-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{lh.name}</p>
                          <p className="text-xs text-slate-400">{lh.url ? (language === "ar" ? "✓ تم رفع الصورة" : "✓ Image uploaded") : (language === "ar" ? "لا توجد صورة" : "No image")}</p>
                        </div>
                        <button onClick={() => setAdditionalLetterheads(p => p.filter(x => x.id !== lh.id))}
                          className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new letterhead */}
                <div className="border border-dashed border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-600">{language === "ar" ? "إضافة ترويسة جديدة" : "Add New Letterhead"}</p>
                  <input
                    value={newLHName}
                    onChange={e => setNewLHName(e.target.value)}
                    placeholder={language === "ar" ? "اسم الترويسة (مثال: الفرع الرئيسي)" : "Letterhead name (e.g. Main Branch)"}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />

                  {/* File upload button */}
                  <div
                    onClick={() => lhFileRef.current?.click()}
                    className="flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors"
                  >
                    {newLHFile ? (
                      <img src={newLHFile} alt="preview" className="h-12 object-contain rounded border border-slate-200 bg-white" />
                    ) : (
                      <div className="h-12 w-20 bg-slate-100 rounded border border-slate-200 flex items-center justify-center shrink-0">
                        <Upload className="h-5 w-5 text-slate-300" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-600">
                        {newLHFile
                          ? (language === "ar" ? "تم اختيار الصورة — انقر لتغييرها" : "Image selected — click to change")
                          : (language === "ar" ? "انقر لرفع صورة الترويسة" : "Click to upload letterhead image")}
                      </p>
                      <p className="text-xs text-slate-400">{language === "ar" ? "PNG, JPG — الحجم الموصى به: 900×200 بكسل" : "PNG, JPG — Recommended size: 900×200px"}</p>
                    </div>
                    <input
                      ref={lhFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadFile(currentCompany!.id, "letterheads", file);
                        setNewLHFile(url);
                      }}
                    />
                  </div>

                  <Button
                    onClick={() => {
                      if (!newLHName.trim()) {
                        toast.error(language === "ar" ? "أدخل اسم الترويسة" : "Enter a letterhead name");
                        return;
                      }
                      setAdditionalLetterheads(p => [...p, {
                        id: Math.random().toString(36).slice(2),
                        name: newLHName.trim(),
                        url: newLHFile,
                      }]);
                      setNewLHName("");
                      setNewLHFile("");
                      if (lhFileRef.current) lhFileRef.current.value = "";
                    }}
                    className="flex items-center gap-2 text-xs w-full justify-center"
                  >
                    <Plus className="h-4 w-4" />
                    {language === "ar" ? "إضافة الترويسة" : "Add Letterhead"}
                  </Button>
                </div>
              </div>

              {/* ── Header Asset ── */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-brand-primary" />
                  {language === "ar" ? "صورة رأس الصفحة" : "Header Asset"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ar" ? "صورة عرضية تظهر أعلى المستندات المصدرة (Header + Footer مود)" : "Full-width banner image at top of documents (used in Header + Footer mode)"}
                </p>
                <div
                  onClick={() => headerAssetFileRef.current?.click()}
                  className="flex items-center gap-4 p-4 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors"
                >
                  {headerAssetUrl ? (
                    <img src={headerAssetUrl} alt="header" className="h-14 w-full object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-slate-400">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">{language === "ar" ? "انقر لرفع صورة الرأس" : "Click to upload header image"}</span>
                    </div>
                  )}
                  <input
                    ref={headerAssetFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadFile(currentCompany!.id, "letterheads", file);
                      setHeaderAssetUrl(url);
                    }}
                  />
                </div>
                {headerAssetUrl && (
                  <button onClick={() => setHeaderAssetUrl("")} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <X className="h-3 w-3" />{language === "ar" ? "إزالة صورة الرأس" : "Remove header image"}
                  </button>
                )}
              </div>

              {/* ── Footer Asset ── */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-brand-primary" />
                  {language === "ar" ? "صورة تذييل الصفحة" : "Footer Asset"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ar" ? "صورة عرضية كاملة تظهر أسفل جميع المستندات المصدرة" : "Full-width image displayed at the bottom of all exported documents"}
                </p>
                <div
                  onClick={() => footerFileRef.current?.click()}
                  className="flex items-center gap-4 p-4 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors"
                >
                  {footerAssetUrl ? (
                    <img src={footerAssetUrl} alt="footer" className="h-14 w-full object-cover rounded-lg border border-slate-200" />
                  ) : (
                    <div className="w-full h-14 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center gap-2 text-slate-400">
                      <Upload className="h-5 w-5" />
                      <span className="text-sm">{language === "ar" ? "انقر لرفع صورة التذييل" : "Click to upload footer image"}</span>
                    </div>
                  )}
                  <input
                    ref={footerFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadFile(currentCompany!.id, "letterheads", file);
                      setFooterAssetUrl(url);
                    }}
                  />
                </div>
                {footerAssetUrl && (
                  <button
                    onClick={() => setFooterAssetUrl("")}
                    className="text-xs text-red-500 hover:underline flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    {language === "ar" ? "إزالة صورة التذييل" : "Remove footer image"}
                  </button>
                )}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveLetterheads} loading={lhSaving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {language === "ar" ? "حفظ الترويسات" : "Save Letterheads"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Equity Share ── */}
          {activeTab === "equity" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-brand-primary" />
                {language === "ar" ? "توزيع حصص الملكية" : "Equity Share Distribution"}
              </h3>
              <p className="text-xs text-slate-500">
                {language === "ar"
                  ? "حدد نسب الملكية لكل شريك — تُستخدم في صفحة توزيع الأرباح"
                  : "Define ownership percentages per partner — used in the Profit Distribution module"}
              </p>
              {equityPartners.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  <PieChart className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  {language === "ar" ? "لا يوجد شركاء بعد" : "No partners yet"}
                </div>
              ) : (
                <div className="space-y-3">
                  {equityPartners.map(p => (
                    <div key={p.id} className="grid grid-cols-3 gap-3 items-center">
                      <input
                        value={p.name}
                        onChange={e => updateEquityPartner(p.id, "name", e.target.value)}
                        placeholder={language === "ar" ? "اسم الشريك" : "Partner name"}
                        className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" max="100"
                          value={p.percent}
                          onChange={e => updateEquityPartner(p.id, "percent", Number(e.target.value))}
                          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                        <span className="text-sm text-slate-500 shrink-0">%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="0"
                          value={p.targetCapital}
                          onChange={e => updateEquityPartner(p.id, "targetCapital", Number(e.target.value))}
                          placeholder={language === "ar" ? "رأس المال المستهدف" : "Target capital"}
                          className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                        <button onClick={() => removeEquityPartner(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="text-sm text-slate-500 pt-1">
                    {language === "ar" ? "المجموع:" : "Total:"}{" "}
                    <span className={`font-bold ${equityPartners.reduce((s,p) => s+p.percent,0) > 100 ? "text-red-600" : "text-emerald-600"}`}>
                      {equityPartners.reduce((s,p) => s+p.percent,0)}%
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <button onClick={addEquityPartner}
                  className="flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-blue-700 transition-colors">
                  <Plus className="h-4 w-4" />
                  {language === "ar" ? "إضافة شريك" : "Add Partner"}
                </button>
                <div className="flex-1" />
                <Button onClick={handleSaveEquity} loading={equitySaving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {language === "ar" ? "حفظ التوزيع" : "Save Distribution"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Custom Lists ── */}
          {activeTab === "lists" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ListEditor label="Expense Categories" labelAr="فئات المصروفات"
                  items={lists.expenseCategories}
                  onAdd={v => addToList("expenseCategories", v)}
                  onRemove={i => removeFromList("expenseCategories", i)} />
                <ListEditor label="Income Categories" labelAr="فئات الإيرادات"
                  items={lists.incomeCategories}
                  onAdd={v => addToList("incomeCategories", v)}
                  onRemove={i => removeFromList("incomeCategories", i)} />
                <ListEditor label="Designations" labelAr="المسميات الوظيفية"
                  items={lists.designations}
                  onAdd={v => addToList("designations", v)}
                  onRemove={i => removeFromList("designations", i)} />
                <ListEditor label="Payment Methods" labelAr="طرق الدفع"
                  items={lists.paymentMethods}
                  onAdd={v => addToList("paymentMethods", v)}
                  onRemove={i => removeFromList("paymentMethods", i)} />
                <ListEditor label="Units of Measure" labelAr="وحدات القياس"
                  items={lists.units}
                  onAdd={v => addToList("units", v)}
                  onRemove={i => removeFromList("units", i)} />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveLists} loading={listsSaving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {language === "ar" ? "حفظ القوائم" : "Save Lists"}
                </Button>
              </div>
            </div>
          )}

          {/* ── ZATCA Settings ── */}
          {activeTab === "zatca" && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-primary" />
                {language === "ar" ? "إعدادات زاتكا" : "ZATCA Settings"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label={language === "ar" ? "مرحلة زاتكا" : "ZATCA Phase"}
                  value={zatcaPhase} onChange={e => setZatcaPhase(e.target.value as "1" | "2")}
                  options={[{ value: "1", label: language === "ar" ? "المرحلة الأولى (توليد)" : "Phase 1 (Generation)" }, { value: "2", label: language === "ar" ? "المرحلة الثانية (تكامل)" : "Phase 2 (Integration)" }]} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <p className="font-semibold mb-1">{language === "ar" ? "ملاحظة مهمة" : "Important Note"}</p>
                <p className="text-xs">
                  {language === "ar"
                    ? "للمرحلة الثانية، يجب التسجيل في بوابة ZATCA والحصول على CSID/PCSID. تواصل مع فريق الدعم للمساعدة في الإعداد."
                    : "For Phase 2, you need to register on the ZATCA portal and obtain CSID/PCSID credentials. Contact support for setup assistance."}
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveCompany} loading={saving} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {language === "ar" ? "حفظ" : "Save"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Data Backup ── */}
          {activeTab === "backup" && (
            <div className="space-y-4">

              {/* Export */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Download className="h-5 w-5 text-brand-primary" />
                  {language === "ar" ? "تصدير النسخة الاحتياطية" : "Export Backup"}
                </h3>
                <p className="text-sm text-slate-500">
                  {language === "ar"
                    ? "تصدير جميع بيانات الشركة كملف JSON يمكن استخدامه لاستعادة البيانات أو نقلها."
                    : "Export all company data as a JSON file that can be used to restore or transfer data."}
                </p>
                <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 grid grid-cols-2 gap-1">
                  {["invoices","bills","expenses","customers","suppliers","products","employees","quotations","purchase orders","delivery notes","petty cash","overheads","projects","attendance","VAT returns","income"].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="capitalize">{item}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={handleBackup} loading={backingUp} className="flex items-center gap-2 w-full justify-center">
                  <Download className="h-4 w-4" />
                  {language === "ar" ? "تصدير النسخة الاحتياطية (JSON)" : "Export Full Backup (JSON)"}
                </Button>
              </div>

              {/* Import */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-indigo-500" />
                  {language === "ar" ? "استيراد نسخة احتياطية" : "Import Backup"}
                </h3>
                <p className="text-sm text-slate-500">
                  {language === "ar"
                    ? "استيراد بيانات من ملف JSON تم تصديره مسبقاً من صفقة. سيتم دمج البيانات مع الموجودة حالياً."
                    : "Import data from a previously exported Safqa JSON backup file. Records will be merged with existing data."}
                </p>

                {/* Upload area */}
                <div
                  onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors"
                >
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-600">
                    {language === "ar" ? "انقر لاختيار ملف JSON" : "Click to select a JSON file"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === "ar" ? "ملفات .json فقط" : ".json files only"}
                  </p>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleImport(file);
                    }}
                  />
                </div>

                {/* Progress */}
                {importing && importProgress && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-blue-700">
                        {language === "ar" ? "جاري الاستيراد..." : "Importing..."}
                      </p>
                      <p className="text-xs text-blue-500">
                        {importProgress.current} / {importProgress.total}
                      </p>
                    </div>
                    <div className="w-full bg-blue-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-blue-500 capitalize">
                      {language === "ar" ? "يتم استيراد:" : "Importing:"} {importProgress.collection}
                    </p>
                  </div>
                )}

                {/* Import result */}
                {importResult && (
                  <div className={`border rounded-xl p-4 flex items-start gap-3 ${
                    importResult.failed === 0
                      ? "bg-emerald-50 border-emerald-200"
                      : "bg-amber-50 border-amber-200"
                  }`}>
                    <Check className={`h-5 w-5 shrink-0 mt-0.5 ${importResult.failed === 0 ? "text-emerald-500" : "text-amber-500"}`} />
                    <div>
                      <p className={`text-sm font-semibold ${importResult.failed === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {language === "ar" ? "اكتمل الاستيراد" : "Import Complete"}
                      </p>
                      <p className="text-xs mt-1 text-slate-600">
                        {language === "ar"
                          ? `${importResult.success} سجل تم استيراده بنجاح${importResult.failed > 0 ? ` — ${importResult.failed} فشل` : ""}`
                          : `${importResult.success} records imported successfully${importResult.failed > 0 ? ` — ${importResult.failed} failed` : ""}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-800 text-sm">
                      {language === "ar" ? "ملاحظة مهمة حول الاستيراد" : "Important note about importing"}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {language === "ar"
                        ? "الاستيراد يدمج البيانات مع الموجودة — لن يتم حذف أي بيانات حالية. السجلات التي لها نفس المعرف ستُحدَّث."
                        : "Import merges data with existing records — no current data will be deleted. Records with matching IDs will be updated."}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Signatory Modal */}
      <Modal isOpen={showSigModal} onClose={() => setShowSigModal(false)}
        title={editingSig ? (language === "ar" ? "تعديل المفوض" : "Edit Signatory") : (language === "ar" ? "إضافة مفوض بالتوقيع" : "Add Authorized Signatory")}>
        <div className="flex flex-col gap-4">
          <Input label={language === "ar" ? "الاسم الكامل" : "Full Name"} value={sigName} onChange={e => setSigName(e.target.value)} placeholder={language === "ar" ? "مثال: أحمد محمد" : "e.g. John Smith"} />
          <Input label={language === "ar" ? "المسمى الوظيفي" : "Designation"} value={sigDesignation} onChange={e => setSigDesignation(e.target.value)} placeholder={language === "ar" ? "مثال: المدير المالي" : "e.g. Chief Financial Officer"} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-700">
              {language === "ar" ? "صورة التوقيع الرقمي (اختياري)" : "Digital Signature Image (optional)"}
            </label>
            <div
              onClick={() => sigFileRef.current?.click()}
              className="flex items-center gap-3 p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-brand-primary hover:bg-blue-50/30 transition-colors"
            >
              {sigSignatureUrl ? (
                <img src={sigSignatureUrl} alt="signature" className="h-14 object-contain border border-slate-200 rounded-lg bg-white p-1 max-w-full" />
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <Upload className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{language === "ar" ? "انقر لرفع صورة التوقيع" : "Click to upload signature image"}</p>
                    <p className="text-xs text-slate-300">{language === "ar" ? "PNG شفاف موصى به" : "Transparent PNG recommended"}</p>
                  </div>
                </div>
              )}
              <input
                ref={sigFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadFile(currentCompany!.id, "signatures", file);
                  setSigSignatureUrl(url);
                  if (sigFileRef.current) sigFileRef.current.value = "";
                }}
              />
            </div>
            {sigSignatureUrl && (
              <button onClick={() => setSigSignatureUrl("")} className="text-xs text-red-500 hover:underline flex items-center gap-1 mt-1">
                <X className="h-3 w-3" />
                {language === "ar" ? "إزالة التوقيع" : "Remove signature"}
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowSigModal(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSaveSig} loading={saving}>{language === "ar" ? "حفظ" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;
