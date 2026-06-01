import * as React from "react";
import { Plus, Trash2, Edit, ChevronDown, ChevronUp, UserPlus, Star, Building2, User, Phone, Mail, MapPin, CreditCard, Briefcase, X, Printer, FileText} from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, saveCustomer, deleteDocument } from "../../firebase/firestore";
import { isValidSaudiVat, isValidSaudiCrn } from "../../utils/validators";
import { CustomerOrSupplier, ClientContact } from "../../types";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { PrintManager } from "../../components/ui/PrintManager";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const PAYMENT_TERMS = ["Net 7","Net 15","Net 30","Net 45","Net 60","Due on Receipt","Advance Payment"];
const CATEGORIES = ["Government","Semi-Government","Private Sector","SME","Multinational","Individual","Other"];
const INDUSTRIES = ["Construction","Oil & Gas","Healthcare","Education","Retail","Manufacturing","Logistics","Technology","Real Estate","Other"];
const CITIES = ["Riyadh","Jeddah","Dammam","Mecca","Medina","Khobar","Taif","Tabuk","Abha","Hail"];

const genId = () => Math.random().toString(36).slice(2, 10);

const emptyContact = (): ClientContact => ({
  id: genId(), name: "", nameAr: "", designation: "", email: "", phone: "", isPrimary: false, notes: "",
});

