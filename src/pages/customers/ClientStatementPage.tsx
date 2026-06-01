import toast from "react-hot-toast";
import * as React from "react";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
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
  Clock, Building2, Filter, Printer, ChevronDown, X} from "lucide-react";

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
                onClick={openExportPanel}
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


      {/* ── Export Panel (same as invoices/quotations) ── */}
      {showExportPanel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "\u062a\u0635\u062f\u064a\u0631 PDF" : "Export / Print PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? "كشف حساب" : "Client Statement"}</p>
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
                    let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm;display:flex;justify-content:space-between;font-size:7pt;color:#888;z-index:10"><span>${co?.name||""}</span><span>Client Statement</span><span>${new Date().toLocaleDateString()}</span></div>`;
                    if (expLHMode === "header" && footerUrl) {
                      footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff"><div style="padding:4px 12mm;border-top:0.5px solid #e8ecf0;display:flex;justify-content:space-between;font-size:7pt;color:#888"><span>${co?.name||""}</span><span>${new Date().toLocaleDateString()}</span></div><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div>`;
                      padBot = "32mm";
                    }
                    // ── Build professional client statement PDF ──
                    const cl = selectedClient as any;
                    const totalInv  = clientInvoices.reduce((s: number, inv: any) => s + (inv.grandTotal || 0), 0);
                    const totalPaid = clientInvoices.reduce((s: number, inv: any) => s + (inv.amountPaid || 0), 0);
                    const totalVat  = clientInvoices.reduce((s: number, inv: any) => s + (inv.totalVat || 0), 0);
                    const totalSub  = clientInvoices.reduce((s: number, inv: any) => s + (inv.subtotal || 0), 0);
                    const totalOuts = totalInv - totalPaid;
                    const SAR = (n: number) => n.toFixed(2) + " SAR";

                    // Client info block
                    const clientBlock = `
                      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;border:0.5px solid #c8cdd5;border-radius:4px">
                        <tr style="background:#f8fafc">
                          <td colspan="4" style="padding:8px 12px;border-bottom:1px solid #e2e8f0">
                            <span style="font-size:10pt;font-weight:700;color:#1e293b">${cl?.name||""}</span>
                            ${cl?.nameAr ? `<span style="font-family:Cairo,Arial,sans-serif;font-size:10pt;font-weight:700;color:#1e293b;direction:rtl;margin-right:16px;float:right">${cl.nameAr}</span>` : ""}
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#64748b;font-weight:600;width:100px">VAT Number</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#1e293b;font-family:monospace">${cl?.vatNumber||"—"}</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#64748b;font-weight:600;width:100px">CR Number</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#1e293b;font-family:monospace">${cl?.crNumber||"—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#64748b;font-weight:600">Phone</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#1e293b">${cl?.phone||"—"}</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#64748b;font-weight:600">Email</td>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#1e293b">${cl?.email||"—"}</td>
                        </tr>
                        <tr>
                          <td style="padding:5px 12px;font-size:7.5pt;color:#64748b;font-weight:600">Address</td>
                          <td colspan="3" style="padding:5px 12px;font-size:7.5pt;color:#1e293b">${[cl?.address, cl?.city, cl?.country].filter(Boolean).join(", ")||"—"}</td>
                        </tr>
                      </table>`;

                    // Period + generated date strip
                    const periodBlock = `
                      <table style="width:100%;border-collapse:collapse;margin-bottom:14px">
                        <tr>
                          <td style="padding:6px 10px;background:#1e293b;color:#fff;font-size:7.5pt;font-weight:600;width:120px">Statement Period</td>
                          <td style="padding:6px 10px;background:#f1f5f9;font-size:7.5pt;color:#1e293b">${dateRange.start} to ${dateRange.end}</td>
                          <td style="padding:6px 10px;background:#1e293b;color:#fff;font-size:7.5pt;font-weight:600;width:120px">Generated On</td>
                          <td style="padding:6px 10px;background:#f1f5f9;font-size:7.5pt;color:#1e293b">${new Date().toLocaleDateString("en-GB")}</td>
                        </tr>
                      </table>`;

                    // Invoice rows with running balance
                    let runBal = 0;
                    const invRows = clientInvoices.map((inv: any, i: number) => {
                      const bal = (inv.grandTotal||0) - (inv.amountPaid||0);
                      runBal += bal;
                      const isOD = inv.status !== "paid" && new Date(inv.dueDate) < new Date();
                      const statusColor = inv.status === "paid" ? "#059669" : isOD ? "#dc2626" : "#d97706";
                      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;font-weight:700;color:#2563eb;font-family:monospace">${inv.invoiceNumber||""}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${inv.issueDate||""}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;${isOD?"color:#dc2626;font-weight:600":""}">${inv.dueDate||""}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right">${(inv.subtotal||0).toFixed(2)}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right;color:#666">${(inv.totalVat||0).toFixed(2)}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right;font-weight:700">${(inv.grandTotal||0).toFixed(2)}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right;color:#059669">${(inv.amountPaid||0).toFixed(2)}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:right;font-weight:700;${bal>0?"color:#d97706":"color:#94a3b8"}">${bal.toFixed(2)}</td>
                        <td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt;text-align:center;color:${statusColor};font-weight:600">${inv.status||""}</td>
                      </tr>`;
                    }).join("");

                    // Summary totals box
                    const summaryBox = `
                      <table style="width:100%;border-collapse:collapse;margin-top:4px;margin-bottom:16px">
                        <tr style="background:#f8fafc">
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:700" colspan="6">Totals</td>
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right">${totalSub.toFixed(2)}</td>
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;color:#666">${totalVat.toFixed(2)}</td>
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;font-weight:700">${totalInv.toFixed(2)}</td>
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;color:#059669">${totalPaid.toFixed(2)}</td>
                          <td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;font-weight:700;color:${totalOuts>0?"#d97706":"#059669"}">${totalOuts.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </table>
                      <table style="width:280px;border-collapse:collapse;margin-left:auto;margin-bottom:16px;border:0.5px solid #c8cdd5">
                        <tr><td style="padding:6px 12px;font-size:8pt;font-weight:600;background:#f8fafc;border-bottom:0.5px solid #e2e8f0">Total Invoiced</td><td style="padding:6px 12px;font-size:8pt;text-align:right;border-bottom:0.5px solid #e2e8f0">${SAR(totalInv)}</td></tr>
                        <tr><td style="padding:6px 12px;font-size:8pt;font-weight:600;background:#f8fafc;border-bottom:0.5px solid #e2e8f0">Total Paid</td><td style="padding:6px 12px;font-size:8pt;text-align:right;color:#059669;border-bottom:0.5px solid #e2e8f0">${SAR(totalPaid)}</td></tr>
                        <tr style="background:#1e293b"><td style="padding:7px 12px;font-size:8.5pt;font-weight:700;color:#fff">Outstanding Balance</td><td style="padding:7px 12px;font-size:8.5pt;font-weight:700;text-align:right;color:${totalOuts>0?"#fbbf24":"#34d399"}">${SAR(totalOuts)}</td></tr>
                      </table>`;

                    const sigHTML = (sigObj || (expStamp && co?.stamp)) ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px"><div style="flex:1">${sigObj ? `<div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}<div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div><div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div><div style="font-size:8pt;color:#555">${sigObj.designation||""}</div>` : ""}</div>${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}</div>` : "";

                    const docTitle = `Statement-${cl?.name||"Client"}-${dateRange.start}`;
                    const html = [
                      "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
                      `<title>${docTitle}</title>`,
                      "<style>",
                      "*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}",
                      `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
                      `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
                      "</style></head><body>",
                      headerHTML,
                      // Title
                      "<div style='text-align:center;margin:10px 0 4px'>",
                      "<span style='font-size:20pt;font-weight:800;letter-spacing:-0.5px'>Client Statement</span>",
                      "<span style='font-family:Cairo,Arial,sans-serif;font-size:14pt;font-weight:700;color:#64748b;direction:rtl;display:block;margin-top:2px'>\u0643\u0634\u0641 \u062d\u0633\u0627\u0628 \u0627\u0644\u0639\u0645\u064a\u0644</span>",
                      "</div>",
                      "<div style='border-top:3px solid #1e293b;border-bottom:1px solid #e2e8f0;margin:10px 0 14px'></div>",
                      // Client info
                      clientBlock,
                      // Period
                      periodBlock,
                      // Invoices table
                      "<table style='width:100%;border-collapse:collapse;margin-bottom:0'>",
                      "<thead><tr style='background:#1e293b;color:#fff'>",
                      "<th style='padding:7px 8px;text-align:left;border:0.5px solid #334155;font-size:7.5pt'>Invoice #</th>",
                      "<th style='padding:7px 8px;text-align:left;border:0.5px solid #334155;font-size:7.5pt'>Date</th>",
                      "<th style='padding:7px 8px;text-align:left;border:0.5px solid #334155;font-size:7.5pt'>Due Date</th>",
                      "<th style='padding:7px 8px;text-align:right;border:0.5px solid #334155;font-size:7.5pt'>Subtotal</th>",
                      "<th style='padding:7px 8px;text-align:right;border:0.5px solid #334155;font-size:7.5pt'>VAT</th>",
                      "<th style='padding:7px 8px;text-align:right;border:0.5px solid #334155;font-size:7.5pt'>Total</th>",
                      "<th style='padding:7px 8px;text-align:right;border:0.5px solid #334155;font-size:7.5pt'>Paid</th>",
                      "<th style='padding:7px 8px;text-align:right;border:0.5px solid #334155;font-size:7.5pt'>Balance</th>",
                      "<th style='padding:7px 8px;text-align:center;border:0.5px solid #334155;font-size:7.5pt'>Status</th>",
                      "</tr></thead>",
                      `<tbody>${invRows}</tbody>`,
                      "</table>",
                      summaryBox,
                      sigHTML,
                      footerHTML,
                      `<script>document.title="${docTitle}";window.onload=function(){setTimeout(function(){window.print()},1200)}</script>`,
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
        title={selectedClient ? `${language === "ar" ? "كشف حساب" : "Client Statement"} — ${selectedClient.name}` : "Client Statement"}
        itemCount={clientInvoices?.length}
      />
    </div>
  );
};

export default ClientStatementPage;
