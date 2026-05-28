import * as React from "react";
import { Plus, Trash2, Edit, ChevronDown, ChevronUp, UserPlus, Star, Building2, User, Phone, Mail, MapPin, CreditCard, Briefcase, X } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, saveCustomer, deleteDocument } from "../../firebase/firestore";
import { isValidSaudiVat, isValidSaudiCrn } from "../../utils/validators";
import { CustomerOrSupplier, ClientContact } from "../../types";
import { ExportMenu } from "../../components/ui/ExportMenu";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";

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
    </div>
  );
};

export default CustomersPage;
