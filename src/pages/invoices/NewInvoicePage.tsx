import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, ArrowLeft, Save, Sparkles, List, Pencil } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { useAuthStore } from "../../stores/authStore";
import { 
  listenCompanyCollection, 
  getNextInvoiceNumber, 
  saveInvoice, 
  updateDocument 
} from "../../firebase/firestore";
import { calculateLineItem, calculateTotals } from "../../utils/vatCalculator";
import { processPhase1Invoice } from "../../utils/zatca/phase1";
import { processPhase2Invoice } from "../../utils/zatca/phase2";
import { InvoiceType, InvoiceStatus, ZatcaStatus, LineItem, CustomerOrSupplier, Product } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ClientSelector, ClientSelection } from "../../components/ui/ClientSelector";

export const NewInvoicePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  // Fetched data listings
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [invoiceNumber, setInvoiceNumber] = React.useState("");
  
  // Loading state
  const [setupLoading, setSetupLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  // Form selections and parameters
  const [type, setType] = React.useState<InvoiceType>(InvoiceType.SIMPLIFIED);
  const [customerId, setCustomerId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [projects, setProjects] = React.useState<any[]>([]);
  const [issueDate, setIssueDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [supplyDate, setSupplyDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = React.useState("");
  const [notesAr, setNotesAr] = React.useState("");

  // Grid line data
  const [lines, setLines] = React.useState<LineItem[]>([
    { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }
  ]);
  // Per-line input mode: "select" = pick from products list, "manual" = type freely
  const [lineModes, setLineModes] = React.useState<("select"|"manual")[]>(["select"]);

  const toggleLineMode = (idx: number) => {
    setLineModes(prev => {
      const next = [...prev];
      next[idx] = next[idx] === "select" ? "manual" : "select";
      return next;
    });
    // Clear product link when switching to manual
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], productId: "" };
      return updated;
    });
  };

  // Seed databases listing
  React.useEffect(() => {
    if (!currentCompany) return;

    setSetupLoading(true);
    const unsubCustomers = listenCompanyCollection(currentCompany.id, "customers", (data) => {
      setCustomers(data as CustomerOrSupplier[]);
      if (data.length > 0 && !customerId) setCustomerId(data[0].id);
    });
    const unsubProducts = listenCompanyCollection(currentCompany.id, "products", (data) => {
      setProducts(data as Product[]);
    });
    const unsubProjects = listenCompanyCollection(currentCompany.id, "projects", (data) => {
      setProjects(data as any[]);
    });

    // Compute dynamic auto numbering sequence
    getNextInvoiceNumber(currentCompany.id).then((num) => {
      setInvoiceNumber(num);
      setSetupLoading(false);
    });

    return () => {
      unsubCustomers();
      unsubProducts();
      unsubProjects();
      unsubProducts();
    };
  }, [currentCompany]);

  // Recalculates all sums on grid content modifications
  const totals = React.useMemo(() => {
    return calculateTotals(lines);
  }, [lines]);

  const handleAddLine = () => {
    setLines(prev => [...prev, { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }]);
    setLineModes(prev => [...prev, "select"]);
  };

  const handleDeleteLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
    setLineModes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleManualFieldChange = (idx: number, field: "name" | "nameAr" | "unit" | "vatRate", value: string | number) => {
    setLines(prev => {
      const updated = [...prev];
      if (field === "vatRate") {
        const vr = Number(value);
        const calc = calculateLineItem(updated[idx].qty, updated[idx].unitPrice, updated[idx].discountPercent, vr);
        updated[idx] = { ...updated[idx], vatRate: vr, vatAmount: calc.vatAmount, lineTotal: calc.lineTotal };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  };

  const handleProductSelect = (idx: number, prodId: string) => {
    const p = products.find(prod => prod.id === prodId);
    if (!p) return;

    const updated = [...lines];
    const calc = calculateLineItem(updated[idx].qty, p.salePrice, updated[idx].discountPercent, p.vatRate);

    updated[idx] = {
      productId: p.id,
      name: p.name,
      nameAr: p.nameAr,
      qty: updated[idx].qty,
      unit: p.unit || "PCE",
      unitPrice: p.salePrice,
      discountPercent: updated[idx].discountPercent,
      discountAmount: calc.discountAmount,
      vatRate: p.vatRate,
      vatAmount: calc.vatAmount,
      lineTotal: calc.lineTotal
    };
    setLines(updated);
  };

  const handleLineValueChange = (idx: number, field: "qty" | "unitPrice" | "discountPercent", value: number) => {
    const updated = [...lines];
    const line = updated[idx];
    
    const calc = calculateLineItem(
      field === "qty" ? value : line.qty,
      field === "unitPrice" ? value : line.unitPrice,
      field === "discountPercent" ? value : line.discountPercent,
      line.vatRate
    );

    updated[idx] = {
      ...line,
      qty: field === "qty" ? value : line.qty,
      unitPrice: field === "unitPrice" ? value : line.unitPrice,
      discountPercent: field === "discountPercent" ? value : line.discountPercent,
      discountAmount: calc.discountAmount,
      lineTotal: calc.lineTotal,
      vatAmount: calc.vatAmount
    };
    setLines(updated);
  };

  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    if (!customerId) {
      toast.error(language === "ar" ? "برجاء اختيار عميل معتمد" : "Please select a client first");
      return;
    }

    if (lines.some(l => !l.name?.trim())) {
      toast.error(language === "ar" ? "يرجى إدخال اسم المنتج/الخدمة في كل سطر" : "Please enter a product/service name for all lines");
      return;
    }

    setLoading(true);
    try {
      const parentCustomer = customers.find(c => c.id === customerId);

      const draftInvoice = {
        invoiceNumber,
        type,
        status: InvoiceStatus.APPROVED,
        customerId,
        projectId: projectId || null,
        projectName: projects.find(p => p.id === projectId)?.name || null,
        customerName: parentCustomer?.name || "Consumer Client",
        customerNameAr: parentCustomer?.nameAr || "عميل بيع مبسط",
        customerVatNumber: parentCustomer?.vatNumber || "",
        customerAddress: parentCustomer?.address || "",
        issueDate,
        dueDate,
        supplyDate,
        lineItems: lines,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        vatBreakdown: totals.vatBreakdown,
        totalVat: totals.totalVat,
        grandTotal: totals.grandTotal,
        currency: "SAR",
        zatcaPhase: currentCompany.zatcaPhase,
        zatcaStatus: ZatcaStatus.NOT_SUBMITTED,
        paymentStatus: "unpaid" as const,
        amountPaid: 0,
        amountDue: totals.grandTotal,
        notes,
        notesAr,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 1. ZATCA Phase Processing Simulation
      let complianceResult: any;
      if (currentCompany.zatcaPhase === 2) {
        // Phase 2 clearance endpoint
        const phase1Res = await processPhase1Invoice(draftInvoice, currentCompany, parentCustomer);
        const phase2Res = await processPhase2Invoice(draftInvoice, currentCompany, parentCustomer, phase1Res);
        complianceResult = {
          ...phase1Res,
          zatcaStatus: phase2Res.zatcaStatus,
          xml: phase2Res.xml
        };
      } else {
        // Phase 1 offline QR TLV
        complianceResult = await processPhase1Invoice(draftInvoice, currentCompany, parentCustomer);
      }

      const finalInvoice = {
        ...draftInvoice,
        zatcaUUID: complianceResult.uuid,
        zatcaHash: complianceResult.hash,
        zatcaQRCode: complianceResult.tlvBase64,
        zatcaXML: complianceResult.xml,
        zatcaStatus: complianceResult.zatcaStatus as ZatcaStatus,
        status: complianceResult.zatcaStatus === "cleared" || complianceResult.zatcaStatus === "reported" ? InvoiceStatus.APPROVED : InvoiceStatus.PENDING
      };

      const invoiceId = "inv_" + Math.random().toString(36).substr(2, 9);
      await saveInvoice(currentCompany.id, invoiceId, finalInvoice);

      // 2. Reduce Stock Quantity Deductions on matching trackInventory items
      for (const line of lines) {
        const prod = products.find(p => p.id === line.productId);
        if (prod && prod.trackInventory) {
          const newQty = Math.max(0, prod.stockQty - line.qty);
          await updateDocument(`companies/${currentCompany.id}/products`, prod.id, {
            stockQty: newQty
          });
        }
      }

      // 3. Update company's latest invoice hash for chaining security
      await updateDocument("companies", currentCompany.id, {
        lastInvoiceHash: complianceResult.hash
      });

      toast.success(language === "ar" ? "تم توليد واعتماد الفاتورة وتوقيعها مشفراً بنجاح! ✅" : "E-invoice signed and clearing pipeline completed! ✅");
      navigate("/invoices");

    } catch (err: any) {
      console.error(err);
      toast.error(language === "ar" ? "فشل تجميع الفاتورة وحفظها" : "Error saving compiled billing logs");
    } finally {
      setLoading(false);
    }
  };

  if (setupLoading) {
    return <div className="h-48 flex items-center justify-center">Loading registry configuration...</div>;
  }

  return (
    <form onSubmit={handleSubmitInvoice} className="flex flex-col gap-6 font-sans select-none pb-12">
      
      {/* Top Banner Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1 text-slate-500 hover:bg-slate-100 rounded">
            <ArrowLeft className="h-5 w-5 rtl:rotate-180" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{language === "ar" ? "إنشاء فاتورة إلكترونية معتمدة" : "Generate Approved E-Invoice"}</h2>
            <p className="text-xs text-slate-400">ZATCA XML generator & ECC Web-signing pipeline.</p>
          </div>
        </div>

        <Button type="submit" loading={loading} variant="success" className="flex items-center gap-2 px-6">
          <Save className="h-4 w-4" />
          {language === "ar" ? "تعدين الفاتورة وتوقيعها" : "Sign & Clear"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Core Metadata Form */}
        <div className="lg:col-span-2 flex flex-col gap-5 bg-white border border-slate-200 p-5 rounded-lg shadow-xs">
          <h3 className="font-bold text-slate-750 text-xs text-slate-500 pb-2 border-b">1. {language === "ar" ? "البيانات الأساسية وتفاصيل الإصدار" : "E-Invoice Basic Descriptors"}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={language === "ar" ? "رقم الفاتورة التلقائي" : "Auto-Generated Invoice Number"}
              value={invoiceNumber}
              disabled
              className="bg-slate-50 text-slate-500"
            />
            <Select
              label={language === "ar" ? "نوع الفاتورة" : "ZATCA Invoice Subtype"}
              options={[
                { value: InvoiceType.SIMPLIFIED, label: language === "ar" ? "فاتورة ضريبية مبسطة (B2C)" : "Simplified Tax Invoice (B2C)" },
                { value: InvoiceType.STANDARD, label: language === "ar" ? "فاتورة ضريبية أساسية (B2B)" : "Standard Tax Invoice (B2B)" }
              ]}
              value={type}
              onChange={(e) => setType(e.target.value as InvoiceType)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label={t("invoice.issueDate")}
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
            <Input
              label={t("invoice.dueDate")}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <Input
              label={language === "ar" ? "تاريخ التوريد الفعلي" : "Required Supply Date"}
              type="date"
              value={supplyDate}
              onChange={(e) => setSupplyDate(e.target.value)}
            />
          </div>

          <div className="relative">
            <ClientSelector
              label={language === "ar" ? "اختيار العميل المستلم" : "Customer / Contact Directory Selector"}
              value={customerId ? { clientId: customerId } : undefined}
              onChange={(sel: ClientSelection) => setCustomerId(sel.clientId)}
              onClear={() => setCustomerId("")}
              required
            />
          </div>
          <Select
            label={language === "ar" ? "ربط بمشروع (اختياري)" : "Link to Project (optional)"}
            options={[{ value: "", label: language === "ar" ? "بدون مشروع" : "No project" }, ...projects.map(p => ({ value: p.id, label: p.name }))]}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </div>

        {/* Notes column */}
        <div className="flex flex-col gap-4 bg-white border border-slate-200 p-5 rounded-lg shadow-xs h-full">
          <h3 className="font-bold text-slate-750 text-xs text-slate-500 pb-2 border-b">2. {language === "ar" ? "شروط وتوضيحات الفاتورة" : "Terms & Notes"}</h3>
          <Input
            label={language === "ar" ? "الملاحظات والشروط (عربي)" : "Conditions in Arabic"}
            placeholder="..."
            value={notesAr}
            onChange={(e) => setNotesAr(e.target.value)}
          />
          <Input
            label={language === "ar" ? "الملاحظات والشروط (إنجليزي)" : "Conditions in English"}
            placeholder="..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* LINE ITEM INTERACTIVE GRID */}
      <div className="bg-white border border-slate-200 p-5 rounded-lg shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h3 className="font-bold text-slate-750 text-xs text-slate-500">3. {language === "ar" ? "سطور وأصناف المبيعات" : "Tax Invoice Line Breakdown"}</h3>
          <Button variant="secondary" size="sm" type="button" onClick={handleAddLine} className="flex items-center gap-1.5 bg-slate-50">
            <Plus className="h-4 w-4" />
            {t("invoice.addLine")}
          </Button>
        </div>

        <div className="overflow-x-auto min-w-full">
          <table className="w-full text-right rtl:text-right ltr:text-left text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b">
                <th className="px-3 py-2 w-1/3">{t("invoice.product")}</th>
                <th className="px-3 py-2">{t("invoice.qty")}</th>
                <th className="px-3 py-2">{t("invoice.price")}</th>
                <th className="px-3 py-2">{t("invoice.discountPct")}</th>
                <th className="px-3 py-2">{t("invoice.vat")}</th>
                <th className="px-3 py-2">{t("invoice.total")}</th>
                <th className="px-3 py-2 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      {/* Mode toggle */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { if ((lineModes[idx]||"select") !== "select") toggleLineMode(idx); }}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${(lineModes[idx]||"select") === "select" ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >
                          <List className="h-2.5 w-2.5" />
                          {language === "ar" ? "قائمة" : "List"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { if ((lineModes[idx]||"select") !== "manual") toggleLineMode(idx); }}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${(lineModes[idx]||"select") === "manual" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                        >
                          <Pencil className="h-2.5 w-2.5" />
                          {language === "ar" ? "يدوي" : "Manual"}
                        </button>
                      </div>

                      {/* Select mode */}
                      {(lineModes[idx]||"select") === "select" && (
                        <Select
                          options={[
                            { value: "", label: language === "ar" ? "— اختر منتجاً —" : "— Select product —" },
                            ...products.map(p => ({ value: p.id, label: language === "ar" ? (p.nameAr||p.name) : p.name }))
                          ]}
                          value={line.productId}
                          onChange={(e) => handleProductSelect(idx, e.target.value)}
                          className="py-1 px-2 border-slate-250 text-xs"
                        />
                      )}

                      {/* Manual mode */}
                      {(lineModes[idx]||"select") === "manual" && (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            placeholder={language === "ar" ? "اسم المنتج/الخدمة" : "Product / Service name"}
                            className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:border-emerald-400"
                            value={line.name}
                            onChange={e => handleManualFieldChange(idx, "name", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder={language === "ar" ? "الاسم بالعربي (اختياري)" : "Arabic name (optional)"}
                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-400 text-right"
                            value={line.nameAr||""}
                            onChange={e => handleManualFieldChange(idx, "nameAr", e.target.value)}
                            dir="rtl"
                          />
                          <div className="flex items-center gap-1">
                            <select
                              className="flex-1 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-400"
                              value={line.unit||"PCE"}
                              onChange={e => handleManualFieldChange(idx, "unit", e.target.value)}
                            >
                              {["PCE","KG","LTR","MTR","HR","DAY","SRV","SET","BOX","TON","M2","M3"].map(u => (
                                <option key={u} value={u}>{u}</option>
                              ))}
                            </select>
                            <select
                              className="w-16 px-1.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-emerald-400"
                              value={line.vatRate}
                              onChange={e => handleManualFieldChange(idx, "vatRate", Number(e.target.value))}
                            >
                              <option value={0}>0%</option>
                              <option value={5}>5%</option>
                              <option value={15}>15%</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 w-24">
                    <input
                      type="number"
                      className="w-full px-2 py-1 text-xs border border-slate-350 rounded"
                      value={line.qty}
                      min={1}
                      onChange={(e) => handleLineValueChange(idx, "qty", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2.5 w-28">
                    <input
                      type="number"
                      className="w-full px-2 py-1 text-xs border border-slate-350 rounded"
                      value={line.unitPrice}
                      onChange={(e) => handleLineValueChange(idx, "unitPrice", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2.5 w-24">
                    <input
                      type="number"
                      className="w-full px-2 py-1 text-xs border border-slate-350 rounded"
                      value={line.discountPercent}
                      min={0}
                      max={100}
                      onChange={(e) => handleLineValueChange(idx, "discountPercent", Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-slate-500 font-semibold">% {line.vatRate}</span>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-800">
                    SAR {line.lineTotal.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteLine(idx)}
                      disabled={lines.length === 1}
                      className="p-1 text-slate-400 hover:text-brand-danger disabled:opacity-30 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* BOTTOM TOTALS AREA */}
        <div className="flex flex-col md:flex-row items-stretch md:items-start justify-between border-t pt-4 gap-6">
          <div className="max-w-md bg-blue-50/50 rounded-lg p-4 border border-blue-100 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-slate-800">ZATCA Cryptographic Validation Guarantee</p>
              <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                Safqa compiles e-invoice fields directly into OASIS Universal Business Language format. This XML guarantees passing all sandbox checks automatically.
              </p>
            </div>
          </div>

          <div className="w-full md:max-w-xs flex flex-col gap-2.5 text-right font-medium">
            <div className="flex justify-between text-xs text-slate-500">
              <span>{t("invoice.subtotal")}:</span>
              <span>SAR {totals.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-550 border-b pb-2">
              <span>{t("invoice.totalDiscount")}:</span>
              <span>SAR {totals.totalDiscount.toFixed(2)}</span>
            </div>
            
            {/* VAT breakdowns rendering */}
            {totals.vatBreakdown.map((b, idx) => (
              <div key={idx} className="flex justify-between text-xs text-slate-500">
                <span>{language === "ar" ? `الضريبة (${b.rate}%)` : `VAT (${b.rate}%)`}:</span>
                <span>SAR {b.amount.toFixed(2)}</span>
              </div>
            ))}

            <div className="flex justify-between text-sm font-bold text-slate-900 border-t pt-2 gap-4">
              <span>{t("invoice.grandTotal")}:</span>
              <span>SAR {totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

    </form>
  );
};
export default NewInvoicePage;