export const CustomersPage: React.FC = () => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

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
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<"info" | "address" | "contacts" | "financial">("info");

  // ── Form state ────────────────────────────────────────────
  const [name, setName]                     = React.useState("");
  const [nameAr, setNameAr]                 = React.useState("");
  const [email, setEmail]                   = React.useState("");
  const [phone, setPhone]                   = React.useState("+966 5");
  const [type, setType]                     = React.useState<"individual" | "business">("business");
  const [vatNumber, setVatNumber]           = React.useState("");
  const [crNumber, setCrNumber]             = React.useState("");
  const [clientCategory, setClientCategory] = React.useState("");
  const [industry, setIndustry]             = React.useState("");
  const [paymentTerms, setPaymentTerms]     = React.useState("Net 30");
  const [creditLimit, setCreditLimit]       = React.useState("");
  const [notes, setNotes]                   = React.useState("");
  // Address
  const [city, setCity]                     = React.useState("Riyadh");
  const [street, setStreet]                 = React.useState("");
  const [buildingNumber, setBuildingNumber] = React.useState("");
  const [district, setDistrict]             = React.useState("");
  const [zipCode, setZipCode]               = React.useState("");
  // Contacts
  const [contacts, setContacts]             = React.useState<ClientContact[]>([{ ...emptyContact(), isPrimary: true }]);

  React.useEffect(() => {
    if (!currentCompany) return;
    return listenCompanyCollection(currentCompany.id, "customers", d => setCustomers(d as CustomerOrSupplier[]));
  }, [currentCompany]);

  const resetForm = () => {
    setName(""); setNameAr(""); setEmail(""); setPhone("+966 5");
    setType("business"); setVatNumber(""); setCrNumber("");
    setClientCategory(""); setIndustry(""); setPaymentTerms("Net 30");
    setCreditLimit(""); setNotes("");
    setCity("Riyadh"); setStreet(""); setBuildingNumber(""); setDistrict(""); setZipCode("");
    setContacts([{ ...emptyContact(), isPrimary: true }]);
    setEditingId(null); setActiveTab("info");
  };

  const openEdit = (c: CustomerOrSupplier) => {
    setEditingId(c.id);
    setName(c.name); setNameAr(c.nameAr); setEmail(c.email || ""); setPhone(c.phone || "+966 5");
    setType(c.type); setVatNumber(c.vatNumber || ""); setCrNumber(c.crNumber || "");
    setClientCategory(c.clientCategory || ""); setIndustry(c.industry || "");
    setPaymentTerms(c.paymentTerms || "Net 30"); setCreditLimit(String(c.creditLimit || ""));
    setNotes(c.notes || "");
    setCity(c.city || "Riyadh"); setStreet(c.street || ""); setBuildingNumber(c.buildingNumber || "");
    setDistrict(c.district || ""); setZipCode(c.zipCode || "");
    setContacts(c.contacts?.length ? c.contacts : [{ ...emptyContact(), isPrimary: true }]);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nameAr) {
      toast.error(language === "ar" ? "الاسم العربي والإنجليزي إلزاميان" : "Arabic and English names are required");
      return;
    }
    if (type === "business" && vatNumber && !isValidSaudiVat(vatNumber)) {
      toast.error(language === "ar" ? "الرقم الضريبي غير صحيح — يجب أن يكون 15 رقم يبدأ وينتهي بـ 3" : "VAT Number must be 15 digits starting and ending with 3");
      return;
    }
    if (type === "business" && crNumber && !isValidSaudiCrn(crNumber)) {
      toast.error(language === "ar" ? "رقم السجل التجاري غير صحيح — يجب أن يكون 10 أرقام" : "CR Number must be 10 digits");
      return;
    }
    // Ensure exactly one primary contact
    const hasNonEmpty = contacts.some(c => c.name.trim());
    const finalContacts = hasNonEmpty
      ? contacts.map((c, i) => ({ ...c, isPrimary: i === contacts.findIndex(x => x.isPrimary) }))
      : [];

    setLoading(true);
    try {
      const data: Partial<CustomerOrSupplier> = {
        name, nameAr, email, phone, type,
        vatNumber: type === "business" ? vatNumber : "",
        crNumber: type === "business" ? crNumber : "",
        clientCategory, industry, paymentTerms,
        creditLimit: creditLimit ? Number(creditLimit) : 0,
        notes,
        city, street, buildingNumber, district, zipCode, country: "SA",
        contacts: finalContacts,
        isActive: true,
      };

      if (editingId) {
        await saveCustomer(currentCompany!.id, editingId, data);
        toast.success(language === "ar" ? "تم تحديث بيانات العميل" : "Customer updated");
      } else {
        const id = "cust_" + genId();
        await saveCustomer(currentCompany!.id, id, { ...data, totalInvoiced: 0, totalPaid: 0, balance: 0 });
        toast.success(language === "ar" ? "تم إضافة العميل بنجاح" : "Customer added successfully");
      }
      setModalOpen(false); resetForm();
    } catch (err) {
      console.error(err); toast.error(language === "ar" ? "حدث خطأ" : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Delete this customer?")) return;
    try {
      await deleteDocument(`companies/${currentCompany!.id}/customers`, id);
      toast.success(language === "ar" ? "تم حذف العميل" : "Customer deleted");
    } catch { toast.error(language === "ar" ? "حدث خطأ" : "Error"); }
  };

  // ── Contact helpers ────────────────────────────────────────
  const addContact = () => setContacts(prev => [...prev, emptyContact()]);
  const removeContact = (id: string) => setContacts(prev => prev.filter(c => c.id !== id));
  const updateContact = (id: string, field: keyof ClientContact, value: any) =>
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  const setPrimary = (id: string) =>
    setContacts(prev => prev.map(c => ({ ...c, isPrimary: c.id === id })));

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.nameAr.includes(q) ||
      (c.vatNumber || "").includes(q) || (c.email || "").toLowerCase().includes(q);
  });

  const getPrimary = (c: CustomerOrSupplier) =>
    c.contacts?.find(ct => ct.isPrimary) || c.contacts?.[0];

  const tabs = [
    { id: "info",      labelEn: "Basic Info",   labelAr: "المعلومات الأساسية" },
    { id: "address",   labelEn: "Address",       labelAr: "العنوان" },
    { id: "contacts",  labelEn: "Contacts",      labelAr: "جهات الاتصال" },
    { id: "financial", labelEn: "Financial",     labelAr: "البيانات المالية" },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "العملاء" : "Customers"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "ar" ? "إدارة العملاء مع جهات الاتصال المتعددة والعناوين المتوافقة مع زاتكا" : "Manage customers with multi-contacts and ZATCA-compliant addresses"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            data={customers}
            filename="customers"
            headers={{ name: "Name", nameAr: "Arabic Name", vatNumber: "VAT", crNumber: "CR", phone: "Phone", email: "Email", city: "City", paymentTerms: "Payment Terms" }}
          />
          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة عميل" : "Add Customer"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: language === "ar" ? "إجمالي العملاء" : "Total Customers", value: customers.length, cls: "text-slate-800" },
          { label: language === "ar" ? "شركات" : "Businesses", value: customers.filter(c => c.type === "business").length, cls: "text-blue-600" },
          { label: language === "ar" ? "أفراد" : "Individuals", value: customers.filter(c => c.type === "individual").length, cls: "text-emerald-600" },
          { label: language === "ar" ? "لديهم رقم ضريبي" : "With VAT No.", value: customers.filter(c => c.vatNumber).length, cls: "text-indigo-600" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={language === "ar" ? "بحث بالاسم أو الرقم الضريبي أو البريد..." : "Search by name, VAT, or email..."}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
        />
      </div>

      {/* Customer list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">{language === "ar" ? "لا يوجد عملاء بعد" : "No customers yet"}</p>
          </div>
        ) : filtered.map(c => {
          const primary = getPrimary(c);
          const isExpanded = expandedId === c.id;
          return (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Row */}
              <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  {c.type === "business"
                    ? <Building2 className="h-5 w-5 text-blue-600" />
                    : <User className="h-5 w-5 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 truncate">
                      {language === "ar" ? c.nameAr : c.name}
                    </p>
                    {c.clientCategory && (
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full shrink-0">{c.clientCategory}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {c.vatNumber && <span className="text-xs text-slate-400 font-mono">{c.vatNumber}</span>}
                    {primary && <span className="text-xs text-slate-400">• {primary.name}</span>}
                    {c.city && <span className="text-xs text-slate-400">• {c.city}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.paymentTerms && (
                    <span className="text-xs font-medium text-slate-500 hidden md:block">{c.paymentTerms}</span>
                  )}
                  <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Contact details */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      {language === "ar" ? "جهات الاتصال" : "Contacts"}
                    </p>
                    {c.contacts && c.contacts.length > 0 ? c.contacts.map(ct => (
                      <div key={ct.id} className="mb-3 last:mb-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-slate-700">{ct.name}</p>
                          {ct.isPrimary && <Star className="h-3 w-3 text-amber-500 fill-amber-400" />}
                        </div>
                        {ct.designation && <p className="text-xs text-slate-500">{ct.designation}</p>}
                        {ct.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{ct.phone}</p>}
                        {ct.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />{ct.email}</p>}
                      </div>
                    )) : (
                      <p className="text-xs text-slate-400">{language === "ar" ? "لا توجد جهات اتصال" : "No contacts added"}</p>
                    )}
                  </div>

                  {/* Address */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      {language === "ar" ? "العنوان" : "Address"}
                    </p>
                    <div className="text-xs text-slate-600 space-y-1">
                      {c.street && <p className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{c.buildingNumber} {c.street}</p>}
                      {c.district && <p className="text-slate-500">{c.district}</p>}
                      <p>{[c.city, c.zipCode].filter(Boolean).join(", ")}</p>
                    </div>
                  </div>

                  {/* Financial */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      {language === "ar" ? "البيانات المالية" : "Financial"}
                    </p>
                    <div className="space-y-1.5">
                      {c.paymentTerms && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{language === "ar" ? "شروط الدفع" : "Payment Terms"}</span>
                          <span className="text-xs font-semibold text-slate-700">{c.paymentTerms}</span>
                        </div>
                      )}
                      {c.creditLimit !== undefined && c.creditLimit > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{language === "ar" ? "حد الائتمان" : "Credit Limit"}</span>
                          <span className="text-xs font-semibold text-slate-700">{c.creditLimit?.toLocaleString()} SAR</span>
                        </div>
                      )}
                      {c.industry && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">{language === "ar" ? "القطاع" : "Industry"}</span>
                          <span className="text-xs font-semibold text-slate-700">{c.industry}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── MODAL ── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); resetForm(); }}
        title={editingId
          ? (language === "ar" ? "تعديل بيانات العميل" : "Edit Customer")
          : (language === "ar" ? "إضافة عميل جديد" : "Add New Customer")}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-0">

          {/* Modal tabs */}
          <div className="flex gap-0 border-b border-slate-200 mb-5 -mx-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {language === "ar" ? tab.labelAr : tab.labelEn}
              </button>
            ))}
          </div>

          {/* ── Tab: Basic Info ── */}
          {activeTab === "info" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={language === "ar" ? "الاسم بالإنجليزي *" : "Name in English *"} placeholder="e.g. ACME Saudi Arabia" value={name} onChange={e => setName(e.target.value)} required />
                <Input label={language === "ar" ? "الاسم بالعربي *" : "Name in Arabic *"} placeholder="مثال: أكمي السعودية" value={nameAr} onChange={e => setNameAr(e.target.value)} required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={language === "ar" ? "البريد الإلكتروني" : "Email"} type="email" placeholder="billing@client.com" value={email} onChange={e => setEmail(e.target.value)} />
                <Input label={language === "ar" ? "رقم الهاتف" : "Phone"} placeholder="+966 5XXXXXXXX" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
              <Select
                label={language === "ar" ? "نوع العميل" : "Customer Type"}
                value={type}
                onChange={e => setType(e.target.value as any)}
                options={[
                  { value: "business",    label: language === "ar" ? "شركة / منشأة" : "Business / Company" },
                  { value: "individual",  label: language === "ar" ? "فرد"           : "Individual" },
                ]}
              />
              {type === "business" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <Input label={language === "ar" ? "الرقم الضريبي VAT" : "VAT Number"} placeholder="300XXXXXXXXXXXX3" value={vatNumber} onChange={e => setVatNumber(e.target.value)} />
                  <Input label={language === "ar" ? "رقم السجل التجاري" : "CR Number"} placeholder="1010XXXXXX" value={crNumber} onChange={e => setCrNumber(e.target.value)} />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={language === "ar" ? "التصنيف" : "Category"}
                  value={clientCategory}
                  onChange={e => setClientCategory(e.target.value)}
                  options={[{ value: "", label: language === "ar" ? "اختر..." : "Select..." }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
                />
                <Select
                  label={language === "ar" ? "القطاع / الصناعة" : "Industry"}
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  options={[{ value: "", label: language === "ar" ? "اختر..." : "Select..." }, ...INDUSTRIES.map(i => ({ value: i, label: i }))]}
                />
              </div>
            </div>
          )}

          {/* ── Tab: Address ── */}
          {activeTab === "address" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                {language === "ar"
                  ? "هذه الحقول مطلوبة للفواتير القياسية B2B المتوافقة مع زاتكا المرحلة الثانية"
                  : "These fields are required for ZATCA Phase 2 B2B standard invoices"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={language === "ar" ? "اسم الشارع" : "Street Name"} placeholder="Olaya St" value={street} onChange={e => setStreet(e.target.value)} />
                <Input label={language === "ar" ? "رقم المبنى" : "Building Number"} placeholder="1234" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={language === "ar" ? "الحي" : "District"} placeholder="Al Olaya" value={district} onChange={e => setDistrict(e.target.value)} />
                <Input label={language === "ar" ? "الرمز البريدي" : "ZIP Code"} placeholder="12211" value={zipCode} onChange={e => setZipCode(e.target.value)} />
              </div>
              <Select
                label={language === "ar" ? "المدينة" : "City"}
                value={city}
                onChange={e => setCity(e.target.value)}
                options={CITIES.map(c => ({ value: c, label: c }))}
              />
            </div>
          )}

          {/* ── Tab: Contacts ── */}
          {activeTab === "contacts" && (
            <div className="flex flex-col gap-4">
              {contacts.map((ct, idx) => (
                <div key={ct.id} className="border border-slate-200 rounded-xl p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600">
                        {language === "ar" ? `جهة اتصال ${idx + 1}` : `Contact ${idx + 1}`}
                      </span>
                      {ct.isPrimary && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {language === "ar" ? "أساسي" : "Primary"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!ct.isPrimary && (
                        <button type="button" onClick={() => setPrimary(ct.id)} className="text-xs text-slate-400 hover:text-amber-600">
                          {language === "ar" ? "تعيين كأساسي" : "Set Primary"}
                        </button>
                      )}
                      {contacts.length > 1 && (
                        <button type="button" onClick={() => removeContact(ct.id)} className="p-1 text-slate-400 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input label={language === "ar" ? "الاسم *" : "Name *"} placeholder="Ahmed Al-Rashidi" value={ct.name} onChange={e => updateContact(ct.id, "name", e.target.value)} />
                    <Input label={language === "ar" ? "المسمى الوظيفي" : "Designation"} placeholder="Procurement Manager" value={ct.designation} onChange={e => updateContact(ct.id, "designation", e.target.value)} />
                    <Input label={language === "ar" ? "البريد الإلكتروني" : "Email"} type="email" placeholder="ahmed@client.com" value={ct.email || ""} onChange={e => updateContact(ct.id, "email", e.target.value)} />
                    <Input label={language === "ar" ? "رقم الهاتف" : "Phone"} placeholder="+966 5XXXXXXXX" value={ct.phone || ""} onChange={e => updateContact(ct.id, "phone", e.target.value)} />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addContact}
                className="flex items-center gap-2 text-sm font-semibold text-brand-primary hover:text-blue-700 transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                {language === "ar" ? "إضافة جهة اتصال أخرى" : "Add Another Contact"}
              </button>
            </div>
          )}

          {/* ── Tab: Financial ── */}
          {activeTab === "financial" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={language === "ar" ? "شروط الدفع" : "Payment Terms"}
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  options={PAYMENT_TERMS.map(t => ({ value: t, label: t }))}
                />
                <Input
                  label={language === "ar" ? "حد الائتمان (ر.س)" : "Credit Limit (SAR)"}
                  type="number"
                  placeholder="0"
                  value={creditLimit}
                  onChange={e => setCreditLimit(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">{language === "ar" ? "ملاحظات" : "Notes"}</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  placeholder={language === "ar" ? "أي ملاحظات خاصة بهذا العميل..." : "Any special notes about this customer..."}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
            <div className="flex gap-2 text-xs text-slate-400">
              {tabs.filter(t => t.id !== activeTab).map(t => (
                <button key={t.id} type="button" onClick={() => setActiveTab(t.id as any)}
                  className="hover:text-brand-primary transition-colors">
                  {language === "ar" ? t.labelAr : t.labelEn}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="sm" type="button" onClick={() => { setModalOpen(false); resetForm(); }}>
                {language === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              <Button variant="primary" size="sm" type="submit" loading={loading}>
                {language === "ar" ? "حفظ العميل" : "Save Customer"}
              </Button>
            </div>
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
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "العملاء" : "Customers"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Customers</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (customers as any[]).map((row: any, i: number) => {
                      const cells = [String(row.name||""), String(row.nameAr||""), String(row.vatNumber||""), String(row.phone||""), String(row.city||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Customers</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Customers</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Name</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Arabic Name</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">VAT</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Phone</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">City</th>",
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
        title={language === "ar" ? "العملاء" : "Customers"}
        itemCount={customers?.length}
      />
    </div>
  );
};

export default CustomersPage;
