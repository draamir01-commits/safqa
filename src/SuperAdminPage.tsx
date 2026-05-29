import * as React from "react";
import { Shield, Users, Building2, TrendingUp, AlertCircle, CheckCircle, XCircle, RefreshCw, Search, LogOut, ArrowLeft } from "lucide-react";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "./firebase/config";
import { useAuthStore } from "./stores/authStore";
import { useUIStore } from "./stores/uiStore";
import { logout } from "./firebase/auth";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "./utils/formatters";

const SUPER_ADMIN_EMAILS = ["dr.aamir01@gmail.com"];

interface CompanyData {
  id: string;
  name: string;
  nameAr: string;
  vatNumber: string;
  crNumber: string;
  email: string;
  city: string;
  plan: string;
  status: string;
  memberCount: number;
  invoiceCount: number;
  createdAt: any;
}

export const SuperAdminPage: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useUIStore();
  const navigate = useNavigate();
  const [companies, setCompanies] = React.useState<CompanyData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [stats, setStats] = React.useState({ total: 0, active: 0, totalInvoices: 0, totalMembers: 0 });

  const isSuperAdmin = user && SUPER_ADMIN_EMAILS.includes(user.email || "");

  React.useEffect(() => {
    if (!isSuperAdmin) return;
    loadAllCompanies();
  }, [isSuperAdmin]);

  const loadAllCompanies = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "companies"));
      const data: CompanyData[] = [];
      for (const d of snap.docs) {
        const company = d.data();
        const membersSnap = await getDocs(collection(db, "companies", d.id, "members"));
        const invoicesSnap = await getDocs(collection(db, "companies", d.id, "invoices"));
        data.push({
          id: d.id, name: company.name || "—", nameAr: company.nameAr || "—",
          vatNumber: company.vatNumber || "—", crNumber: company.crNumber || "—",
          email: company.email || "—", city: company.city || "—",
          plan: company.plan || "trial", status: company.status || "active",
          memberCount: membersSnap.size, invoiceCount: invoicesSnap.size,
          createdAt: company.createdAt,
        });
      }
      data.sort((a, b) => {
        const ta = a.createdAt?.seconds || 0;
        const tb = b.createdAt?.seconds || 0;
        return tb - ta;
      });
      setCompanies(data);
      setStats({
        total: data.length,
        active: data.filter(c => c.status === "active").length,
        totalInvoices: data.reduce((s, c) => s + c.invoiceCount, 0),
        totalMembers: data.reduce((s, c) => s + c.memberCount, 0),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (companyId: string, status: string) => {
    await updateDoc(doc(db, "companies", companyId), { status });
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, status } : c));
  };

  const handleLogout = async () => { await logout(); navigate("/login"); };

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.vatNumber.includes(search)
  );

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-slate-400">You do not have Super Admin privileges.</p>
          <button onClick={() => navigate("/")} className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-lg">Go Home</button>
        </div>
      </div>
    );
  }

  const planColor: Record<string, string> = {
    trial: "bg-slate-100 text-slate-600", starter: "bg-blue-100 text-blue-700",
    growth: "bg-emerald-100 text-emerald-700", professional: "bg-purple-100 text-purple-700",
    enterprise: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="min-h-screen bg-slate-900 font-sans">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-500 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white">Safqa Super Admin</h1>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadAllCompanies} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-sm font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors text-sm">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Companies", value: stats.total, icon: Building2, color: "text-blue-400" },
            { label: "Active Companies", value: stats.active, icon: CheckCircle, color: "text-emerald-400" },
            { label: "Total Invoices", value: stats.totalInvoices, icon: TrendingUp, color: "text-purple-400" },
            { label: "Total Users", value: stats.totalMembers, icon: Users, color: "text-amber-400" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                  <Icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or VAT number..."
            className="w-full ps-10 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-primary" />
        </div>

        {/* Companies Table */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">All Companies ({filtered.length})</h2>
            {loading && <RefreshCw className="h-4 w-4 text-slate-400 animate-spin" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  {["Company", "VAT Number", "City", "Plan", "Members", "Invoices", "Status", "Actions"].map((h, i) =>
                    <th key={i} className="px-4 py-3 text-xs font-semibold text-slate-400 text-start">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-slate-500">No companies found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-slate-750 transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.nameAr}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{c.vatNumber}</td>
                    <td className="px-4 py-3 text-slate-300 text-xs">{c.city}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${planColor[c.plan] || planColor.trial}`}>
                        {c.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-center">{c.memberCount}</td>
                    <td className="px-4 py-3 text-slate-300 text-center">{c.invoiceCount}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 text-xs font-semibold ${c.status === "active" ? "text-emerald-400" : c.status === "suspended" ? "text-red-400" : "text-amber-400"}`}>
                        {c.status === "active" ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {c.status === "active" ? (
                          <button onClick={() => handleStatusChange(c.id, "suspended")}
                            className="px-2 py-1 text-[10px] font-semibold bg-red-900/50 text-red-400 border border-red-800 rounded-lg hover:bg-red-900 transition-colors">
                            Suspend
                          </button>
                        ) : (
                          <button onClick={() => handleStatusChange(c.id, "active")}
                            className="px-2 py-1 text-[10px] font-semibold bg-emerald-900/50 text-emerald-400 border border-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors">
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SuperAdminPage;
