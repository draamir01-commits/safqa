import * as React from "react";
import { Plus, Eye, ShoppingCart, CheckCircle, XCircle, Trash2, Package, Printer, List, Pencil, FileText, X, Paperclip} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { AttachmentUploader } from "../../components/ui/AttachmentUploader";
import { DocumentViewer } from "../../components/ui/DocumentViewer";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import { calculateLineItem, calculateTotals } from "../../utils/vatCalculator";
import { PurchaseOrder, POStatus, CustomerOrSupplier, Product, LineItem } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

const statusColor: Record<POStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  received: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

export const PurchaseOrdersPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = React.useState<CustomerOrSupplier[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [attachments, setAttachments] = React.useState<string[]>([]);
  const [viewingDoc, setViewingDoc] = React.useState<{ url: string; fileName: string } | null>(null);


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
  const [showForm, setShowForm] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selected, setSelected] = React.useState<PurchaseOrder | null>(null);

  const [supplierId, setSupplierId] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = React.useState(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<LineItem[]>([
    { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }
  ]);
  // per-line mode: "select" = pick from products list, "manual" = free text
  const [lineModes, setLineModes] = React.useState<("select"|"manual")[]>(["select"]);
  // per-line custom unit text (when user types a custom unit)
  const [lineUnits, setLineUnits] = React.useState<string[]>(["PCE"]);

  const PRESET_UNITS = ["PCE","KG","LTR","MTR","HR","DAY","SRV","SET","BOX","TON","M2","M3","NOS","LS"];

  const toggleLineMode = (idx: number) => {
    setLineModes(prev => { const n=[...prev]; n[idx]=n[idx]==="select"?"manual":"select"; return n; });
    setLines(prev => { const u=[...prev]; u[idx]={...u[idx],productId:"",name:"",nameAr:""}; return u; });
  };

  const setLineUnit = (idx: number, val: string) => {
    setLineUnits(prev => { const u=[...prev]; u[idx]=val; return u; });
    setLines(prev => { const u=[...prev]; u[idx]={...u[idx],unit:val}; return u; });
  };

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "purchaseOrders", (d) => setOrders((d as PurchaseOrder[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "suppliers", (d) => setSuppliers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "products", (d) => setProducts(d as Product[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const totals = React.useMemo(() => calculateTotals(lines), [lines]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "productId") {
      const p = products.find(pr => pr.id === value);
      if (p) {
        updated[idx].name = p.name;
        updated[idx].nameAr = p.nameAr;
        updated[idx].unitPrice = p.costPrice || p.salePrice;
        updated[idx].vatRate = p.vatRate;
        const pu = p.unit || "PCE";
        updated[idx].unit = pu;
        setLineUnits(prev => { const u=[...prev]; u[idx]=pu; return u; });
      }
    }
    updated[idx] = calculateLineItem(updated[idx]);
    setLines(updated);
  };

  const handleAddLine = () => {
    setLines(prev => [...prev, { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }]);
    setLineModes(prev => [...prev, "select"]);
    setLineUnits(prev => [...prev, "PCE"]);
  };

  const handleDeleteLine = (idx: number) => {
    setLines(prev => prev.filter((_, i) => i !== idx));
    setLineModes(prev => prev.filter((_, i) => i !== idx));
    setLineUnits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!supplierId || !currentCompany || !user) return toast.error(language === "ar" ? "الرجاء اختيار المورد" : "Please select a supplier");
    setLoading(true);
    try {
      const supplier = suppliers.find(s => s.id === supplierId)!;
      const poNum = "PO-" + Date.now().toString().slice(-6);
      await addDocument(`companies/${currentCompany.id}/purchaseOrders`, {
        poNumber: poNum,
        supplierId, supplierName: supplier.name, supplierNameAr: supplier.nameAr,
        issueDate, expectedDate, status: "draft",
        lineItems: lines, ...totals,
        currency: "SAR", notes,
        createdBy: user.uid, createdAt: new Date(), updatedAt: new Date(),
        attachments,
      });
      toast.success(language === "ar" ? "تم إنشاء أمر الشراء" : "Purchase order created");
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (po: PurchaseOrder, status: POStatus) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/purchaseOrders`, po.id, { status, updatedAt: new Date() });
    toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/purchaseOrders`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const resetForm = () => {
    setSupplierId(""); setNotes(""); setAttachments([]);
    setLines([{ productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }]);
    setLineModes(["select"]);
    setLineUnits(["PCE"]);
  };

  const statusLabel = (s: POStatus) => {
    const map: Record<POStatus, [string, string]> = {
      draft: ["مسودة", "Draft"], sent: ["مرسل", "Sent"], approved: ["موافق عليه", "Approved"],
      received: ["مستلم", "Received"], cancelled: ["ملغي", "Cancelled"]
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "أوامر الشراء" : "Purchase Orders"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "إدارة أوامر الشراء من الموردين" : "Manage purchase orders from suppliers"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={orders} filename="purchase-orders" headers={{ poNumber: "PO Number", supplierName: "Supplier", grandTotal: "Total", status: "Status" }} />

          <button
            onClick={openExportPanel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "أمر شراء جديد" : "New Purchase Order"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(["draft","sent","approved","received","cancelled"] as POStatus[]).map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{statusLabel(s)}</p>
            <p className="text-2xl font-bold text-slate-800">{orders.filter(o => o.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "رقم الأمر" : "PO Number",
                language === "ar" ? "المورد" : "Supplier",
                language === "ar" ? "تاريخ الإصدار" : "Issue Date",
                language === "ar" ? "تاريخ التسليم" : "Expected",
                language === "ar" ? "الإجمالي" : "Total",
                language === "ar" ? "الحالة" : "Status",
                language === "ar" ? "إجراءات" : "Actions",
              ].map((h, i) => <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد أوامر شراء" : "No purchase orders yet"}</td></tr>
            ) : orders.map(po => (
              <tr key={po.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-brand-primary font-semibold">{po.poNumber}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{language === "ar" ? po.supplierNameAr || po.supplierName : po.supplierName}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{po.issueDate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{po.expectedDate}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(po.grandTotal, language)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[po.status]}`}>{statusLabel(po.status)}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelected(po); setShowPreview(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded"><Eye className="h-4 w-4" /></button>
                    {po.status === "draft" && <button onClick={() => handleStatusChange(po, "sent")} className="p-1 text-slate-400 hover:text-blue-600 rounded" title={language === "ar" ? "إرسال" : "Send"}><Package className="h-4 w-4" /></button>}
                    {po.status === "sent" && <button onClick={() => handleStatusChange(po, "approved")} className="p-1 text-slate-400 hover:text-emerald-600 rounded"><CheckCircle className="h-4 w-4" /></button>}
                    {po.status === "approved" && <button onClick={() => handleStatusChange(po, "received")} className="p-1 text-slate-400 hover:text-purple-600 rounded" title={language === "ar" ? "تأكيد الاستلام" : "Mark Received"}><CheckCircle className="h-4 w-4" /></button>}
                    {(po.status === "draft" || po.status === "sent") && <button onClick={() => handleStatusChange(po, "cancelled")} className="p-1 text-slate-400 hover:text-red-500 rounded"><XCircle className="h-4 w-4" /></button>}
                    <button onClick={() => handleDelete(po.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New PO Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={language === "ar" ? "أمر شراء جديد" : "New Purchase Order"}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={language === "ar" ? "المورد" : "Supplier"} value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "اختر مورد..." : "Select supplier..." }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
            <Input label={language === "ar" ? "تاريخ الإصدار" : "Issue Date"} type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            <Input label={language === "ar" ? "تاريخ التسليم المتوقع" : "Expected Delivery"} type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
            <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "البنود" : "Line Items"}</span>
              <button type="button" onClick={handleAddLine}
                className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> {language === "ar" ? "إضافة بند" : "Add Line"}
              </button>
            </div>

            {lines.map((line, idx) => {
              const mode = lineModes[idx] || "select";
              const currentUnit = lineUnits[idx] || line.unit || "PCE";
              const isCustomUnit = !PRESET_UNITS.includes(currentUnit);
              return (
                <div key={idx} className="p-3 border-b border-slate-100 last:border-0 space-y-2">
                  {/* Row 1: mode toggle + product/name */}
                  <div className="flex items-start gap-2">
                    {/* Mode toggle */}
                    <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                      <button type="button" onClick={() => { if (mode !== "select") toggleLineMode(idx); }}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${mode === "select" ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        <List className="h-2.5 w-2.5" />{language === "ar" ? "قائمة" : "List"}
                      </button>
                      <button type="button" onClick={() => { if (mode !== "manual") toggleLineMode(idx); }}
                        className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${mode === "manual" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                        <Pencil className="h-2.5 w-2.5" />{language === "ar" ? "يدوي" : "Manual"}
                      </button>
                    </div>

                    {/* Product / name */}
                    <div className="flex-1 min-w-0">
                      {mode === "select" ? (
                        <select value={line.productId} onChange={e => updateLine(idx, "productId", e.target.value)}
                          className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-brand-primary">
                          <option value="">{language === "ar" ? "— اختر منتجاً —" : "— Select product —"}</option>
                          {products.map(p => <option key={p.id} value={p.id}>{language === "ar" ? (p.nameAr||p.name) : p.name}</option>)}
                        </select>
                      ) : (
                        <div className="space-y-1">
                          <input value={line.name} onChange={e => updateLine(idx, "name", e.target.value)}
                            placeholder={language === "ar" ? "اسم المنتج / الخدمة" : "Product / Service name"}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400" />
                          <input value={line.nameAr || ""} onChange={e => updateLine(idx, "nameAr", e.target.value)}
                            placeholder={language === "ar" ? "الاسم بالعربي (اختياري)" : "Arabic name (optional)"}
                            className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-emerald-400" dir="rtl" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Qty | Unit | Price | VAT% | Total | Delete */}
                  <div className="grid grid-cols-12 gap-2 items-end pl-16">
                    {/* Qty */}
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 mb-0.5">{language === "ar" ? "الكمية" : "Qty"}</p>
                      <input type="number" value={line.qty} min={1}
                        onChange={e => updateLine(idx, "qty", +e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                    </div>

                    {/* Unit — preset dropdown + custom text */}
                    <div className="col-span-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">{language === "ar" ? "الوحدة" : "Unit"}</p>
                      {isCustomUnit ? (
                        <div className="flex gap-1">
                          <input value={currentUnit}
                            onChange={e => setLineUnit(idx, e.target.value)}
                            placeholder="e.g. m/roll"
                            className="flex-1 min-w-0 text-xs border border-emerald-300 rounded px-2 py-1.5 focus:outline-none" />
                          <button type="button" onClick={() => setLineUnit(idx, "PCE")}
                            className="text-[10px] text-slate-400 hover:text-slate-600 px-1" title="Reset">↩</button>
                        </div>
                      ) : (
                        <select value={currentUnit}
                          onChange={e => {
                            if (e.target.value === "__custom__") {
                              setLineUnit(idx, "");
                            } else {
                              setLineUnit(idx, e.target.value);
                            }
                          }}
                          className="w-full text-xs border border-slate-200 rounded px-1.5 py-1.5 focus:outline-none">
                          {PRESET_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          <option value="__custom__">✏ Custom...</option>
                        </select>
                      )}
                    </div>

                    {/* Unit Price */}
                    <div className="col-span-3">
                      <p className="text-[10px] text-slate-400 mb-0.5">{language === "ar" ? "السعر" : "Unit Price"}</p>
                      <input type="number" value={line.unitPrice} min={0} step={0.01}
                        onChange={e => updateLine(idx, "unitPrice", +e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                    </div>

                    {/* VAT */}
                    <div className="col-span-2">
                      <p className="text-[10px] text-slate-400 mb-0.5">VAT %</p>
                      <select value={line.vatRate} onChange={e => updateLine(idx, "vatRate", +e.target.value)}
                        className="w-full text-xs border border-slate-200 rounded px-1.5 py-1.5 focus:outline-none">
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={15}>15%</option>
                      </select>
                    </div>

                    {/* Total + delete */}
                    <div className="col-span-2 flex items-end gap-1 pb-0.5">
                      <span className="text-xs font-bold text-slate-800 flex-1 text-right">{formatCurrency(line.lineTotal, language)}</span>
                      {lines.length > 1 && (
                        <button type="button" onClick={() => handleDeleteLine(idx)}
                          className="text-red-400 hover:text-red-600 shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "المجموع الفرعي" : "Subtotal"}</span><span>{formatCurrency(totals.subtotal, language)}</span></div>
            <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</span><span>{formatCurrency(totals.totalVat, language)}</span></div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1"><span>{language === "ar" ? "الإجمالي" : "Total"}</span><span>{formatCurrency(totals.grandTotal, language)}</span></div>
          </div>
          <AttachmentUploader folder="purchase-orders" attachments={attachments} onChange={setAttachments} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ أمر الشراء" : "Save Purchase Order"}</Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}
        title={`${language === "ar" ? "أمر الشراء" : "Purchase Order"} ${selected?.poNumber || ""}`}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "المورد" : "Supplier"}</span><p className="font-semibold">{language === "ar" ? selected.supplierNameAr : selected.supplierName}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "الحالة" : "Status"}</span><p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[selected.status]}`}>{statusLabel(selected.status)}</span></p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ الإصدار" : "Issued"}</span><p>{selected.issueDate}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ التسليم" : "Expected"}</span><p>{selected.expectedDate}</p></div>
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50"><tr>
                <th className="px-3 py-2 text-start">{language === "ar" ? "المنتج" : "Item"}</th>
                <th className="px-3 py-2 text-center">{language === "ar" ? "الكمية" : "Qty"}</th>
                <th className="px-3 py-2 text-end">{language === "ar" ? "السعر" : "Price"}</th>
                <th className="px-3 py-2 text-end">{language === "ar" ? "الإجمالي" : "Total"}</th>
              </tr></thead>
              <tbody>{selected.lineItems.map((l, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">{language === "ar" ? l.nameAr || l.name : l.name}</td>
                  <td className="px-3 py-2 text-center">{l.qty}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(l.unitPrice, language)}</td>
                  <td className="px-3 py-2 text-end font-semibold">{formatCurrency(l.lineTotal, language)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="bg-slate-50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-slate-600 text-xs"><span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</span><span>{formatCurrency(selected.totalVat, language)}</span></div>
              <div className="flex justify-between font-bold text-slate-800"><span>{language === "ar" ? "الإجمالي" : "Total"}</span><span>{formatCurrency(selected.grandTotal, language)}</span></div>
            </div>
          </div>
        )}
      </Modal>


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "أوامر الشراء" : "Purchase Orders"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Purchase Orders</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    const rows = (orders as any[]).map((row: any, i: number) => {
                      const cells = [String(row.poNumber||""), String(row.supplierName||""), String(row.grandTotal||""), String(row.status||"")];
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">` + cells.map(v=>`<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${v}</td>`).join("") + "</tr>";
                    }).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      "<title>Purchase Orders</title>",
                      "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      "<div style='text-align:center;margin:8px 0 12px'>",
                      "<span style='font-size:18pt;font-weight:800'>Purchase Orders</span>",
                      "</div>",
                      "<div style='border-top:2px solid #e2e8f0;margin-bottom:12px'></div>",
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:12px'>",
                      "<thead><tr style='background:#2d3748;color:#fff'>",
                      "<th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">PO #</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Supplier</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Total</th><th style=\"padding:6px 10px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt\">Status</th>",
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

      <DocumentViewer
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        url={viewingDoc?.url || null}
        fileName={viewingDoc?.fileName}
      />

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "أوامر الشراء" : "Purchase Orders"}
        itemCount={orders?.length}
      />
    </div>
  );
};
export default PurchaseOrdersPage;
