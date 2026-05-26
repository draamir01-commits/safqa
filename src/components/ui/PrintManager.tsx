import * as React from "react";
import { Printer, X, FileText, CheckCircle2, Loader2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

interface PrintManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  itemCount?: number;
}

export const PrintManager: React.FC<PrintManagerProps> = ({
  isOpen, onClose, onConfirm, title, itemCount
}) => {
  const { language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const [step, setStep] = React.useState<"preview" | "printing">("preview");

  React.useEffect(() => {
    if (!isOpen) setStep("preview");
  }, [isOpen]);

  const handlePrint = () => {
    setStep("printing");
    setTimeout(() => {
      window.focus();
      if (onConfirm) onConfirm();
      const prevTitle = document.title;
      document.title = title;
      window.print();
      document.title = prevTitle;
      setTimeout(() => { setStep("preview"); onClose(); }, 1500);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{language === "ar" ? "خيارات الطباعة" : "Print Options"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Document info */}
          <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
            <FileText className="h-8 w-8 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">{title}</p>
              {itemCount !== undefined && (
                <p className="text-xs text-slate-500 mt-0.5">{itemCount} {language === "ar" ? "سجل" : "records"}</p>
              )}
              {currentCompany && (
                <p className="text-xs text-slate-400 mt-0.5">{language === "ar" ? currentCompany.nameAr || currentCompany.name : currentCompany.name}</p>
              )}
            </div>
          </div>

          {/* Tip */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            {language === "ar"
              ? "لحفظ كـ PDF: اختر \"حفظ كـ PDF\" في مربع الطباعة بدلاً من طابعة."
              : "To save as PDF: choose \"Save as PDF\" as the printer destination."}
          </div>

          {step === "printing" ? (
            <div className="flex items-center justify-center gap-3 py-4 text-brand-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">{language === "ar" ? "جاري فتح الطباعة..." : "Opening print dialog..."}</span>
            </div>
          ) : (
            <div className="flex gap-3">
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
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintManager;
