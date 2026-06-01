import * as React from "react";
import { Plus, Eye, Truck, CheckCircle, Trash2, FileText, Printer, X, List, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { DeliveryNote, CustomerOrSupplier, Invoice } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  dispatched: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  returned: "bg-red-100 text-red-700",
};

export const DeliveryNotesPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [notes, setNotes] = React.useState<DeliveryNote[]>([]);
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selected, setSelected] = React.useState<DeliveryNote | null>(null);

  // Export panel state
  const [showExportPanel, setShowExportPanel] = React.useState(false);
  const [exportingDN, setExportingDN] = React.useState<DeliveryNote | null>(null);
  const [expLHMode, setExpLHMode] = React.useState<"none"|"header"|"full">("none");
  const [expLHId, setExpLHId] = React.useState("primary");
  const [expLogo, setExpLogo] = React.useState(true);
  const [expStamp, setExpStamp] = React.useState(false);
  const [expSigId, setExpSigId] = React.useState("");
  const [expIncludeSig, setExpIncludeSig] = React.useState(false);
  const [expSignatories, setExpSignatories] = React.useState<any[]>([]);
  const [expLetterheads, setExpLetterheads] = React.useState<any[]>([]);
  const [expGenerating, setExpGenerating] = React.useState(false);

  const openExportPanel = (dn: DeliveryNote) => {
    const co = currentCompany as any;
    setExportingDN(dn);
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

  const [customerId, setCustomerId] = React.useState("");
  const [invoiceId, setInvoiceId] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [formNotes, setFormNotes] = React.useState("");
  const [items, setItems] = React.useState([{ name: "", nameAr: "", qty: 1, unit: "PCE" }]);

  const [products2, setProducts2] = React.useState<any[]>([]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "deliveryNotes", (d) => setNotes((d as DeliveryNote[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "customers", (d) => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "invoices", (d) => setInvoices(d as Invoice[]));
    const u4 = listenCompanyCollection(currentCompany.id, "products", (d) => setProducts2(d));
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentCompany]);

  // Auto-fill items from invoice
  React.useEffect(() => {
    if (!invoiceId) return;
    const inv = invoices.find(i => i.id === invoiceId);
    if (inv) {
      setCustomerId(inv.customerId);
      setItems(inv.lineItems.map(l => ({ name: l.name, nameAr: l.nameAr, qty: l.qty, unit: l.unit || "PCE" })));
    }
  }, [invoiceId, invoices]);

  const handleSave = async () => {
    if (!customerId || !currentCompany || !user) return toast.error(language === "ar" ? "اختر عميلاً" : "Select a customer");
    setLoading(true);
    try {
      const customer = customers.find(c => c.id === customerId)!;
      const inv = invoices.find(i => i.id === invoiceId);
      const dnNum = "DN-" + Date.now().toString().slice(-6);
      await addDocument(`companies/${currentCompany.id}/deliveryNotes`, {
        dnNumber: dnNum, customerId,
        customerName: customer.name, customerNameAr: customer.nameAr,
        invoiceId: invoiceId || null,
        invoiceNumber: inv?.invoiceNumber || null,
        deliveryDate, status: "draft",
        items, deliveryAddress, driverName,
        notes: formNotes,
        createdBy: user.uid, createdAt: new Date(), updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم إنشاء مذكرة التسليم" : "Delivery note created");
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (dn: DeliveryNote, status: string) => {
    if (!currentCompany) return;
    const update: any = { status, updatedAt: new Date() };
    if (status === "delivered") update.signedAt = new Date().toISOString();
    await updateDocument(`companies/${currentCompany.id}/deliveryNotes`, dn.id, update);
    toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/deliveryNotes`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const resetForm = () => {
    setCustomerId(""); setInvoiceId(""); setDeliveryAddress(""); setDriverName(""); setFormNotes("");
    setItems([{ name: "", nameAr: "", qty: 1, unit: "PCE" }]);
  };

  const statusLabel = (s: string) => {
    const map: Record<string, [string, string]> = {
      draft: ["مسودة", "Draft"], dispatched: ["تم الشحن", "Dispatched"],
      delivered: ["تم التسليم", "Delivered"], returned: ["مرتجع", "Returned"]
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Truck className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "مذكرات التسليم" : "Delivery Notes"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "إدارة وتتبع عمليات التسليم" : "Manage and track deliveries"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={notes} filename="delivery-notes" headers={{ dnNumber: "DN Number", customerName: "Customer", invoiceNumber: "Invoice", deliveryDate: "Date", driverName: "Driver", status: "Status" }} />
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "طباعة" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "مذكرة جديدة" : "New Delivery Note"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["draft", "dispatched", "delivered", "returned"].map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{statusLabel(s)}</p>
            <p className="text-2xl font-bold text-slate-800">{notes.filter(n => n.status === s).length}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[language === "ar" ? "رقم المذكرة" : "DN Number",
                language === "ar" ? "العميل" : "Customer",
                language === "ar" ? "الفاتورة" : "Invoice",
                language === "ar" ? "تاريخ التسليم" : "Delivery Date",
                language === "ar" ? "السائق" : "Driver",
                language === "ar" ? "الحالة" : "Status",
                language === "ar" ? "إجراءات" : "Actions",
              ].map((h, i) => <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notes.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد مذكرات تسليم" : "No delivery notes yet"}</td></tr>
            ) : notes.map(dn => (
              <tr key={dn.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-brand-primary font-semibold">{dn.dnNumber}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{language === "ar" ? dn.customerNameAr || dn.customerName : dn.customerName}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{dn.invoiceNumber || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{dn.deliveryDate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{dn.driverName || "—"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[dn.status]}`}>{statusLabel(dn.status)}</span></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelected(dn); setShowPreview(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded" title={language === "ar" ? "معاينة" : "View"}><Eye className="h-4 w-4" /></button>
                    <button onClick={() => openExportPanel(dn)} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title={language === "ar" ? "طباعة / PDF" : "Print / Export PDF"}><Printer className="h-4 w-4" /></button>
                    {dn.status === "draft" && <button onClick={() => handleStatusChange(dn, "dispatched")} className="p-1 text-slate-400 hover:text-blue-600 rounded" title={language === "ar" ? "شحن" : "Dispatch"}><Truck className="h-4 w-4" /></button>}
                    {dn.status === "dispatched" && <button onClick={() => handleStatusChange(dn, "delivered")} className="p-1 text-slate-400 hover:text-emerald-600 rounded" title={language === "ar" ? "تأكيد التسليم" : "Confirm Delivery"}><CheckCircle className="h-4 w-4" /></button>}
                    <button onClick={() => handleDelete(dn.id)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New DN Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={language === "ar" ? "مذكرة تسليم جديدة" : "New Delivery Note"}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={language === "ar" ? "ربط بفاتورة (اختياري)" : "Link to Invoice (optional)"} value={invoiceId}
              onChange={e => setInvoiceId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "بدون فاتورة" : "No invoice" }, ...invoices.map(i => ({ value: i.id, label: i.invoiceNumber }))]} />
            <Select label={language === "ar" ? "العميل" : "Customer"} value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "اختر عميل..." : "Select customer..." }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
            <Input label={language === "ar" ? "تاريخ التسليم" : "Delivery Date"} type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
            <Input label={language === "ar" ? "اسم السائق" : "Driver Name"} value={driverName} onChange={e => setDriverName(e.target.value)} placeholder={language === "ar" ? "اختياري" : "Optional"} />
            <Input label={language === "ar" ? "عنوان التسليم" : "Delivery Address"} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="md:col-span-2" />
          </div>

          {/* Items table — select from products OR type manually */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "البنود" : "Items"}</span>
              <button type="button" onClick={() => setItems([...items, { name: "", nameAr: "", qty: 1, unit: "PCE", _mode: "manual" as any }])}
                className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> {language === "ar" ? "إضافة" : "Add"}</button>
            </div>
            {items.map((item, idx) => {
              const mode = (item as any)._mode || "manual";
              return (
              <div key={idx} className="grid grid-cols-12 gap-2 p-3 border-b border-slate-100 last:border-0 items-start">
                {/* Product / description column */}
                <div className="col-span-6 flex flex-col gap-1.5">
                  {/* Mode toggle */}
                  <div className="flex items-center gap-1">
                    <button type="button"
                      onClick={() => { const u = [...items]; (u[idx] as any)._mode = "list"; u[idx].name = ""; setItems(u); }}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded ${mode === "list" ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      <List className="h-2.5 w-2.5" />{language === "ar" ? "قائمة" : "List"}
                    </button>
                    <button type="button"
                      onClick={() => { const u = [...items]; (u[idx] as any)._mode = "manual"; (u[idx] as any)._productId = ""; setItems(u); }}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded ${mode === "manual" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      <Pencil className="h-2.5 w-2.5" />{language === "ar" ? "يدوي" : "Manual"}
                    </button>
                  </div>
                  {mode === "list" ? (
                    <select className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none"
                      value={(item as any)._productId || ""}
                      onChange={e => {
                        const p = products2.find((pr: any) => pr.id === e.target.value);
                        const u = [...items];
                        u[idx] = { ...u[idx], name: p?.name || "", nameAr: p?.nameAr || "", unit: p?.unit || "PCE", _mode: "list" as any, _productId: e.target.value } as any;
                        setItems(u);
                      }}>
                      <option value="">{language === "ar" ? "— اختر منتجاً —" : "— Select product —"}</option>
                      {products2.map((p: any) => <option key={p.id} value={p.id}>{language === "ar" ? (p.nameAr||p.name) : p.name}</option>)}
                    </select>
                  ) : (
                    <>
                      <input value={item.name} onChange={e => { const u = [...items]; u[idx].name = e.target.value; setItems(u); }}
                        placeholder={language === "ar" ? "اسم البند / الخدمة" : "Item / service name"}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                      <input value={item.nameAr || ""} onChange={e => { const u = [...items]; (u[idx] as any).nameAr = e.target.value; setItems(u); }}
                        placeholder={language === "ar" ? "الاسم بالعربي (اختياري)" : "Arabic name (optional)"}
                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" dir="rtl" />
                    </>
                  )}
                </div>
                {/* Qty */}
                <div className="col-span-2">
                  <p className="text-[10px] text-slate-400 mb-1">{language === "ar" ? "الكمية" : "Qty"}</p>
                  <input type="number" value={item.qty} min={1}
                    onChange={e => { const u = [...items]; u[idx].qty = +e.target.value; setItems(u); }}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                </div>
                {/* Unit */}
                <div className="col-span-3">
                  <p className="text-[10px] text-slate-400 mb-1">{language === "ar" ? "الوحدة" : "Unit"}</p>
                  <select value={item.unit} onChange={e => { const u = [...items]; u[idx].unit = e.target.value; setItems(u); }}
                    className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none">
                    {["PCE","KG","LTR","MTR","HR","DAY","SRV","SET","BOX","TON","M2","M3"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                {/* Delete */}
                <div className="col-span-1 flex items-end pb-1.5 justify-center">
                  {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              );
            })}
          </div>

          <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={formNotes} onChange={e => setFormNotes(e.target.value)} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ المذكرة" : "Save Delivery Note"}</Button>
          </div>
        </div>
      </Modal>

      {/* Preview */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}
        title={`${language === "ar" ? "مذكرة التسليم" : "Delivery Note"} ${selected?.dnNumber || ""}`}
        footer={selected ? <button onClick={() => { setShowPreview(false); if (selected) openExportPanel(selected); }} className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-brand-primary text-white text-sm font-bold rounded-xl transition-colors"><Printer className="w-4 h-4" />{language === "ar" ? "طباعة / تصدير PDF" : "Print / Export PDF"}</button> : undefined}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "العميل" : "Customer"}</span><p className="font-semibold">{language === "ar" ? selected.customerNameAr : selected.customerName}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "الحالة" : "Status"}</span><p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[selected.status]}`}>{statusLabel(selected.status)}</span></p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ التسليم" : "Delivery Date"}</span><p>{selected.deliveryDate}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "السائق" : "Driver"}</span><p>{selected.driverName || "—"}</p></div>
              {selected.deliveryAddress && <div className="col-span-2"><span className="text-slate-500 text-xs">{language === "ar" ? "العنوان" : "Address"}</span><p>{selected.deliveryAddress}</p></div>}
              {selected.invoiceNumber && <div><span className="text-slate-500 text-xs">{language === "ar" ? "رقم الفاتورة" : "Invoice"}</span><p className="font-mono font-semibold text-brand-primary">{selected.invoiceNumber}</p></div>}
              {selected.signedAt && <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ التوقيع" : "Signed At"}</span><p>{new Date(selected.signedAt).toLocaleDateString()}</p></div>}
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50"><tr>
                <th className="px-3 py-2 text-start">{language === "ar" ? "البند" : "Item"}</th>
                <th className="px-3 py-2 text-center">{language === "ar" ? "الكمية" : "Qty"}</th>
                <th className="px-3 py-2 text-center">{language === "ar" ? "الوحدة" : "Unit"}</th>
              </tr></thead>
              <tbody>{selected.items.map((item, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-2">{language === "ar" ? item.nameAr || item.name : item.name}</td>
                  <td className="px-3 py-2 text-center">{item.qty}</td>
                  <td className="px-3 py-2 text-center">{item.unit}</td>
                </tr>
              ))}</tbody>
            </table>
            {selected.notes && <div className="bg-slate-50 rounded p-3 text-xs text-slate-600">{selected.notes}</div>}
          </div>
        )}
      </Modal>

      {/* Export Panel */}
      {showExportPanel && exportingDN && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "طباعة / تصدير PDF" : "Print / Export PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{exportingDN.dnNumber}</p>
              </div>
              <button onClick={() => setShowExportPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">
              {/* Letterhead Mode */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "الترويسة" : "Letterhead"}</p>
                <div className="space-y-2">
                  {([
                    { mode: "none",   icon: "⊘", labelEn: "No Letterhead",       descEn: "Plain text header" },
                    { mode: "header", icon: "▬", labelEn: "Header + Footer",      descEn: "Banner top & bottom" },
                    { mode: "full",   icon: "▮", labelEn: "Full Page Letterhead",  descEn: "Full A4 background" },
                  ] as const).map(opt => (
                    <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${expLHMode === opt.mode ? "border-brand-primary bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="radio" name="dnLHMode" checked={expLHMode === opt.mode} onChange={() => setExpLHMode(opt.mode)} className="mt-0.5 text-brand-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <span className="text-xs font-semibold text-slate-700">{opt.labelEn}</span>
                          {opt.mode === "full" && (currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-emerald-500 font-semibold">✓ A4</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.descEn}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {/* Logo & Stamp */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">Logo & Stamp</p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <span className="text-xs font-semibold text-slate-700">Include Logo</span>
                    <input type="checkbox" checked={expLogo} onChange={e => setExpLogo(e.target.checked)} disabled={!(currentCompany as any)?.logo} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <span className="text-xs font-semibold text-slate-700">Include Stamp</span>
                    <input type="checkbox" checked={expStamp} onChange={e => setExpStamp(e.target.checked)} disabled={!(currentCompany as any)?.stamp} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                </div>
              </div>
              {/* Signatory */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">Authorized Signatory</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={expSigId} onChange={e => setExpSigId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">None</option>
                    {expSignatories.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>
                  {expSigId && expSignatories.find((s: any) => s.id === expSigId)?.signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer mt-1">
                      <span className="text-xs text-slate-600">Include signature image</span>
                      <input type="checkbox" checked={expIncludeSig} onChange={e => setExpIncludeSig(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                disabled={expGenerating}
                onClick={async () => {
                  if (!exportingDN) return;
                  const win = window.open("", "_blank", "width=960,height=800");
                  if (!win) { toast.error("Please allow popups"); return; }
                  win.document.write("<html><body style='font-family:sans-serif;padding:40px;color:#555'>Generating...</body></html>");
                  setExpGenerating(true);
                  setShowExportPanel(false);
                  try {
                    const co = currentCompany as any;
                    const dn = exportingDN;
                    const selLH = expLetterheads.find((l: any) => l.id === expLHId) || expLetterheads[0];
                    const lhUrl = selLH?.url || co?.fullLetterhead || "";
                    const footerUrl = co?.footerAsset || co?.letterheadFooter || "";
                    const sigObj = expSignatories.find((s: any) => s.id === expSigId);
                    let padTop = "14mm", padBot = "20mm";
                    let headerHTML = "";
                    if (expLHMode === "full" && lhUrl) {
                      headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1"><img src="${lhUrl}" style="width:100%;height:100%;object-fit:fill"/></div>`;
                      padTop = "48mm";
                    } else if (expLHMode === "header" && lhUrl) {
                      headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;z-index:5;line-height:0"><img src="${lhUrl}" style="width:100%;max-height:50mm;object-fit:cover;display:block"/></div>`;
                      padTop = "55mm";
                    } else {
                      const leftLines = [co?.address, co?.city ? co.city+", KSA":"", co?.phone, co?.vatNumber ? "VAT: "+co.vatNumber:""].filter(Boolean).map((l: string)=>`<div style="font-size:7.5pt;color:#444;line-height:1.7">${l}</div>`).join("");
                      headerHTML = `<table style="width:100%;border-bottom:2px solid #e2e8f0;margin-bottom:10px;border-collapse:collapse"><tr><td style="width:40%;vertical-align:top;padding-bottom:8px"><div style="font-size:12pt;font-weight:700">${co?.name||""}</div>${leftLines}</td><td style="width:20%;text-align:center;vertical-align:middle">${expLogo && co?.logo ? `<img src="${co.logo}" style="max-height:50px;max-width:100px;object-fit:contain"/>` : ""}</td><td style="width:40%;text-align:right;vertical-align:top;padding-bottom:8px"><div style="font-family:Cairo,Arial,sans-serif;font-size:12pt;font-weight:700;direction:rtl">${co?.nameAr||co?.name||""}</div></td></tr></table>`;
                    }
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 0;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Page 1 of 1 - ${dn.dnNumber}</span><span>${dn.dnNumber}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 0;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${dn.dnNumber}</span></div><div style="line-height:0"><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div></div>`;
                      padBot = "32mm";
                    }
                    const itemRows = (dn.items||[]).map((it: any, i: number) => `<tr style="background:${i%2===0?"#fff":"#f8fafc"}"><td style="padding:6px 10px;border:0.5px solid #e2e8f0">${it.name||""}${it.nameAr?`<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#666;direction:rtl">${it.nameAr}</span>`:""}</td><td style="padding:6px 10px;border:0.5px solid #e2e8f0;text-align:center">${it.qty}</td><td style="padding:6px 10px;border:0.5px solid #e2e8f0;text-align:center">${it.unit||"PCE"}</td></tr>`).join("");
                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:4px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="flex-shrink:0;text-align:center"><img src="${co.stamp}" style="width:90px;height:90px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      `<title>${dn.dnNumber}</title>`,
                      `<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important}body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}</style>`,
                      "</head><body>",
                      headerHTML,
                      `<div style="text-align:center;margin:8px 0 12px"><span style="font-size:18pt;font-weight:800">Delivery Note / مذكرة تسليم</span></div>`,
                      `<div style="border-top:2px solid #e2e8f0;margin-bottom:10px"></div>`,
                      `<table style="width:100%;border-collapse:collapse;margin-bottom:12px">`,
                      `<tr><td style="font-weight:700;padding:5px 8px;width:100px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">DN Number</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-family:monospace;font-weight:700">${dn.dnNumber}</td><td style="font-weight:700;padding:5px 8px;width:110px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;font-family:Cairo,Arial,sans-serif">رقم المذكرة</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-family:monospace;font-weight:700;direction:rtl;text-align:right">${dn.dnNumber}</td></tr>`,
                      `<tr><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">Customer</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600">${dn.customerName||""}</td><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;font-family:Cairo,Arial,sans-serif">العميل</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600;direction:rtl;text-align:right;font-family:Cairo,Arial,sans-serif">${dn.customerNameAr||dn.customerName||""}</td></tr>`,
                      `<tr><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">Delivery Date</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt">${dn.deliveryDate||""}</td><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;font-family:Cairo,Arial,sans-serif">تاريخ التسليم</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt">${dn.deliveryDate||""}</td></tr>`,
                      dn.driverName ? `<tr><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">Driver</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt">${dn.driverName}</td><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;font-family:Cairo,Arial,sans-serif">السائق</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt">${dn.driverName}</td></tr>` : "",
                      dn.invoiceNumber ? `<tr><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">Invoice</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-family:monospace">${dn.invoiceNumber}</td><td style="font-weight:700;padding:5px 8px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;font-family:Cairo,Arial,sans-serif">الفاتورة</td><td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;font-family:monospace">${dn.invoiceNumber}</td></tr>` : "",
                      "</table>",
                      `<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><thead><tr style="background:#2d3748;color:#fff"><th style="padding:7px 10px;text-align:left;border:0.5px solid #4a5568;font-size:8pt">Description / الوصف</th><th style="padding:7px 10px;text-align:center;border:0.5px solid #4a5568;font-size:8pt;width:60px">Qty / كم</th><th style="padding:7px 10px;text-align:center;border:0.5px solid #4a5568;font-size:8pt;width:60px">Unit / وحدة</th></tr></thead><tbody>${itemRows}</tbody></table>`,
                      dn.notes ? `<div style="border:0.5px solid #e8ecf0;border-radius:4px;padding:8px 12px;margin-bottom:12px;background:#fffbeb"><div style="font-weight:700;font-size:9pt;margin-bottom:3px">Notes</div><div style="font-size:8.5pt">${dn.notes}</div></div>` : "",
                      sigHTML,
                      footerHTML,
                      `<script>document.title="${dn.dnNumber}";window.onload=function(){setTimeout(function(){window.print()},1000)};</script>`,
                      "</body></html>"
                    ].join("\n");
                    win.document.open(); win.document.write(html); win.document.close();
                    win.document.title = dn.dnNumber;
                  } catch(e) { win.close(); toast.error("Failed to generate PDF"); }
                  finally { setExpGenerating(false); }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-brand-primary text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                {expGenerating ? "Generating..." : "Download Delivery Note PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سندات التسليم" : "Delivery Notes"}
        itemCount={notes?.length}
      />
    </div>
  );
};
export default DeliveryNotesPage;
