import * as React from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { CustomerOrSupplier, Invoice, Income } from "../../types";
import { Letterhead, LetterheadFooter } from "../../components/ui/Letterhead";
import { PrintManager } from "../../components/ui/PrintManager";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { formatCurrency } from "../../utils/formatters";
import {
  FileText, TrendingUp, AlertCircle, CheckCircle2,
  Clock, Building2, Filter, Printer, ChevronDown
} from "lucide-react";

const StatusPill: React.FC<{ status: string; language: "ar" | "en" }> = ({ status, language }) => {
  const map: Record<string, { cls: string; en: string; ar: string }> = {
    paid:      { cls: "bg-emerald-100 text-emerald-700", en: "Paid",      ar: "مدفوع" },
    approved:  { cls: "bg-blue-100 text-blue-700",      en: "Approved",  ar: "معتمد" },
    pending:   { cls: "bg-amber-100 text-amber-700",    en: "Pending",   ar: "معلق" },
    draft:     { cls: "bg-slate-100 text-slate-500",    en: "Draft",     ar: "مسودة" },
    cancelled: { cls: "bg-red-100 text-red-500",        en: "Cancelled", ar: "ملغي" },
    reported:  { cls: "bg-indigo-100 text-indigo-700",  en: "Reported",  ar: "مُبلَّغ" },
  };
  const s = map[status] || { cls: "bg-slate-100 text-slate-500", en: status, ar: status };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{language === "ar" ? s.ar : s.en}</span>;
};

