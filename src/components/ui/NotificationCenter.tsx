import * as React from "react";
import { Bell, X, AlertCircle, CheckCircle2, Clock, FileText, CreditCard, Users, Package, ShieldAlert } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, addDoc, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";

interface AppNotification {
  id: string;
  type: "overdue" | "invoice" | "payroll" | "vat" | "stock" | "info" | "warning";
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  read: boolean;
  priority: "high" | "medium" | "low";
  createdAt: any;
  link?: string;
}

const typeIcon = (type: string) => {
  const icons: Record<string, React.ReactNode> = {
    overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
    invoice: <FileText className="h-4 w-4 text-blue-500" />,
    payroll: <Users className="h-4 w-4 text-emerald-500" />,
    vat: <ShieldAlert className="h-4 w-4 text-amber-500" />,
    stock: <Package className="h-4 w-4 text-orange-500" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
    info: <CheckCircle2 className="h-4 w-4 text-slate-400" />,
  };
  return icons[type] || icons.info;
};

export const NotificationCenter: React.FC = () => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!currentCompany) return;
    const q = query(collection(db, "companies", currentCompany.id, "notifications"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))));
    return unsub;
  }, [currentCompany]);

  // Auto-generate system notifications
  React.useEffect(() => {
    if (!currentCompany) return;
    const checkAndNotify = async () => {
      const now = new Date();
      const nRef = collection(db, "companies", currentCompany.id, "notifications");

      // Check overdue invoices
      const invSnap = await getDocs(collection(db, "companies", currentCompany.id, "invoices"));
      const overdueInvoices = invSnap.docs.filter(d => {
        const data = d.data();
        return data.status === "issued" && data.dueDate && new Date(data.dueDate) < now;
      });
      if (overdueInvoices.length > 0) {
        const existing = await getDocs(query(nRef, where("type","==","overdue"), where("read","==",false)));
        if (existing.empty) {
          await addDoc(nRef, {
            type: "overdue", priority: "high", read: false,
            titleEn: `${overdueInvoices.length} Overdue Invoice(s)`,
            titleAr: `${overdueInvoices.length} فاتورة متأخرة`,
            messageEn: `You have ${overdueInvoices.length} invoice(s) past their due date.`,
            messageAr: `لديك ${overdueInvoices.length} فاتورة تجاوزت تاريخ الاستحقاق.`,
            createdAt: new Date(), link: "/invoices",
          });
        }
      }

      // Check low stock
      const prodSnap = await getDocs(collection(db, "companies", currentCompany.id, "products"));
      const lowStock = prodSnap.docs.filter(d => {
        const data = d.data();
        return data.trackInventory && data.stockQty <= (data.lowStockThreshold || 5);
      });
      if (lowStock.length > 0) {
        const existing = await getDocs(query(nRef, where("type","==","stock"), where("read","==",false)));
        if (existing.empty) {
          await addDoc(nRef, {
            type: "stock", priority: "medium", read: false,
            titleEn: `${lowStock.length} Product(s) Low Stock`,
            titleAr: `${lowStock.length} منتج منخفض المخزون`,
            messageEn: `${lowStock.length} product(s) are below minimum stock level.`,
            messageAr: `${lowStock.length} منتج أقل من الحد الأدنى للمخزون.`,
            createdAt: new Date(), link: "/products",
          });
        }
      }
    };
    checkAndNotify();
  }, [currentCompany]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = notifications.filter(n => !n.read).length;
  const highPriority = notifications.filter(n => !n.read && n.priority === "high").length;

  const markRead = async (id: string) => {
    if (!currentCompany) return;
    await updateDoc(doc(db, "companies", currentCompany.id, "notifications", id), { read: true });
  };

  const markAllRead = async () => {
    if (!currentCompany) return;
    await Promise.all(notifications.filter(n => !n.read).map(n =>
      updateDoc(doc(db, "companies", currentCompany.id, "notifications", n.id), { read: true })
    ));
  };

  const timeAgo = (ts: any) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return language === "ar" ? "الآن" : "just now";
    if (diff < 3600) return language === "ar" ? `${Math.floor(diff/60)} دقيقة` : `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return language === "ar" ? `${Math.floor(diff/3600)} ساعة` : `${Math.floor(diff/3600)}h ago`;
    return language === "ar" ? `${Math.floor(diff/86400)} يوم` : `${Math.floor(diff/86400)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className={`absolute top-0.5 right-0.5 h-4 w-4 ${highPriority > 0 ? "bg-red-500" : "bg-brand-primary"} text-white text-[9px] font-bold rounded-full flex items-center justify-center`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 w-84 bg-white border border-slate-200 rounded-xl shadow-xl z-50" style={{ width: "340px" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-sm text-slate-800">
              {language === "ar" ? "الإشعارات" : "Notifications"}
              {unread > 0 && <span className={`ms-2 px-1.5 py-0.5 ${highPriority > 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"} text-xs rounded-full font-bold`}>{unread}</span>}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-primary hover:underline font-semibold">
                {language === "ar" ? "تعليم الكل مقروء" : "Mark all read"}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {language === "ar" ? "لا توجد إشعارات" : "No notifications"}
              </div>
            ) : notifications.map(n => (
              <div key={n.id} onClick={() => markRead(n.id)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.read ? "bg-blue-50/40" : ""}`}>
                <div className="mt-0.5 shrink-0 p-1.5 rounded-lg bg-slate-100">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold text-slate-800 ${!n.read ? "font-bold" : ""}`}>
                    {language === "ar" ? n.titleAr : n.titleEn}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {language === "ar" ? n.messageAr : n.messageEn}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />{timeAgo(n.createdAt)}
                  </p>
                </div>
                {!n.read && <div className={`h-2 w-2 ${n.priority === "high" ? "bg-red-500" : "bg-brand-primary"} rounded-full mt-1.5 shrink-0`} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
