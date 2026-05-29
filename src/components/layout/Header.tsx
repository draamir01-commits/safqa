import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { logout } from "../../firebase/auth";
import { LogOut, Menu, User, Shield } from "lucide-react";
import { NotificationCenter } from "../ui/NotificationCenter";

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentCompany, companies, setCurrentCompany } = useCompanyStore();
  const { language, setLanguage, toggleSidebar } = useUIStore() as any;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white px-4 md:px-6 flex items-center justify-between font-sans shadow-sm select-none shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={toggleSidebar} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 transition-colors">
          <Menu className="h-5 w-5" />
        </button>
        {companies.length > 0 && (
          <select
            className="bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer text-slate-700 max-w-[160px]"
            value={currentCompany?.id || ""}
            onChange={(e) => {
              const switched = companies.find((c: any) => c.id === e.target.value);
              if (switched) setCurrentCompany(switched);
            }}
          >
            {companies.map((c: any) => (
              <option key={c.id} value={c.id}>{language === "ar" ? c.nameAr || c.name : c.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <span className="hidden md:inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
          SANDBOX | تجريبي
        </span>

        {/* SuperAdmin button — only visible to dr.aamir01@gmail.com */}
        {user?.email === "dr.aamir01@gmail.com" && (
          <button
            onClick={() => navigate("/superadmin")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
            title="Super Admin Panel"
          >
            <Shield className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Super Admin</span>
          </button>
        )}

        <NotificationCenter />

        <div className="relative group">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all">
            <span className="text-base leading-none">{language === "ar" ? "🇸🇦" : "🇬🇧"}</span>
            <span className="hidden sm:inline">{language === "ar" ? "العربية" : "English"}</span>
            <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className="absolute top-full mt-1 end-0 w-36 bg-white rounded-md border border-slate-200 shadow-lg z-50 hidden group-hover:block">
            <button onClick={() => setLanguage("ar")} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${language === "ar" ? "text-brand-primary" : "text-slate-700"}`}>
              <span className="text-base">🇸🇦</span> العربية {language === "ar" && <span className="ms-auto">✓</span>}
            </button>
            <button onClick={() => setLanguage("en")} className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${language === "en" ? "text-brand-primary" : "text-slate-700"}`}>
              <span className="text-base">🇬🇧</span> English {language === "en" && <span className="ms-auto">✓</span>}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 ps-2 border-s border-slate-200">
          <div className="h-8 w-8 rounded-full bg-slate-100 border flex items-center justify-center text-slate-600 overflow-hidden">
            {currentCompany?.logo ? (
              <img src={currentCompany.logo} alt="logo" className="h-full w-full object-contain" />
            ) : <User className="h-4 w-4" />}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="text-xs font-semibold text-slate-800">{user?.displayName || "User"}</span>
            <span className="text-[10px] text-slate-400">{language === "ar" ? "مالك" : "Owner"}</span>
          </div>
          <button onClick={handleLogout} className="p-1 text-slate-400 hover:text-brand-danger hover:bg-red-50 rounded-md transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
export default Header;
