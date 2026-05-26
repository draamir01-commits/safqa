import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ShieldAlert, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { listenCompanyCollection, saveProduct, deleteDocument } from "../../firebase/firestore";
import { Product } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setName(p.name); setNameAr(p.nameAr); setSku(p.sku);
    setType(p.type || "product"); setSalePrice(String(p.salePrice));
    setCostPrice(String(p.costPrice || 0)); setVatRate((p.vatRate || 15) as 0 | 5 | 15);
    setTrackInventory(p.trackInventory ?? true); setStockQty(String(p.stockQty || 0));
    setModalOpen(true);
  };

  // Form Fields
  const [name, setName] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [type, setType] = React.useState<"product" | "service">("product");
  const [salePrice, setSalePrice] = React.useState("0");
  const [costPrice, setCostPrice] = React.useState("0");
  const [vatRate, setVatRate] = React.useState<0 | 5 | 15>(15);
  const [trackInventory, setTrackInventory] = React.useState(true);
  const [stockQty, setStockQty] = React.useState("0");

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "products", (data) => {
      setProducts(data as Product[]);
    });
    return unsubscribe;
  }, [currentCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !nameAr || !sku) {
      toast.error(language === "ar" ? "برجاء توفير الاسم ورمز المادة SKU" : "Arabic name, English name, and SKU are required");
      return;
    }

    setLoading(true);
    try {
      const isZeroOrExempt = vatRate === 0 ? "zero" : "standard";
      const data = {
        name, nameAr, sku, type,
        salePrice: Number(salePrice), costPrice: Number(costPrice),
        vatRate: Number(vatRate), vatCategory: isZeroOrExempt,
        trackInventory: type === "product" ? trackInventory : false,
        stockQty: type === "product" && trackInventory ? Number(stockQty) : 0,
        isActive: true,
      };
      if (editingId) {
        await saveProduct(currentCompany!.id, editingId, data);
        toast.success(language === "ar" ? "تم تحديث الصنف" : "Product updated");
      } else {
        const productId = "prod_" + Math.random().toString(36).substr(2, 9);
        await saveProduct(currentCompany!.id, productId, data);
        toast.success(language === "ar" ? "تم حفظ الصنف بنجاح" : "Product added successfully");
      }
      setModalOpen(false); resetForm();
    } catch (err) {
      console.error(err); toast.error(t("common.error"));
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(language === "ar" ? "هل أنت متأكد من الحذف؟" : "Are you sure?")) return;
    try {
      await deleteDocument(`companies/${currentCompany!.id}/products`, id);
      toast.success(language === "ar" ? "تم الحذف نجاح" : "Product removed");
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    }
  };

  const resetForm = () => { setEditingId(null);
    setName("");
    setNameAr("");
    setSku("");
    setType("product");
    setSalePrice("0");
    setCostPrice("0");
    setVatRate(15);
    setTrackInventory(true);
    setStockQty("0");
  };

  const columns: Column<Product>[] = [
    {
      header: language === "ar" ? "بيانات الصنف" : "Product Item",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{language === "ar" ? row.nameAr : row.name}</span>
          <span className="text-[10px] text-slate-400">SKU: {row.sku}</span>
        </div>
      )
    },
    {
      header: language === "ar" ? "النوع" : "Category type",
      render: (row) => (
        <span className="text-xs px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-600">
          {row.type === "product" ? (language === "ar" ? "منتج" : "Product") : (language === "ar" ? "خدمة" : "Service")}
        </span>
      )
    },
    {
      header: language === "ar" ? "سعر البيع" : "Sale Price",
      render: (row) => (
        <CurrencyDisplay amount={row.salePrice} className="text-xs text-slate-700 font-bold" />
      )
    },
    {
      header: language === "ar" ? "معدل الضريبة" : "VAT rate",
      render: (row) => (
        <span className="text-xs font-bold text-slate-600">%{row.vatRate}</span>
      )
    },
    {
      header: language === "ar" ? "المخزون المتوفر" : "Available Stock",
      render: (row) => {
        if (row.type === "service") return <span className="text-slate-400 text-xs">—</span>;
        const outOfStock = row.stockQty <= 0;
        return (
          <span className={`text-xs px-2 py-0.5 rounded font-semibold ${outOfStock ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-700'}`}>
            {row.stockQty} {row.unit || "Pcs"}
          </span>
        );
      }
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(row)} className="p-1 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded">
            <Pencil className="h-4 w-4" />
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
          <h2 className="text-xl font-bold text-slate-800">{t("nav.products")}</h2>
          <p className="text-xs text-slate-500">Track corporate inventory stock levels, set sale prices, and link the standard VAT categories.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={products} filename="products" headers={{ name: "Name", nameAr: "Arabic Name", sku: "SKU", salePrice: "Sale Price", costPrice: "Cost", vatRate: "VAT %", stockQty: "Stock" }} />
          <Button onClick={() => setModalOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "إضافة صنف" : "Add Product"}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchPlaceholder={language === "ar" ? "البحث بالاسم أو SKU..." : "Search by SKU or name..."}
        searchField="nameAr"
      />

      {/* Add Product Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? (language === "ar" ? "تعديل الصنف" : "Edit Product") : (language === "ar" ? "إضافة صنف جديد" : "Add New Item")}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "اسم الصنف بالإنجليزي" : "Item Name (English)"}
              placeholder="e.g., iPhone 15 Pro Max"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={language === "ar" ? "اسم الصنف بالعربي" : "Item Name (Arabic)"}
              placeholder="مثال: ايفون 15 برو ماكس"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="SKU (الباركود / رمز المادة)"
              placeholder="IPH15PM-256"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
            />
            <Select
              label={language === "ar" ? "نوع المدخل" : "Item Type"}
              options={[
                { value: "product", label: language === "ar" ? "منتج ذو مستودع (مخزون)" : "Physical Product (Stockable)" },
                { value: "service", label: language === "ar" ? "خدمة / منتج رقمي" : "Service (Non-Stock)" }
              ]}
              value={type}
              onChange={(e) => setType(e.target.value as "product" | "service")}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={language === "ar" ? "سعر البيع (قبل الضريبة)" : "Sale Price (Excl. VAT)"}
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              required
            />
            <Input
              label={language === "ar" ? "سعر التكلفة" : "Cost Price"}
              type="number"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
            <Select
              label={language === "ar" ? "نسبة ضريبة القيمة المضافة KSA" : "KSA VAT Rate"}
              options={[
                { value: 15, label: "15% - Standard Rated / خاضع للمعدل الأساسي" },
                { value: 5, label: "5% - Transit Rate" },
                { value: 0, label: "0% - Exempt/Zero Rated / معفى من الضريبة" }
              ]}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value) as 0 | 5 | 15)}
            />
          </div>

          {type === "product" && (
            <div className="p-4 rounded-lg bg-slate-50 border gap-4 flex flex-col md:flex-row md:items-center justify-between check-transition border-slate-160 ">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={trackInventory}
                  onChange={(e) => setTrackInventory(e.target.checked)}
                  className="rounded border-slate-300 h-4 w-4 bg-white"
                />
                {language === "ar" ? "تسجيل الحركات وتتبع مستويات الكمية" : "Track inventory quantities dynamically"}
              </label>

              {trackInventory && (
                <div className="w-1/2">
                  <Input
                    label={language === "ar" ? "الكمية المتاحة حالياً" : "Opening Physical Stock Quantity"}
                    type="number"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                  />
                </div>
              )}
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
export default ProductsPage;
