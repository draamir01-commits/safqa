import * as React from "react";
import { Scale, Search, Printer } from "lucide-react";
import { listenCompanyCollection } from "../../firebase/firestore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Invoice, Bill, CustomerOrSupplier } from "../../types";
import { ExportMenu } from "../../components/ui/ExportMenu";

interface LedgerEntry { date: string; type: string; ref: string; debit: number; credit: number; balance: number; description: string; }

export const PartnerLedgerPage: React.FC = () => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [customers, setCustomers] = React.useState<CustomerOrSupplier[]>([]);
  const [suppliers, setSuppliers] = React.useState<CustomerOrSupplier[]>([]);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [showPrint, setShowPrint] = React.useState(false);
  const [partnerType, setPartnerType] = React.useState<"customer" | "supplier">("customer");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = listenCompanyCollection(currentCompany.id, "customers", d => setCustomers(d as CustomerOrSupplier[]));
    const u2 = listenCompanyCollection(currentCompany.id, "suppliers", d => setSuppliers(d as CustomerOrSupplier[]));
    const u3 = listenCompanyCollection(currentCompany.id, "invoices", d => setInvoices(d as Invoice[]));
    const u4 = listenCompanyCollection(currentCompany.id, "bills", d => setBills(d as Bill[]));
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentCompany]);

  const partners = partnerType === "customer" ? customers : suppliers;
  const filtered = partners.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase()));
  const selected = partners.find(p => p.id === selectedId);

  const ledgerEntries: LedgerEntry[] = React.useMemo(() => {
    if (!selectedId) return [];
    const entries: LedgerEntry[] = [];
    let balance = 0;

    if (partnerType === "customer") {
      const partnerInvoices = invoices.filter(i => i.customerId === selectedId && i.status !== "draft" && i.status !== "cancelled")
        .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
      for (const inv of partnerInvoices) {
        balance += inv.grandTotal;
        entries.push({ date: inv.issueDate, type: language === "ar" ? "فاتورة" : "Invoice", ref: inv.invoiceNumber, debit: inv.grandTotal, credit: 0, balance, description: inv.customerName });
        if (inv.amountPaid > 0) {
          balance -= inv.amountPaid;
          entries.push({ date: inv.issueDate, type: language === "ar" ? "دفعة" : "Payment", ref: inv.invoiceNumber, debit: 0, credit: inv.amountPaid, balance, description: language === "ar" ? "دفعة مستلمة" : "Payment received" });
        }
      }
    } else {
      const partnerBills = bills.filter(b => b.supplierId === selectedId && b.status !== "draft" && b.status !== "cancelled")
        .sort((a, b) => new Date(a.issueDate).getTime() - new Date(b.issueDate).getTime());
      for (const bill of partnerBills) {
        balance += bill.grandTotal;
        entries.push({ date: bill.issueDate, type: language === "ar" ? "فاتورة مورد" : "Bill", ref: bill.billNumber, debit: bill.grandTotal, credit: 0, balance, description: bill.supplierName });
        if (bill.amountPaid > 0) {
          balance -= bill.amountPaid;
          entries.push({ date: bill.issueDate, type: language === "ar" ? "دفعة" : "Payment", ref: bill.billNumber, debit: 0, credit: bill.amountPaid, balance, description: language === "ar" ? "دفعة للمورد" : "Payment to supplier" });
        }
      }
    }
    return entries;
  }, [selectedId, partnerType, invoices, bills, language]);

  const totalDebit = ledgerEntries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ledgerEntries.reduce((s, e) => s + e.credit, 0);
  const closingBalance = totalDebit - totalCredit;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "دفتر أستاذ الشركاء" : "Partner Ledger"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "كشف حساب تفصيلي لكل عميل أو مورد" : "Detailed statement of account per customer or supplier"}</p>
        </div>
        {selectedId && <ExportMenu data={ledgerEntries} filename={`ledger-${selected?.name || "ledger"}`} headers={{ date: "Date", type: "Type", ref: "Reference", debit: "Debit", credit: "Credit", balance: "Balance" }} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Partner selector */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <button onClick={() => { setPartnerType("customer"); setSelectedId(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${partnerType === "customer" ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {language === "ar" ? "العملاء" : "Customers"}
            </button>
            <button onClick={() => { setPartnerType("supplier"); setSelectedId(""); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${partnerType === "supplier" ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {language === "ar" ? "الموردون" : "Suppliers"}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute start-2 top-2 h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={language === "ar" ? "بحث..." : "Search..."}
              className="w-full ps-8 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-primary" />
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {filtered.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`w-full text-start px-2 py-2.5 text-xs transition-colors ${selectedId === p.id ? "bg-blue-50 text-brand-primary font-semibold" : "hover:bg-slate-50 text-slate-700"}`}>
                <p className="font-medium">{p.name}</p>
                {p.email && <p className="text-slate-400 text-[10px]">{p.email}</p>}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-center py-4 text-slate-400 text-xs">{language === "ar" ? "لا توجد نتائج" : "No results"}</p>}
          </div>
        </div>

        {/* Ledger table */}
        <div className="md:col-span-2 flex flex-col gap-3">
          {!selectedId ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-400 text-sm">
              {language === "ar" ? "اختر عميلاً أو مورداً لعرض كشف الحساب" : "Select a customer or supplier to view their statement"}
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{language === "ar" ? "إجمالي المديونية" : "Total Debit"}</p>
                  <p className="text-lg font-bold text-slate-800">{formatCurrency(totalDebit, language)}</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{language === "ar" ? "إجمالي المدفوعات" : "Total Credit"}</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalCredit, language)}</p>
                </div>
                <div className={`rounded-lg p-3 border ${closingBalance > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                  <p className="text-xs text-slate-500">{language === "ar" ? "الرصيد الختامي" : "Closing Balance"}</p>
                  <p className={`text-lg font-bold ${closingBalance > 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(Math.abs(closingBalance), language)}</p>
                  <p className="text-[10px] text-slate-400">{closingBalance > 0 ? (language === "ar" ? "مستحق" : "Outstanding") : (language === "ar" ? "دائن" : "Credit")}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm text-slate-700">
                  {selected?.name} — {language === "ar" ? "كشف الحساب" : "Account Statement"}
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {[language === "ar" ? "التاريخ" : "Date", language === "ar" ? "النوع" : "Type", language === "ar" ? "المرجع" : "Ref",
                        language === "ar" ? "مدين" : "Debit", language === "ar" ? "دائن" : "Credit", language === "ar" ? "الرصيد" : "Balance"
                      ].map((h, i) => <th key={i} className="px-4 py-2 text-xs font-semibold text-slate-600 text-start">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ledgerEntries.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-slate-400 text-sm">{language === "ar" ? "لا توجد معاملات" : "No transactions"}</td></tr>
                    ) : ledgerEntries.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-xs text-slate-500">{e.date}</td>
                        <td className="px-4 py-2 text-xs font-medium text-slate-700">{e.type}</td>
                        <td className="px-4 py-2 text-xs font-mono text-brand-primary">{e.ref}</td>
                        <td className="px-4 py-2 text-xs text-red-600 font-medium">{e.debit > 0 ? formatCurrency(e.debit, language) : "—"}</td>
                        <td className="px-4 py-2 text-xs text-emerald-600 font-medium">{e.credit > 0 ? formatCurrency(e.credit, language) : "—"}</td>
                        <td className="px-4 py-2 text-xs font-bold text-slate-800">{formatCurrency(e.balance, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "دفتر أستاذ الشركاء" : "Partner Ledger"}
        itemCount={invoices?.length}
      />
    </div>
  );
};
export default PartnerLedgerPage;
