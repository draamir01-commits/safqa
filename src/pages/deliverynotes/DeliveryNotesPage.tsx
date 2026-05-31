import * as React from "react";
import { Plus, Eye, Truck, CheckCircle, Trash2, Package, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument } from "../../firebase/firestore";
import { DeliveryNote, CustomerOrSupplier, Invoice } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { ExportButton } from "../../components/ui/ExportButton";

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

  const [customerId, setCustomerId] = React.useState("");
  const [invoiceId, setInvoiceId] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [driverName, setDriverName] = React.useState("");
  const [formNotes, setFormNotes] = React.useState("");
  const [items, setItems] = React.useState([{ name: "", nameAr: "", qty: 1, unit: "PCE" }]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "deliveryNotes", (d) => setNotes((d as DeliveryNote[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "customers", (d) => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "invoices", (d) => setInvoices(d as Invoice[]));
    return () => { u1(); u2(); u3(); };
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
          <ExportButton data={notes} filename="delivery-notes" headers={{ dnNumber: "DN Number", customerName: "Customer", deliveryDate: "Date", status: "Status" }} />

          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "مذكرة تسليم جديدة" : "New Delivery Note"}
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
                    <button onClick={() => { setSelected(dn); setShowPreview(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded"><Eye className="h-4 w-4" /></button>
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

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "البنود" : "Items"}</span>
              <button onClick={() => setItems([...items, { name: "", nameAr: "", qty: 1, unit: "PCE" }])}
                className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"><Plus className="h-3 w-3" /> {language === "ar" ? "إضافة" : "Add"}</button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 p-3 border-b border-slate-100 last:border-0">
                <input value={item.name} onChange={e => { const u = [...items]; u[idx].name = e.target.value; setItems(u); }}
                  placeholder={language === "ar" ? "اسم البند" : "Item name"}
                  className="col-span-2 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                <input type="number" value={item.qty} onChange={e => { const u = [...items]; u[idx].qty = +e.target.value; setItems(u); }}
                  placeholder="Qty" className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" min={1} />
                <div className="flex items-center gap-1">
                  <input value={item.unit} onChange={e => { const u = [...items]; u[idx].unit = e.target.value; setItems(u); }}
                    placeholder="Unit" className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" />
                  {items.length > 1 && <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            ))}
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
        title={`${language === "ar" ? "مذكرة التسليم" : "Delivery Note"} ${selected?.dnNumber || ""}`}>
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
