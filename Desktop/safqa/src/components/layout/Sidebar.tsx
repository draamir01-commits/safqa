import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, FileText, Users, Package, CreditCard, Wallet,
  UserSquare2, BarChart3, Building, Settings, FileSpreadsheet,
  ShieldAlert, UserCog, ShoppingCart, Truck, ClipboardList,
  Scale, PieChart, Banknote, Building2, Briefcase, CalendarCheck,
  TrendingUp
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { sidebarOpen, language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const activePath = location.pathname;

  const groups = [
    { title: language === "ar" ? "الرئيسية" : "Overview",
      items: [{ path: "/", label: language === "ar" ? "لوحة التحكم" : "Dashboard", icon: Home }] },
    { title: language === "ar" ? "المبيعات والإيرادات" : "Sales & Revenue",
      items: [
        { path: "/income", label: language === "ar" ? "الإيرادات" : "Income", icon: TrendingUp },
        { path: "/quotations", label: language === "ar" ? "عروض الأسعار" : "Quotations", icon: ClipboardList },
        { path: "/invoices", label: language === "ar" ? "الفواتير" : "Invoices", icon: FileText },
        { path: "/delivery-notes", label: language === "ar" ? "مذكرات التسليم" : "Delivery Notes", icon: Truck },
        { path: "/customers", label: language === "ar" ? "العملاء" : "Customers", icon: Users },
        { path: "/client-statement", label: language === "ar" ? "كشف حساب العميل" : "Client Statement", icon: FileSpreadsheet },
      ]},
    { title: language === "ar" ? "المشتريات" : "Purchases",
      items: [
        { path: "/purchase-orders", label: language === "ar" ? "أوامر الشراء" : "Purchase Orders", icon: ShoppingCart },
        { path: "/bills", label: language === "ar" ? "فواتير الموردين" : "Bills", icon: FileSpreadsheet },
        { path: "/expenses", label: language === "ar" ? "المصروفات" : "Expenses", icon: CreditCard },
        { path: "/overheads", label: language === "ar" ? "المصاريف الثابتة" : "Overheads", icon: Building2 },
        { path: "/suppliers", label: language === "ar" ? "الموردون" : "Suppliers", icon: Building },
      ]},
    { title: language === "ar" ? "المستودع والمشاريع" : "Inventory & Projects",
      items: [
        { path: "/products", label: language === "ar" ? "المنتجات والخدمات" : "Products", icon: Package },
        { path: "/projects", label: language === "ar" ? "المشاريع" : "Projects", icon: Briefcase },
      ]},
    { title: language === "ar" ? "الموارد البشرية" : "HR",
      items: [
        { path: "/payroll", label: language === "ar" ? "الرواتب والموظفون" : "Payroll & Employees", icon: UserSquare2 },
        { path: "/attendance", label: language === "ar" ? "الحضور والغياب" : "Attendance", icon: CalendarCheck },
      ]},
    { title: language === "ar" ? "المحاسبة" : "Accounting",
      items: [
        { path: "/chart-of-accounts", label: language === "ar" ? "دليل الحسابات" : "Chart of Accounts", icon: Wallet },
        { path: "/journal-entries", label: language === "ar" ? "القيود اليومية" : "Journal Entries", icon: FileText },
        { path: "/petty-cash", label: language === "ar" ? "الصندوق النثري" : "Petty Cash", icon: Banknote },
        { path: "/partner-ledger", label: language === "ar" ? "دفتر أستاذ" : "Partner Ledger", icon: Scale },
        { path: "/profit-distribution", label: language === "ar" ? "توزيع الأرباح" : "Profit Distribution", icon: PieChart },
      ]},
    { title: language === "ar" ? "التقارير والامتثال" : "Reports",
      items: [
        { path: "/reports", label: language === "ar" ? "التقارير المالية" : "Financial Reports", icon: BarChart3 },
        { path: "/vat-returns", label: language === "ar" ? "الإقرار الضريبي" : "VAT Returns", icon: ShieldAlert },
      ]},
    { title: language === "ar" ? "الإدارة" : "Admin",
      items: [
        { path: "/users", label: language === "ar" ? "المستخدمون" : "Users", icon: UserCog },
        { path: "/settings", label: language === "ar" ? "الإعدادات" : "Settings", icon: Settings },
      ]},
  ];

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 bg-[#0F172A] text-[#CBD5E1] border-r border-[#1E293B] shrink-0 font-sans flex flex-col h-full overflow-y-auto select-none">
      <div className="px-6 py-5 flex items-center gap-3 border-b border-[#1E293B] bg-[#090D16]">
        <div className="h-8 w-8 rounded-full bg-brand-primary flex items-center justify-center font-bold text-white text-base">ص</div>
        <div>
          <h1 className="font-bold text-md text-white tracking-wide">Safqa</h1>
          <p className="text-[10px] text-emerald-500 font-medium">{currentCompany?.nameAr || currentCompany?.name || "صفقة"}</p>
        </div>
      </div>
      <div className="flex-1 px-3 py-3 space-y-3">
        {groups.map((grp, gi) => (
          <div key={gi} className="space-y-0.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block px-2 mb-0.5">{grp.title}</span>
            {grp.items.map((item, ii) => {
              const Icon = item.icon;
              const isActive = activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path));
              return (
                <Link key={ii} to={item.path}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md transition-all text-xs font-medium ${isActive ? "bg-brand-primary text-white" : "hover:bg-slate-800 hover:text-white text-slate-400"}`}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};
export default Sidebar;
