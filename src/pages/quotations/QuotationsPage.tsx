import * as React from "react";
import { Plus, Eye, FileText, CheckCircle, XCircle, Clock, ArrowRight, Trash2, Send, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { listenCompanyCollection, addDocument, updateDocument, deleteDocument, getNextInvoiceNumber, saveInvoice } from "../../firebase/firestore";
import { formatCurrency } from "../../utils/formatters";
import { calculateLineItem, calculateTotals } from "../../utils/vatCalculator";
import { Quotation, QuotationStatus, CustomerOrSupplier, Product, LineItem, InvoiceType, InvoiceStatus, ZatcaStatus } from "../../types";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import { ExportButton } from "../../components/ui/ExportButton";

const statusColor: Record<QuotationStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-orange-100 text-orange-700",
  converted: "bg-purple-100 text-purple-700",
};

export const QuotationsPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [quotations, setQuotations] = React.useState<Quotation[]>([]);
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [selected, setSelected] = React.useState<Quotation | null>(null);

  // Form state
  const [customerId, setCustomerId] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [expiryDate, setExpiryDate] = React.useState(new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<LineItem[]>([
    { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }
  ]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "quotations", (d) => setQuotations((d as Quotation[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    const u2 = listenCompanyCollection(currentCompany.id, "customers", (d) => setCustomers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "products", (d) => setProducts(d as Product[]));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const totals = React.useMemo(() => calculateTotals(lines), [lines]);

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "productId") {
      const p = products.find(p => p.id === value);
      if (p) { updated[idx].name = p.name; updated[idx].nameAr = p.nameAr; updated[idx].unitPrice = p.salePrice; updated[idx].vatRate = p.vatRate; }
    }
    updated[idx] = calculateLineItem(updated[idx]);
    setLines(updated);
  };

  const handleSave = async () => {
    if (!customerId || !currentCompany || !user) return toast.error("Please select a customer");
    setLoading(true);
    try {
      const customer = customers.find(c => c.id === customerId)!;
      const qNum = "QUO-" + Date.now().toString().slice(-6);
      await addDocument(`companies/${currentCompany.id}/quotations`, {
        quotationNumber: qNum,
        customerId,
        customerName: customer.name,
        customerNameAr: customer.nameAr,
        issueDate, expiryDate,
        status: "draft",
        lineItems: lines,
        ...totals,
        currency: "SAR",
        notes,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم إنشاء عرض السعر" : "Quotation created");
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToInvoice = async (q: Quotation) => {
    if (!currentCompany || !user) return;
    setLoading(true);
    try {
      const invNum = await getNextInvoiceNumber(currentCompany.id);
      const invoiceId = uuidv4();
      await saveInvoice(currentCompany.id, invoiceId, {
        invoiceNumber: invNum,
        type: InvoiceType.STANDARD,
        status: InvoiceStatus.DRAFT,
        customerId: q.customerId,
        customerName: q.customerName,
        customerNameAr: q.customerNameAr,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        supplyDate: new Date().toISOString().split("T")[0],
        lineItems: q.lineItems,
        subtotal: q.subtotal,
        totalDiscount: q.totalDiscount,
        totalVat: q.totalVat,
        grandTotal: q.grandTotal,
        vatBreakdown: [],
        currency: "SAR",
        zatcaStatus: ZatcaStatus.NOT_SUBMITTED,
        zatcaPhase: currentCompany.zatcaPhase,
        paymentStatus: "unpaid",
        amountPaid: 0,
        amountDue: q.grandTotal,
        notes: q.notes,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await updateDocument(`companies/${currentCompany.id}/quotations`, q.id, {
        status: "converted",
        convertedToInvoiceId: invoiceId,
        updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم تحويل عرض السعر إلى فاتورة" : "Converted to invoice successfully");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentCompany) return;
    await deleteDocument(`companies/${currentCompany.id}/quotations`, id);
    toast.success(language === "ar" ? "تم الحذف" : "Deleted");
  };

  const handleStatusChange = async (q: Quotation, status: QuotationStatus) => {
    if (!currentCompany) return;
    await updateDocument(`companies/${currentCompany.id}/quotations`, q.id, { status, updatedAt: new Date() });
  };

  const resetForm = () => {
    setCustomerId(""); setNotes("");
    setLines([{ productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }]);
  };

  const statusLabel = (s: QuotationStatus) => {
    const map: Record<QuotationStatus, [string, string]> = {
      draft: ["مسودة", "Draft"], sent: ["مرسل", "Sent"], accepted: ["مقبول", "Accepted"],
      rejected: ["مرفوض", "Rejected"], expired: ["منتهي", "Expired"], converted: ["محوّل", "Converted"]
    };
    return map[s]?.[language === "ar" ? 0 : 1] || s;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "عروض الأسعار" : "Quotations"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "إنشاء وإدارة عروض الأسعار" : "Create and manage quotations"}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton data={quotations} filename="quotations" headers={{ quotationNumber: "Number", customerName: "Customer", grandTotal: "Total", status: "Status" }} />

          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Button onClick={() => setShowForm(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            {language === "ar" ? "عرض سعر جديد" : "New Quotation"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["draft","sent","accepted","converted"] as QuotationStatus[]).map(s => (
          <div key={s} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs text-slate-500 mb-1">{statusLabel(s)}</p>
            <p className="text-2xl font-bold text-slate-800">{quotations.filter(q => q.status === s).length}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {[
                language === "ar" ? "رقم العرض" : "Number",
                language === "ar" ? "العميل" : "Customer",
                language === "ar" ? "تاريخ الإصدار" : "Issue Date",
                language === "ar" ? "تاريخ الانتهاء" : "Expiry",
                language === "ar" ? "الإجمالي" : "Total",
                language === "ar" ? "الحالة" : "Status",
                language === "ar" ? "إجراءات" : "Actions",
              ].map((h, i) => <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotations.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-slate-400 text-sm">{language === "ar" ? "لا توجد عروض أسعار" : "No quotations yet"}</td></tr>
            ) : quotations.map(q => (
              <tr key={q.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-brand-primary font-semibold">{q.quotationNumber}</td>
                <td className="px-4 py-3 text-slate-800 font-medium">{language === "ar" ? q.customerNameAr || q.customerName : q.customerName}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{q.issueDate}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{q.expiryDate}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(q.grandTotal, language)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[q.status]}`}>{statusLabel(q.status)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setSelected(q); setShowPreview(true); }} className="p-1 text-slate-400 hover:text-brand-primary rounded transition-colors" title={language === "ar" ? "عرض" : "View"}>
                      <Eye className="h-4 w-4" />
                    </button>
                    {q.status !== "converted" && q.status !== "rejected" && (
                      <button onClick={() => handleConvertToInvoice(q)} className="p-1 text-slate-400 hover:text-emerald-600 rounded transition-colors" title={language === "ar" ? "تحويل لفاتورة" : "Convert to Invoice"}>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                    {q.status === "draft" && (
                      <button onClick={() => handleStatusChange(q, "sent")} className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors" title={language === "ar" ? "تعيين كمرسل" : "Mark Sent"}>
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                    {q.status === "sent" && (
                      <>
                        <button onClick={() => handleStatusChange(q, "accepted")} className="p-1 text-slate-400 hover:text-emerald-600 rounded transition-colors"><CheckCircle className="h-4 w-4" /></button>
                        <button onClick={() => handleStatusChange(q, "rejected")} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"><XCircle className="h-4 w-4" /></button>
                      </>
                    )}
                    <button onClick={() => handleDelete(q.id)} className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Quotation Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }}
        title={language === "ar" ? "عرض سعر جديد" : "New Quotation"}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={language === "ar" ? "العميل" : "Customer"} value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              options={[{ value: "", label: language === "ar" ? "اختر عميل..." : "Select customer..." }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
            <Input label={language === "ar" ? "تاريخ الإصدار" : "Issue Date"} type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            <Input label={language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"} type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            <Input label={language === "ar" ? "ملاحظات" : "Notes"} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "البنود" : "Line Items"}</span>
              <button onClick={() => setLines([...lines, { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }])}
                className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1">
                <Plus className="h-3 w-3" /> {language === "ar" ? "إضافة" : "Add"}
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-2 p-3 border-b border-slate-100 last:border-0">
                <select value={line.productId} onChange={e => updateLine(idx, "productId", e.target.value)}
                  className="col-span-2 text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none">
                  <option value="">{language === "ar" ? "اختر منتج" : "Select product"}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={line.qty} onChange={e => updateLine(idx, "qty", +e.target.value)} placeholder={language === "ar" ? "الكمية" : "Qty"}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" min={1} />
                <input type="number" value={line.unitPrice} onChange={e => updateLine(idx, "unitPrice", +e.target.value)} placeholder={language === "ar" ? "السعر" : "Price"}
                  className="text-xs border border-slate-200 rounded px-2 py-1.5 focus:outline-none" min={0} />
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-700">{formatCurrency(line.lineTotal, language)}</span>
                  {lines.length > 1 && <button onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "المجموع الفرعي" : "Subtotal"}</span><span>{formatCurrency(totals.subtotal, language)}</span></div>
            <div className="flex justify-between text-slate-600"><span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</span><span>{formatCurrency(totals.totalVat, language)}</span></div>
            <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1"><span>{language === "ar" ? "الإجمالي" : "Total"}</span><span>{formatCurrency(totals.grandTotal, language)}</span></div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleSave} loading={loading}>{language === "ar" ? "حفظ عرض السعر" : "Save Quotation"}</Button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      <Modal isOpen={showPreview} onClose={() => setShowPreview(false)}
        title={`${language === "ar" ? "عرض السعر" : "Quotation"} ${selected?.quotationNumber || ""}`}>
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "العميل" : "Customer"}</span><p className="font-semibold">{language === "ar" ? selected.customerNameAr : selected.customerName}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "الحالة" : "Status"}</span><p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor[selected.status]}`}>{statusLabel(selected.status)}</span></p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "تاريخ الإصدار" : "Issued"}</span><p>{selected.issueDate}</p></div>
              <div><span className="text-slate-500 text-xs">{language === "ar" ? "صالح حتى" : "Expires"}</span><p>{selected.expiryDate}</p></div>
            </div>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50"><tr>
                <th className="px-3 py-2 text-start text-slate-600">{language === "ar" ? "المنتج" : "Item"}</th>
                <th className="px-3 py-2 text-center text-slate-600">{language === "ar" ? "الكمية" : "Qty"}</th>
                <th className="px-3 py-2 text-end text-slate-600">{language === "ar" ? "السعر" : "Price"}</th>
                <th className="px-3 py-2 text-end text-slate-600">{language === "ar" ? "الإجمالي" : "Total"}</th>
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
            {selected.status !== "converted" && (
              <div className="flex justify-end">
                <Button onClick={() => { handleConvertToInvoice(selected); setShowPreview(false); }} className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {language === "ar" ? "تحويل إلى فاتورة" : "Convert to Invoice"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل عروض الأسعار" : "Quotations Register"}
        itemCount={quotations?.length}
      />
    </div>
  );
};
export default QuotationsPage;
