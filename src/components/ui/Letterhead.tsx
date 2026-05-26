import * as React from "react";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";

interface LetterheadProps {
  showLogo?: boolean;
  showAddress?: boolean;
  className?: string;
}

export const Letterhead: React.FC<LetterheadProps> = ({
  showLogo = true,
  showAddress = true,
  className = "",
}) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  if (!currentCompany) return null;

  return (
    <div className={`border-b border-slate-200 pb-4 mb-4 flex items-start justify-between ${className}`}>
      <div className="flex items-center gap-3">
        {showLogo && currentCompany.logo ? (
          <img src={currentCompany.logo} alt="logo" className="h-14 w-14 object-contain rounded" />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold text-2xl">
            {(currentCompany.nameAr || currentCompany.name || "S")[0]}
          </div>
        )}
        <div>
          <h2 className="font-bold text-slate-800 text-lg leading-tight">
            {language === "ar" ? currentCompany.nameAr || currentCompany.name : currentCompany.name}
          </h2>
          {currentCompany.nameAr && language === "en" && (
            <p className="text-sm text-slate-500">{currentCompany.nameAr}</p>
          )}
        </div>
      </div>
      {showAddress && (
        <div className="text-xs text-slate-500 text-end space-y-0.5">
          {currentCompany.vatNumber && <p>{language === "ar" ? "الرقم الضريبي:" : "VAT:"} {currentCompany.vatNumber}</p>}
          {currentCompany.crNumber && <p>{language === "ar" ? "السجل التجاري:" : "CR:"} {currentCompany.crNumber}</p>}
          {currentCompany.city && <p>{currentCompany.city}{currentCompany.country ? `, ${currentCompany.country}` : ""}</p>}
          {currentCompany.phone && <p>{currentCompany.phone}</p>}
          {currentCompany.email && <p>{currentCompany.email}</p>}
        </div>
      )}
    </div>
  );
};

export const LetterheadFooter: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  if (!currentCompany) return null;

  return (
    <div className={`border-t border-slate-200 pt-3 mt-4 flex items-center justify-between text-xs text-slate-400 ${className}`}>
      <span>{language === "ar" ? currentCompany.nameAr || currentCompany.name : currentCompany.name}</span>
      <span className="text-center">{language === "ar" ? "مدعوم بـ صفقة" : "Powered by Safqa"}</span>
      <span>{new Date().toLocaleDateString()}</span>
    </div>
  );
};

export default Letterhead;