export const ClientStatementPage: React.FC = () => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [customers, setCustomers]   = React.useState<CustomerOrSupplier[]>([]);
  const [invoices, setInvoices]     = React.useState<Invoice[]>([]);
  const [incomes, setIncomes]       = React.useState<Income[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [showPrint, setShowPrint]   = React.useState(false);
  const [dateRange, setDateRange]   = React.useState({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    end:   new Date().toISOString().split("T")[0],
  });

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = onSnapshot(collection(db, "companies", currentCompany.id, "customers"),
      snap => setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerOrSupplier))));
    const u2 = onSnapshot(collection(db, "companies", currentCompany.id, "invoices"),
      snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice))));
    const u3 = onSnapshot(collection(db, "companies", currentCompany.id, "income"),
      snap => setIncomes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Income))));
    return () => { u1(); u2(); u3(); };
  }, [currentCompany]);

  const selectedClient = customers.find(c => c.id === selectedId);

  const inRange = (dateStr: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= new Date(dateRange.start) && d <= new Date(dateRange.end + "T23:59:59");
  };

  const clientInvoices = React.useMemo(() =>
    invoices.filter(inv =>
      inv.customerId === selectedId &&
      inRange(inv.issueDate) &&
      inv.status !== "cancelled"
    ).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()),
    [invoices, selectedId, dateRange]
  );

  const clientIncomes = React.useMemo(() =>
    incomes.filter(inc =>
      (inc.clientId === selectedId || inc.clientName === selectedClient?.name) &&
      inRange(inc.date)
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [incomes, selectedId, selectedClient, dateRange]
  );

  const summary = React.useMemo(() => {
    const totalInvoiced  = clientInvoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);
    const totalPaid      = clientInvoices.reduce((s, inv) => s + (inv.amountPaid || 0), 0);
    const totalOutstanding = totalInvoiced - totalPaid;
    const totalVat       = clientInvoices.reduce((s, inv) => s + (inv.totalVat || 0), 0);
    const incomeReceived = clientIncomes.reduce((s, inc) => s + (inc.totalAmount || inc.amount || 0), 0);
    const overdueInvoices = clientInvoices.filter(inv =>
      inv.status !== "paid" && inv.status !== "cancelled" && new Date(inv.dueDate) < new Date()
    );
    return { totalInvoiced, totalPaid, totalOutstanding, totalVat, incomeReceived, overdueCount: overdueInvoices.length };
  }, [clientInvoices, clientIncomes]);

  const exportData = clientInvoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    date: inv.issueDate,
    dueDate: inv.dueDate,
    subtotal: inv.subtotal,
    vat: inv.totalVat,
    total: inv.grandTotal,
    paid: inv.amountPaid,
    outstanding: inv.grandTotal - (inv.amountPaid || 0),
    status: inv.status,
  }));

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "كشف حساب العميل" : "Client Statement"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {language === "ar" ? "سجل كامل للفواتير والمدفوعات لكل عميل" : "Full invoice and payment record per client"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedClient && (
            <>
              <ExportMenu
                data={exportData}
                filename={`statement-${selectedClient.name}-${dateRange.start}`}
                headers={{ invoiceNumber: "Invoice #", date: "Date", dueDate: "Due Date", subtotal: "Subtotal", vat: "VAT", total: "Total", paid: "Paid", outstanding: "Outstanding", status: "Status" }}
              />
              <button
                onClick={() => setShowPrint(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Printer className="h-4 w-4" />
                {language === "ar" ? "طباعة" : "Print"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-xs font-semibold text-slate-600">
            {language === "ar" ? "اختر العميل" : "Select Customer"}
          </label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none bg-white pr-8"
            >
              <option value="">{language === "ar" ? "— اختر عميلاً —" : "— Select a customer —"}</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {language === "ar" ? c.nameAr : c.name}
                  {c.vatNumber ? ` (${c.vatNumber})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "من" : "From"}</label>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "إلى" : "To"}</label>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20" />
        </div>
      </div>

      {!selectedClient ? (
        <div className="bg-white border border-slate-200 rounded-xl p-16 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-200" />
          <p className="text-slate-400 text-sm">{language === "ar" ? "اختر عميلاً لعرض كشف الحساب" : "Select a customer to view their statement"}</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: language === "ar" ? "إجمالي الفواتير" : "Total Invoiced",    value: summary.totalInvoiced,    icon: FileText,    cls: "text-slate-800" },
              { label: language === "ar" ? "إجمالي المدفوع" : "Total Paid",         value: summary.totalPaid,        icon: CheckCircle2, cls: "text-emerald-600" },
              { label: language === "ar" ? "المبالغ المستحقة" : "Outstanding",      value: summary.totalOutstanding, icon: AlertCircle,  cls: summary.totalOutstanding > 0 ? "text-amber-600" : "text-slate-400" },
              { label: language === "ar" ? "إجمالي الضريبة" : "Total VAT",          value: summary.totalVat,         icon: TrendingUp,   cls: "text-indigo-600" },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <s.icon className="h-4 w-4 text-slate-300" />
                </div>
                <p className={`text-xl font-bold ${s.cls}`}>{formatCurrency(s.value, language)}</p>
              </div>
            ))}
          </div>

          {/* Overdue alert */}
          {summary.overdueCount > 0 && (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <Clock className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm font-semibold text-red-700">
                {language === "ar"
                  ? `${summary.overdueCount} فاتورة متأخرة الدفع`
                  : `${summary.overdueCount} overdue invoice${summary.overdueCount > 1 ? "s" : ""}`}
              </p>
            </div>
          )}

          {/* Printable statement */}
          <div id="print-statement" className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="print-only">
              <Letterhead />
            </div>

            {/* Client info header */}
            <div className="flex items-start justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  {language === "ar" ? "كشف حساب" : "Statement For"}
                </p>
                <h3 className="text-lg font-bold text-slate-800">
                  {language === "ar" ? selectedClient.nameAr : selectedClient.name}
                </h3>
                {selectedClient.vatNumber && (
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {language === "ar" ? "الرقم الضريبي:" : "VAT:"} {selectedClient.vatNumber}
                  </p>
                )}
                {selectedClient.city && (
                  <p className="text-xs text-slate-500 mt-0.5">{selectedClient.city}</p>
                )}
              </div>
              <div className="text-end text-xs text-slate-500 space-y-0.5">
                <p className="font-semibold text-slate-700">
                  {language === "ar" ? "الفترة:" : "Period:"}
                </p>
                <p>{dateRange.start} → {dateRange.end}</p>
                <p className="mt-2">{language === "ar" ? "تاريخ الإصدار:" : "Generated:"} {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Invoices table */}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              {language === "ar" ? "الفواتير" : "Invoices"} ({clientInvoices.length})
            </p>

            {clientInvoices.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                {language === "ar" ? "لا توجد فواتير في هذه الفترة" : "No invoices in this period"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "رقم الفاتورة" : "Invoice #"}</th>
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "التاريخ" : "Date"}</th>
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "المبلغ" : "Amount"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "الضريبة" : "VAT"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "الإجمالي" : "Total"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "المدفوع" : "Paid"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "المتبقي" : "Balance"}</th>
                      <th className="px-3 py-2 text-center font-bold">{language === "ar" ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clientInvoices.map(inv => {
                      const balance = (inv.grandTotal || 0) - (inv.amountPaid || 0);
                      const isOverdue = inv.status !== "paid" && new Date(inv.dueDate) < new Date();
                      return (
                        <tr key={inv.id} className={`hover:bg-slate-50 ${isOverdue ? "bg-red-50/30" : ""}`}>
                          <td className="px-3 py-3 font-mono text-xs font-semibold text-brand-primary">{inv.invoiceNumber}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">{inv.issueDate}</td>
                          <td className={`px-3 py-3 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>{inv.dueDate}</td>
                          <td className="px-3 py-3 text-end text-xs">{formatCurrency(inv.subtotal || 0, language)}</td>
                          <td className="px-3 py-3 text-end text-xs text-slate-500">{formatCurrency(inv.totalVat || 0, language)}</td>
                          <td className="px-3 py-3 text-end text-xs font-semibold">{formatCurrency(inv.grandTotal || 0, language)}</td>
                          <td className="px-3 py-3 text-end text-xs text-emerald-600">{formatCurrency(inv.amountPaid || 0, language)}</td>
                          <td className={`px-3 py-3 text-end text-xs font-bold ${balance > 0 ? "text-amber-600" : "text-slate-400"}`}>
                            {formatCurrency(balance, language)}
                          </td>
                          <td className="px-3 py-3 text-center"><StatusPill status={inv.status} language={language} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-sm border-t-2 border-slate-200">
                      <td colSpan={5} className="px-3 py-3 text-slate-600">{language === "ar" ? "المجموع" : "Total"}</td>
                      <td className="px-3 py-3 text-end">{formatCurrency(summary.totalInvoiced, language)}</td>
                      <td className="px-3 py-3 text-end text-emerald-600">{formatCurrency(summary.totalPaid, language)}</td>
                      <td className={`px-3 py-3 text-end ${summary.totalOutstanding > 0 ? "text-amber-600" : "text-slate-400"}`}>
                        {formatCurrency(summary.totalOutstanding, language)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Income records */}
            {clientIncomes.length > 0 && (
              <div className="mt-8">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {language === "ar" ? "سجلات الإيرادات المرتبطة" : "Related Income Records"} ({clientIncomes.length})
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "التاريخ" : "Date"}</th>
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "الوصف" : "Description"}</th>
                      <th className="px-3 py-2 text-start font-bold">{language === "ar" ? "الفئة" : "Category"}</th>
                      <th className="px-3 py-2 text-end font-bold">{language === "ar" ? "المبلغ" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clientIncomes.map(inc => (
                      <tr key={inc.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-xs text-slate-600">{inc.date}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">{language === "ar" ? inc.descriptionAr || inc.description : inc.description}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{inc.category}</td>
                        <td className="px-3 py-2.5 text-end text-xs font-semibold text-emerald-600">{formatCurrency(inc.totalAmount || inc.amount || 0, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="print-only mt-6">
              <LetterheadFooter />
            </div>
          </div>
        </>
      )}

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        onConfirm={() => {
          const el = document.getElementById("print-statement");
          if (el) { window.print(); }
        }}
        title={selectedClient ? `${language === "ar" ? "كشف حساب" : "Client Statement"} — ${selectedClient.name}` : "Client Statement"}
        itemCount={clientInvoices.length}
      />
    </div>
  );
};

export default ClientStatementPage;
