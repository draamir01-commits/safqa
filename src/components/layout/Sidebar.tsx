import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home, FileText, Users, Package, CreditCard, Wallet,
  UserSquare2, BarChart3, Building, Settings, FileSpreadsheet,
  ShieldAlert, UserCog, ShoppingCart, Truck, ClipboardList,
  Scale, PieChart, Banknote, Building2, Briefcase, CalendarCheck,
  TrendingUp, ChevronLeft, ChevronRight, ChevronDown
} from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const { sidebarOpen, language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const activePath = location.pathname;

  // collapsed = icon-only mode
  const [collapsed, setCollapsed] = React.useState(false);

  const groups = [
    { title: language === "ar" ? "الرئيسية" : "Overview",
      items: [{ path: "/", label: language === "ar" ? "لوحة التحكم" : "Dashboard", icon: Home }] },
    { title: language === "ar" ? "المبيعات والإيرادات" : "Sales & Revenue",
      items: [
        { path: "/income",           label: language === "ar" ? "الإيرادات" : "Income",           icon: TrendingUp },
        { path: "/quotations",       label: language === "ar" ? "عروض الأسعار" : "Quotations",    icon: ClipboardList },
        { path: "/invoices",         label: language === "ar" ? "الفواتير" : "Invoices",           icon: FileText },
        { path: "/delivery-notes",   label: language === "ar" ? "مذكرات التسليم" : "Delivery Notes", icon: Truck },
        { path: "/customers",        label: language === "ar" ? "العملاء" : "Customers",           icon: Users },
        { path: "/client-statement", label: language === "ar" ? "كشف حساب العميل" : "Client Statement", icon: FileSpreadsheet },
      ]},
    { title: language === "ar" ? "المشتريات" : "Purchases",
      items: [
        { path: "/purchase-orders", label: language === "ar" ? "أوامر الشراء" : "Purchase Orders", icon: ShoppingCart },
        { path: "/bills",           label: language === "ar" ? "فواتير الموردين" : "Bills",         icon: FileSpreadsheet },
        { path: "/expenses",        label: language === "ar" ? "المصروفات" : "Expenses",            icon: CreditCard },
        { path: "/overheads",       label: language === "ar" ? "المصاريف الثابتة" : "Overheads",   icon: Building2 },
        { path: "/suppliers",       label: language === "ar" ? "الموردون" : "Suppliers",            icon: Building },
      ]},
    { title: language === "ar" ? "المستودع والمشاريع" : "Inventory & Projects",
      items: [
        { path: "/products", label: language === "ar" ? "المنتجات والخدمات" : "Products", icon: Package },
        { path: "/projects", label: language === "ar" ? "المشاريع" : "Projects",           icon: Briefcase },
      ]},
    { title: language === "ar" ? "الموارد البشرية" : "HR",
      items: [
        { path: "/payroll",    label: language === "ar" ? "الرواتب والموظفون" : "Payroll & Employees", icon: UserSquare2 },
        { path: "/attendance", label: language === "ar" ? "الحضور والغياب" : "Attendance",            icon: CalendarCheck },
      ]},
    { title: language === "ar" ? "المحاسبة" : "Accounting",
      items: [
        { path: "/chart-of-accounts",  label: language === "ar" ? "دليل الحسابات" : "Chart of Accounts", icon: Wallet },
        { path: "/journal-entries",    label: language === "ar" ? "القيود اليومية" : "Journal Entries",   icon: FileText },
        { path: "/petty-cash",         label: language === "ar" ? "الصندوق النثري" : "Petty Cash",        icon: Banknote },
        { path: "/partner-ledger",     label: language === "ar" ? "دفتر أستاذ" : "Partner Ledger",        icon: Scale },
        { path: "/profit-distribution",label: language === "ar" ? "توزيع الأرباح" : "Profit Distribution",icon: PieChart },
      ]},
    { title: language === "ar" ? "التقارير والامتثال" : "Reports",
      items: [
        { path: "/reports",      label: language === "ar" ? "التقارير المالية" : "Financial Reports", icon: BarChart3 },
        { path: "/vat-returns",  label: language === "ar" ? "الإقرار الضريبي" : "VAT Returns",       icon: ShieldAlert },
      ]},
    { title: language === "ar" ? "الإدارة" : "Admin",
      items: [
        { path: "/users",    label: language === "ar" ? "المستخدمون" : "Users",    icon: UserCog },
        { path: "/settings", label: language === "ar" ? "الإعدادات" : "Settings",  icon: Settings },
      ]},
  ];

  // Determine which group contains the active path
  const activeGroupIndex = React.useMemo(() => {
    return groups.findIndex(g => g.items.some(item =>
      activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path))
    ));
  }, [activePath]);

  // Track open/closed state per group — active group starts open, others closed
  const [openGroups, setOpenGroups] = React.useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    groups.forEach((_, i) => { init[i] = i === activeGroupIndex; });
    return init;
  });

  // When active path changes, open the group that contains the new active page
  React.useEffect(() => {
    if (activeGroupIndex !== -1) {
      setOpenGroups(prev => ({ ...prev, [activeGroupIndex]: true }));
    }
  }, [activeGroupIndex]);

  const toggleGroup = (i: number) => {
    setOpenGroups(prev => ({ ...prev, [i]: !prev[i] }));
  };

  if (!sidebarOpen) return null;

  return (
    <aside
      className="bg-[#0F172A] text-[#CBD5E1] border-r border-[#1E293B] shrink-0 font-sans flex flex-col h-full overflow-y-auto select-none transition-all duration-300"
      style={{ width: collapsed ? "56px" : "224px" }}
    >
      {/* Header */}
      <div className="px-3 py-4 flex items-center justify-between border-b border-[#1E293B] bg-[#090D16] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-brand-primary flex items-center justify-center font-bold text-white text-sm shrink-0">ص</div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm text-white tracking-wide leading-tight">Safqa</h1>
              <p className="text-[9px] text-emerald-500 font-medium truncate">{currentCompany?.nameAr || currentCompany?.name || "صفقة"}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white transition-colors shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Nav groups */}
      <div className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {groups.map((grp, gi) => {
          const isOpen = openGroups[gi] ?? false;
          const hasActive = grp.items.some(item =>
            activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path))
          );

          return (
            <div key={gi}>
              {/* Group header button */}
              <button
                onClick={() => !collapsed && toggleGroup(gi)}
                className={`w-full flex items-center px-3 py-1.5 transition-colors ${
                  collapsed ? "justify-center" : "justify-between"
                } ${hasActive ? "text-white" : "text-slate-500 hover:text-slate-300"}`}
                title={collapsed ? grp.title : undefined}
              >
                {!collapsed && (
                  <span className="text-[9px] font-bold uppercase tracking-widest truncate">
                    {grp.title}
                  </span>
                )}
                {collapsed && (
                  <div className="h-px w-4 bg-slate-700" />
                )}
                {!collapsed && (
                  <ChevronDown
                    className="h-3 w-3 shrink-0 transition-transform duration-200"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                )}
              </button>

              {/* Group items */}
              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: collapsed ? "999px" : isOpen ? "999px" : "0px" }}
              >
                {grp.items.map((item, ii) => {
                  const Icon = item.icon;
                  const isActive = activePath === item.path || (item.path !== "/" && activePath.startsWith(item.path));
                  return (
                    <Link
                      key={ii}
                      to={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center transition-all text-xs font-medium rounded-md mx-1.5 my-0.5 ${
                        collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-1.5"
                      } ${
                        isActive
                          ? "bg-brand-primary text-white"
                          : "hover:bg-slate-800 hover:text-white text-slate-400"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
