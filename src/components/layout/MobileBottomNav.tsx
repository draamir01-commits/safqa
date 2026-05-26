import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, FileText, Users, CreditCard, Layers } from "lucide-react";

export const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const activePath = location.pathname;

  const items = [
    { path: "/", label: t("nav.dashboard"), icon: Home },
    { path: "/invoices", label: t("nav.invoices"), icon: FileText },
    { path: "/customers", label: t("nav.customers"), icon: Users },
    { path: "/expenses", label: t("nav.expenses"), icon: CreditCard },
    { path: "/settings", label: t("nav.settings"), icon: Layers }
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around px-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] select-none font-sans">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isActive = activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path));
        return (
          <Link
            key={idx}
            to={item.path}
            className={`flex flex-col items-center justify-center p-2 rounded-md min-w-[50px] transition-colors ${
              isActive
                ? "text-brand-primary font-bold"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="text-[10px] truncate mt-1 leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
export default MobileBottomNav;
