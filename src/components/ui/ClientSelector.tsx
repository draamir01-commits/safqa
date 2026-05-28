import * as React from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { CustomerOrSupplier, ClientContact } from "../../types";
import { Building2, User, ChevronDown, Search, X } from "lucide-react";

export interface ClientSelection {
  clientId: string;
  clientName: string;
  clientNameAr: string;
  vatNumber: string;
  crNumber: string;
  city: string;
  street: string;
  buildingNumber: string;
  district: string;
  zipCode: string;
  country: string;
  contactName: string;
  contactNameAr: string;
  contactDesignation: string;
  contactPhone: string;
  contactEmail: string;
  paymentTerms: string;
}

interface ClientSelectorProps {
  value?: Partial<ClientSelection>;
  onChange: (selection: ClientSelection) => void;
  onClear?: () => void;
  required?: boolean;
  label?: string;
  className?: string;
}

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  value,
  onChange,
  onClear,
  required,
  label,
  className = "",
}) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [clients, setClients] = React.useState<CustomerOrSupplier[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Load customers
  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = onSnapshot(
      collection(db, "companies", currentCompany.id, "customers"),
      (snap) => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomerOrSupplier)))
    );
    return () => unsub();
  }, [currentCompany]);

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.nameAr.includes(q) ||
      (c.vatNumber || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  const getPrimaryContact = (c: CustomerOrSupplier): ClientContact | undefined => {
    if (!c.contacts || c.contacts.length === 0) return undefined;
    return c.contacts.find(ct => ct.isPrimary) || c.contacts[0];
  };

  const handleSelect = (c: CustomerOrSupplier) => {
    const primary = getPrimaryContact(c);
    onChange({
      clientId: c.id,
      clientName: c.name,
      clientNameAr: c.nameAr,
      vatNumber: c.vatNumber || "",
      crNumber: c.crNumber || "",
      city: c.city || "",
      street: c.street || "",
      buildingNumber: c.buildingNumber || "",
      district: c.district || "",
      zipCode: c.zipCode || "",
      country: c.country || "SA",
      contactName: primary?.name || "",
      contactNameAr: primary?.nameAr || "",
      contactDesignation: primary?.designation || "",
      contactPhone: primary?.phone || c.phone || "",
      contactEmail: primary?.email || c.email || "",
      paymentTerms: c.paymentTerms || "Net 30",
    });
    setIsOpen(false);
    setSearch("");
  };

  const selectedClient = value?.clientId
    ? clients.find(c => c.id === value.clientId)
    : null;

  return (
    <div className={`flex flex-col gap-1 ${className}`} ref={dropdownRef}>
      {label && (
        <label className="text-xs font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-slate-200 rounded-lg bg-white hover:border-brand-primary hover:bg-blue-50/30 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
      >
        {selectedClient ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              {selectedClient.type === "business"
                ? <Building2 className="h-3.5 w-3.5 text-blue-600" />
                : <User className="h-3.5 w-3.5 text-blue-600" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {language === "ar" ? selectedClient.nameAr : selectedClient.name}
              </p>
              {selectedClient.vatNumber && (
                <p className="text-xs text-slate-400 font-mono truncate">{selectedClient.vatNumber}</p>
              )}
            </div>
          </div>
        ) : (
          <span className="text-sm text-slate-400">
            {language === "ar" ? "اختر عميلاً..." : "Select a customer..."}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selectedClient && onClear && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="p-0.5 text-slate-400 hover:text-red-500 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
          style={{ minWidth: "320px" }}>

          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={language === "ar" ? "بحث باسم العميل أو الرقم الضريبي..." : "Search by name, VAT, or email..."}
                className="flex-1 bg-transparent text-sm outline-none text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                {language === "ar" ? "لا توجد نتائج" : "No customers found"}
              </div>
            ) : filtered.map(c => {
              const primary = getPrimaryContact(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-50 last:border-0 ${
                    value?.clientId === c.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {c.type === "business"
                      ? <Building2 className="h-4 w-4 text-slate-500" />
                      : <User className="h-4 w-4 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {language === "ar" ? c.nameAr : c.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.vatNumber && (
                        <span className="text-xs text-slate-400 font-mono">{c.vatNumber}</span>
                      )}
                      {primary && (
                        <span className="text-xs text-slate-400 truncate">• {primary.name}</span>
                      )}
                    </div>
                  </div>
                  {c.paymentTerms && (
                    <span className="text-xs font-medium text-slate-400 shrink-0">{c.paymentTerms}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
