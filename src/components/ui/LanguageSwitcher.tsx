import * as React from "react";
import { Globe } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = "" }) => {
  const { language, setLanguage } = useUIStore();

  return (
    <button
      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm ${className}`}
    >
      <Globe className="h-4 w-4 text-slate-400" />
      <span>{language === "ar" ? "English" : "العربية"}</span>
    </button>
  );
};

export default LanguageSwitcher;
