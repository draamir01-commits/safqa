import * as React from "react";
import { Printer, X, FileText, Image as ImageIcon, Stamp, UserCheck, AlignLeft } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useUIStore } from "../../stores/uiStore";

interface AuthorizedSignatory {
  id: string;
  name: string;
  designation: string;
  signatureUrl?: string;
  isActive: boolean;
}

export interface InvoicePrintOptions {
  showLetterhead: boolean;
  showStamp: boolean;
  showSignatory: boolean;
  selectedSignatoryId: string | null;
  showNotes: boolean;
  showZatcaQr: boolean;
}

interface InvoicePrintDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: (options: InvoicePrintOptions) => void;
  companyId: string;
  companyProfile: any;
  invoiceNo: string;
}

const DEFAULT_OPTIONS: InvoicePrintOptions = {
  showLetterhead: true,
  showStamp: false,
  showSignatory: false,
  selectedSignatoryId: null,
  showNotes: true,
  showZatcaQr: true,
};

export const InvoicePrintDialog: React.FC<InvoicePrintDialogProps> = ({
  isOpen, onClose, onPrint, companyId, companyProfile, invoiceNo
}) => {
  const { language } = useUIStore();
  const [signatories, setSignatories] = React.useState<AuthorizedSignatory[]>([]);
  const [options, setOptions] = React.useState<InvoicePrintOptions>(DEFAULT_OPTIONS);

  React.useEffect(() => {
    if (!isOpen || !companyId) return;
    setOptions({
      ...DEFAULT_OPTIONS,
      showLetterhead: !!(companyProfile?.letterheadHeader || companyProfile?.fullLetterhead || companyProfile?.logo),
      showStamp: false,
    });
    const q = query(collection(db, "companies", companyId, "signatories"), where("isActive", "==", true));
    getDocs(q).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuthorizedSignatory));
      setSignatories(list);
      if (list.length === 1) {
        setOptions(prev => ({ ...prev, showSignatory: true, selectedSignatoryId: list[0].id }));
      }
    }).catch(() => {});
  }, [isOpen, companyId]);

  if (!isOpen) return null;

  const toggle = (key: keyof InvoicePrintOptions) =>
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));

  const hasLetterhead = !!(companyProfile?.letterheadHeader || companyProfile?.fullLetterhead || companyProfile?.logo);
  const hasStamp = !!companyProfile?.stamp;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", background: "rgba(15,23,42,0.65)", backdropFilter: "blur(2px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ maxHeight: "calc(100vh - 2rem)", overflow: "hidden" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Printer className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">{language === "ar" ? "طباعة الفاتورة" : "Print Invoice"}</p>
              <p className="text-xs text-slate-400">{invoiceNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
            {language === "ar" ? "خيارات الطباعة" : "Print Options"}
          </p>

          {/* Letterhead */}
          <OptionRow
            icon={<ImageIcon className="w-4 h-4" />}
            label={language === "ar" ? "الترويسة" : "Letterhead"}
            description={hasLetterhead ? (language === "ar" ? "استخدام ترويسة الشركة" : "Use company letterhead") : (language === "ar" ? "لم يُرفع ترويسة في الإعدادات" : "No letterhead configured in Settings")}
            checked={options.showLetterhead && hasLetterhead}
            disabled={!hasLetterhead}
            onChange={() => hasLetterhead && toggle("showLetterhead")}
          />

          {/* Stamp */}
          <OptionRow
            icon={<Stamp className="w-4 h-4" />}
            label={language === "ar" ? "ختم الشركة" : "Company Stamp"}
            description={hasStamp ? (language === "ar" ? "إضافة ختم الشركة للفاتورة" : "Add company stamp to invoice") : (language === "ar" ? "لم يُرفع ختم في الإعدادات" : "No stamp uploaded in Settings")}
            checked={options.showStamp && hasStamp}
            disabled={!hasStamp}
            onChange={() => hasStamp && toggle("showStamp")}
          />

          {/* Authorized Signatory */}
          <div className={`border rounded-xl p-3 transition-all ${options.showSignatory ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${options.showSignatory ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{language === "ar" ? "المفوض بالتوقيع" : "Authorized Signatory"}</p>
                  <p className="text-xs text-slate-400">
                    {signatories.length === 0 ? (language === "ar" ? "لا يوجد مفوضون في الإعدادات" : "No signatories configured in Settings") : (language === "ar" ? "إضافة توقيع للفاتورة" : "Add signature to invoice")}
                  </p>
                </div>
              </div>
              <CheckBox
                checked={options.showSignatory && signatories.length > 0}
                disabled={signatories.length === 0}
                onChange={() => signatories.length > 0 && toggle("showSignatory")}
              />
            </div>

            {options.showSignatory && signatories.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {signatories.map(sig => (
                  <label key={sig.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${options.selectedSignatoryId === sig.id ? "bg-emerald-100 border border-emerald-200" : "hover:bg-slate-50 border border-transparent"}`}>
                    <input type="radio" name="sig" value={sig.id} checked={options.selectedSignatoryId === sig.id}
                      onChange={() => setOptions(prev => ({ ...prev, selectedSignatoryId: sig.id }))}
                      className="text-emerald-500" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-800">{sig.name}</p>
                      <p className="text-xs text-slate-400">{sig.designation}</p>
                    </div>
                    {sig.signatureUrl && (
                      <img src={sig.signatureUrl} alt="sig" className="h-6 opacity-70 object-contain" />
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ZATCA QR */}
          <OptionRow
            icon={<FileText className="w-4 h-4" />}
            label={language === "ar" ? "رمز QR لـ ZATCA" : "ZATCA QR Code"}
            description={language === "ar" ? "تضمين رمز الامتثال لـ ZATCA" : "Include ZATCA compliance QR code"}
            checked={options.showZatcaQr}
            onChange={() => toggle("showZatcaQr")}
          />

          {/* Notes */}
          <OptionRow
            icon={<AlignLeft className="w-4 h-4" />}
            label={language === "ar" ? "الملاحظات والشروط" : "Notes & Terms"}
            description={language === "ar" ? "إظهار ملاحظات الفاتورة إن وجدت" : "Show invoice notes if any"}
            checked={options.showNotes}
            onChange={() => toggle("showNotes")}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl transition-colors">
            {language === "ar" ? "إلغاء" : "Cancel"}
          </button>
          <button onClick={() => onPrint(options)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shadow-sm">
            <Printer className="w-4 h-4" />
            {language === "ar" ? "طباعة / حفظ PDF" : "Print / Save PDF"}
          </button>
        </div>
      </div>
    </div>
  );
};

const OptionRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}> = ({ icon, label, description, checked, disabled, onChange }) => (
  <div
    onClick={!disabled ? onChange : undefined}
    className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-slate-300"} ${checked ? "border-indigo-200 bg-indigo-50/50" : "border-slate-200"}`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-400"}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <p className="text-xs text-slate-400 truncate">{description}</p>
    </div>
    <CheckBox checked={checked} disabled={disabled} onChange={onChange} />
  </div>
);

const CheckBox: React.FC<{ checked: boolean; disabled?: boolean; onChange: () => void }> = ({ checked, disabled, onChange }) => (
  <button
    onClick={e => { e.stopPropagation(); if (!disabled) onChange(); }}
    disabled={disabled}
    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-white"} ${disabled ? "opacity-50" : ""}`}
  >
    {checked && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
  </button>
);

export default InvoicePrintDialog;
