import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Edit } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, saveCustomer, deleteDocument } from "../../firebase/firestore";
import { isValidSaudiVat, isValidSaudiCrn } from "../../utils/validators";
import { CustomerOrSupplier } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";

export const CustomersPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Form Fields
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("+966 5");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("Riyadh");
  const [type, setType] = React.useState<"individual" | "business">("business");
  const [vatNumber, setVatNumber] = React.useState("");
  const [crNumber, setCrNumber] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "customers", (data) => {
      setCustomers(data as CustomerOrSupplier[]);
    });
    return unsubscribe;
  }, [currentCompany]);

  const openEdit = (c: CustomerOrSupplier) => {
    setEditingId(c.id);
    setName(c.name); setNameAr(c.nameAr); setEmail(c.email || "");
    setPhone(c.phone || "+966 5"); setAddress(c.address || "");
    setCity(c.city || "Riyadh"); setType(c.type || "business");
    setVatNumber(c.vatNumber || ""); setCrNumber(c.crNumber || "");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nameAr) {
      toast.error(language === "ar" ? "الاسم العربي والإنجليزية حقول إلزامية" : "Arabic and English names are required");
      return;
    }

    if (type === "business") {
      if (vatNumber && !isValidSaudiVat(vatNumber)) {
        toast.error(language === "ar" ? "الرقم الضريبي المكون من 15 خانة يبدأ وينتهي بـ 3 غير صحيح" : "VAT Number must be 15 digits starting and ending with 3");
        return;
      }
      if (crNumber && !isValidSaudiCrn(crNumber)) {
        toast.error(language === "ar" ? "رقم السجل التجاري المكون من 10 خانات غير صحيح" : "Commercial Registration must be 10 digits");
        return;
      }
    }

    setLoading(true);
    try {
      const data = {
        name, nameAr, email, phone, address, city, type,
        vatNumber: type === "business" ? vatNumber : "",
        crNumber: type === "business" ? crNumber : "",
        isActive: true,
      };
      if (editingId) {
        await saveCustomer(currentCompany!.id, editingId, data);
        toast.success(language === "ar" ? "تم تحديث العميل" : "Customer updated");
      } else {
        const customerId = "cust_" + Math.random().toString(36).substr(2, 9);
        await saveCustomer(currentCompany!.id, customerId, { ...data, totalInvoiced: 0, totalPaid: 0, balance: 0 });
        toast.success(language === "ar" ? "تم إضافة العميل بنجاح" : "Customer recorded successfully");
      }
      setModalOpen(false); resetForm();
    } catch (err) {
      console.error(err); toast.error(t("common.error"));
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure you want to delete?")) return;
    try {
      await deleteDocument(`companies/${currentCompany!.id}/customers`, id);
      toast.success(language === "ar" ? "تم حذف العميل بنجاح" : "Customer removed");
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
  };

  const resetForm = () => {
    setName(""); setNameAr(""); setEmail(""); setPhone("+966 5");
    setAddress(""); setCity("Riyadh"); setType("business");
    setVatNumber(""); setCrNumber(""); setEditingId(null);
  };

  const columns: Column<CustomerOrSupplier>[] = [
    {
      header: language === "ar" ? "اسم العميل" : "Customer Name",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{language === "ar" ? row.nameAr : row.name}</span>
          <span className="text-[10px] text-slate-400">{row.email || "No email"}</span>
        </div>
      )
    },
    {
      header: language === "ar" ? "النوع" : "Type",
      render: (row) => (
        <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600">
          {row.type === "individual" ? (language === "ar" ? "فرد" : "Individual") : (language === "ar" ? "منشأة/شركة" : "Business")}
        </span>
      )
    },
    {
      header: language === "ar" ? "الرقم الضريبي KSA VAT" : "VAT Number",
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">{row.vatNumber || "—"}</span>
      )
    },
    {
      header: language === "ar" ? "رقم الهاتف والمدينة" : "Phone & Contact Location",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-700">{row.phone || "—"}</span>
          <span className="text-[10px] text-slate-400">{row.city}</span>
        </div>
      )
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(row)} className="p-1 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => handleDelete(row.id)} className="p-1 text-slate-400 hover:text-brand-danger hover:bg-red-50 rounded">
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
          <h2 className="text-xl font-bold text-slate-800">{t("nav.customers")}</h2>
          <p className="text-xs text-slate-500">Add, track, and synchronize customer directories for tax invoicing.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={customers} filename="customers" headers={{ name: "Name", nameAr: "Arabic Name", vatNumber: "VAT", crNumber: "CR", phone: "Phone", email: "Email", city: "City" }} />
          <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة عميل" : "Add Customer"}
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={customers}
        searchPlaceholder={language === "ar" ? "البحث بالاسم..." : "Search by name..."}
        searchField="nameAr"
      />

      {/* Add Customer Modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); resetForm(); }} title={editingId ? (language === "ar" ? "تعديل بيانات العميل" : "Edit Customer") : (language === "ar" ? "إضافة عميل جديد" : "Add New Customer")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "الاسم بالإنجليزي (إلزامي)" : "Name in English (Required)"}
              placeholder="e.g., General Electric SA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={language === "ar" ? "الاسم التجاري بالعربي (إلزامي)" : "Name in Arabic (Required)"}
              placeholder="مثال: شركة جنرال إلكتريك"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t("auth.email")}
              type="email"
              placeholder="billing@customer.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label={language === "ar" ? "رقم الجوال (+966)" : "Saudi Mobile (+966)"}
              placeholder="+966 5XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "العنوان البريدي الوطني" : "Postal District Street Address"}
              placeholder="401 Olaya Rd, Riyadh 12211"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Select
              label={language === "ar" ? "المدينة بموجب عقد التجارة" : "Registry City Location"}
              options={[
                { value: "Riyadh", label: "Riyadh / الرياض" },
                { value: "Jeddah", label: "Jeddah / جدة" },
                { value: "Dammam", label: "Dammam / الدمام" },
                { value: "Mecca", label: "Mecca / مكة" },
                { value: "Medina", label: "Medina / المدينة" }
              ]}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>

          <Select
            label={language === "ar" ? "فئة العميل القانونية" : "Customer Legal Category"}
            options={[
              { value: "business", label: language === "ar" ? "شركة / جهة تجارية خاضعة للضريبة" : "Corporate Business (Taxable)" },
              { value: "individual", label: language === "ar" ? "فرد / مستهلك نهائي مبسط" : "Consumer Individual (Simplified)" }
            ]}
            value={type}
            onChange={(e) => setType(e.target.value as "individual" | "business")}
          />

          {type === "business" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-150 ">
              <Input
                label={language === "ar" ? "الرقم الضريبي VAT للعميل" : "Customer Corporate VAT Number"}
                placeholder="300XXXXXXXXXXXX3"
                value={vatNumber}
                onChange={(e) => setVatNumber(e.target.value)}
              />
              <Input
                label={language === "ar" ? "رقم السجل التجاري CRN" : "Customer Commercial Registry Code"}
                placeholder="1010XXXXXX"
                value={crNumber}
                onChange={(e) => setCrNumber(e.target.value)}
              />
            </div>
          )}

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
    </div>
  );
};
export default CustomersPage;
