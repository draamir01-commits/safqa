import * as React from "react";
import { Printer, X, FileText, Loader2, Image as ImageIcon, UserCheck, Stamp, ChevronDown } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

interface AuthorizedSignatory {
  id: string;
  name: string;
  designation: string;
  signatureUrl?: string;
  isActive: boolean;
}

interface LetterheadOption {
  id: string;
  name: string;
  url: string;
}

export interface PrintOptions {
  includeLetterhead: boolean;
  selectedLetterheadId: string;
  includeLogo: boolean;
  includeStamp: boolean;
  selectedSignatoryId: string;
  includeSignature: boolean;
}

interface PrintManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (options: PrintOptions) => void;
  title: string;
  itemCount?: number;
}

export const PrintManager: React.FC<PrintManagerProps> = ({
  isOpen, onClose, onConfirm, title, itemCount
}) => {
  const { language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const [step, setStep] = React.useState<"options" | "printing">("options");

  // Branding options
  const [includeLetterhead, setIncludeLetterhead] = React.useState(false);
  const [selectedLetterheadId, setSelectedLetterheadId] = React.useState("primary");
  const [includeLogo, setIncludeLogo]             = React.useState(true);
  const [includeStamp, setIncludeStamp]           = React.useState(false);
  const [selectedSigId, setSelectedSigId]         = React.useState("");
  const [includeSignature, setIncludeSignature]   = React.useState(false);

  const [signatories, setSignatories]   = React.useState<AuthorizedSignatory[]>([]);
  const [letterheads, setLetterheads]   = React.useState<LetterheadOption[]>([]);

  React.useEffect(() => {
    if (!isOpen) { setStep("options"); return; }
    if (!currentCompany) return;

    // Load signatories
    const q = query(collection(db, "companies", currentCompany.id, "signatories"), where("isActive", "==", true));
    getDocs(q).then(snap => setSignatories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuthorizedSignatory))));

    // Build letterhead list
    const lhs: LetterheadOption[] = [
      { id: "primary", name: language === "ar" ? "الترويسة الرئيسية" : "Primary Letterhead", url: "" }
    ];
    ((currentCompany as any).additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setLetterheads(lhs);
  }, [isOpen, currentCompany]);

  const selectedSig = signatories.find(s => s.id === selectedSigId);

  const handlePrint = () => {
    setStep("printing");
    const options: PrintOptions = {
      includeLetterhead, selectedLetterheadId,
      includeLogo, includeStamp,
      selectedSignatoryId: selectedSigId,
      includeSignature,
    };

    // Apply print CSS variables for the page
    const styleId = "safqa-print-options";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) { style = document.createElement("style"); style.id = styleId; document.head.appendChild(style); }

    style.textContent = `
      @media print {
        .print-hide { display: none !important; }
        .print-letterhead { display: ${includeLetterhead ? "flex" : "none"} !important; }
        .print-logo { display: ${includeLogo ? "block" : "none"} !important; }
        .print-stamp { display: ${includeStamp ? "block" : "none"} !important; }
        .print-signatory { display: ${selectedSigId ? "block" : "none"} !important; }
      }
    `;

    setTimeout(() => {
      window.focus();
      if (onConfirm) onConfirm(options);
      const prevTitle = document.title;
      document.title = title;
      window.print();
      document.title = prevTitle;
      setTimeout(() => { setStep("options"); onClose(); }, 1500);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-800">{language === "ar" ? "خيارات الطباعة" : "Print Options"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Document info */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-3">
            <FileText className="h-7 w-7 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">{title}</p>
              {itemCount !== undefined && (
                <p className="text-xs text-slate-500">{itemCount} {language === "ar" ? "سجل" : "records"}</p>
              )}
              {currentCompany && (
                <p className="text-xs text-slate-400">{language === "ar" ? currentCompany.nameAr || currentCompany.name : currentCompany.name}</p>
              )}
            </div>
          </div>

          {step === "printing" ? (
            <div className="flex items-center justify-center gap-3 py-6 text-brand-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">{language === "ar" ? "جاري فتح الطباعة..." : "Opening print dialog..."}</span>
            </div>
          ) : (
            <>
              {/* ── Letterhead ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                  {language === "ar" ? "الترويسة" : "Letterhead"}
                </p>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين ترويسة" : "Include Letterhead"}</span>
                  </div>
                  <input type="checkbox" checked={includeLetterhead} onChange={e => setIncludeLetterhead(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                </label>

                {includeLetterhead && letterheads.length > 1 && (
                  <div className="mt-2 space-y-1 pl-2">
                    {letterheads.map(lh => (
                      <label key={lh.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${selectedLetterheadId === lh.id ? "border-brand-primary bg-blue-50" : "border-slate-100"}`}>
                        <input type="radio" name="lh" checked={selectedLetterheadId === lh.id} onChange={() => setSelectedLetterheadId(lh.id)} className="text-brand-primary" />
                        {lh.url ? (
                          <img src={lh.url} alt={lh.name} className="h-6 object-contain rounded border border-slate-200 bg-white" />
                        ) : (
                          <div className="h-6 w-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="h-3 w-3 text-slate-300" />
                          </div>
                        )}
                        <span className="text-xs text-slate-700">{lh.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Logo & Stamp ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                  {language === "ar" ? "الشعار والختم" : "Logo & Stamp"}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الشعار" : "Include Logo"}</span>
                        {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع شعار" : "No logo uploaded"}</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={includeLogo} onChange={e => setIncludeLogo(e.target.checked)} className="rounded border-slate-300 text-brand-primary" disabled={!(currentCompany as any)?.logo} />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                    <div className="flex items-center gap-2">
                      <Stamp className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الختم" : "Include Stamp"}</span>
                        {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع ختم" : "No stamp uploaded"}</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={includeStamp} onChange={e => setIncludeStamp(e.target.checked)} className="rounded border-slate-300 text-brand-primary" disabled={!(currentCompany as any)?.stamp} />
                  </label>
                </div>
              </div>

              {/* ── Signatory ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-2">
                  {language === "ar" ? "التوقيع المفوض" : "Authorized Signatory"}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={selectedSigId} onChange={e => setSelectedSigId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">{language === "ar" ? "بدون توقيع" : "None"}</option>
                    {signatories.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>
                  {selectedSig && (selectedSig as any).signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-xs text-slate-600">{language === "ar" ? "تضمين صورة التوقيع" : "Include signature image"}</span>
                      <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                  {selectedSig && (selectedSig as any).signatureUrl && includeSignature && (
                    <img src={(selectedSig as any).signatureUrl} alt="sig" className="h-10 object-contain border border-slate-200 rounded bg-white p-1" />
                  )}
                  {signatories.length === 0 && <p className="text-[10px] text-slate-400">{language === "ar" ? "أضف مفوضين من الإعدادات" : "Add signatories in Settings"}</p>}
                </div>
              </div>

              {/* Print tip */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                {language === "ar"
                  ? "لحفظ كـ PDF: اختر \"حفظ كـ PDF\" في مربع الطباعة."
                  : "To save as PDF: choose \"Save as PDF\" as the printer."}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose}
                  className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={handlePrint}
                  className="flex-1 py-2.5 text-sm font-semibold bg-slate-900 text-white rounded-xl hover:bg-brand-primary transition-colors flex items-center justify-center gap-2">
                  <Printer className="h-4 w-4" />
                  {language === "ar" ? "طباعة" : "Print"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintManager;
