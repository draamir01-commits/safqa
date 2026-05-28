import * as React from "react";
import {
  Users, UserPlus, ShieldCheck, Shield, Eye, Trash2, Mail,
  Crown, Clock, XCircle, CheckCircle, RefreshCw, AlertTriangle
} from "lucide-react";
import toast from "react-hot-toast";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { approveMember, rejectMember } from "../../firebase/firestore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { Member } from "../../types";

const MODULES = [
  { id: "invoices",   labelEn: "Invoices",          labelAr: "الفواتير" },
  { id: "customers",  labelEn: "Customers",          labelAr: "العملاء" },
  { id: "suppliers",  labelEn: "Suppliers",          labelAr: "الموردون" },
  { id: "products",   labelEn: "Products",           labelAr: "المنتجات" },
  { id: "bills",      labelEn: "Bills",              labelAr: "المشتريات" },
  { id: "expenses",   labelEn: "Expenses",           labelAr: "المصروفات" },
  { id: "income",     labelEn: "Income",             labelAr: "الإيرادات" },
  { id: "payroll",    labelEn: "Payroll",            labelAr: "الرواتب" },
  { id: "reports",    labelEn: "Reports",            labelAr: "التقارير" },
  { id: "projects",   labelEn: "Projects",           labelAr: "المشاريع" },
  { id: "journal",    labelEn: "Journal Entries",    labelAr: "القيود اليومية" },
  { id: "coa",        labelEn: "Chart of Accounts",  labelAr: "دليل الحسابات" },
];

type PermLevel = "none" | "read" | "write" | "both";

const ROLE_DEFAULTS: Record<string, Record<string, PermLevel>> = {
  manager: Object.fromEntries(MODULES.map(m => [m.id, "both" as PermLevel])),
  admin: Object.fromEntries(MODULES.map(m => [m.id, "both" as PermLevel])),
  accountant: Object.fromEntries(
    MODULES.map(m => [m.id, ["invoices","income","customers","suppliers","bills","expenses","reports","journal","coa"].includes(m.id) ? "both" : "read" as PermLevel])
  ),
  viewer: Object.fromEntries(
    MODULES.map(m => [m.id, ["invoices","income","customers","reports"].includes(m.id) ? "read" : "none" as PermLevel])
  ),
};

const roleIcon = (role: string) => {
  if (role === "owner")     return <Crown className="h-4 w-4 text-amber-500" />;
  if (role === "admin")     return <ShieldCheck className="h-4 w-4 text-blue-500" />;
  if (role === "manager")   return <Shield className="h-4 w-4 text-indigo-500" />;
  if (role === "accountant")return <Shield className="h-4 w-4 text-emerald-500" />;
  return <Eye className="h-4 w-4 text-slate-400" />;
};

const roleBadge = (role: string) => {
  if (role === "owner")      return "bg-amber-100 text-amber-800";
  if (role === "admin")      return "bg-blue-100 text-blue-800";
  if (role === "manager")    return "bg-indigo-100 text-indigo-800";
  if (role === "accountant") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
};

const statusBadge = (status: string) => {
  if (status === "active")   return "bg-emerald-100 text-emerald-700";
  if (status === "pending")  return "bg-amber-100 text-amber-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-600";
};

export const UserManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"active" | "pending" | "add">("active");
  const [showModal, setShowModal] = React.useState(false);

  // Add member form
  const [addName, setAddName]   = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [addRole, setAddRole]   = React.useState("viewer");
  const [addPerms, setAddPerms] = React.useState<Record<string, PermLevel>>(ROLE_DEFAULTS["viewer"]);

  React.useEffect(() => {
    if (!currentCompany) return;
    const unsub = onSnapshot(
      collection(db, "companies", currentCompany.id, "members"),
      snap => setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member)))
    );
    return () => unsub();
  }, [currentCompany]);

  // When role changes, reset permissions to defaults
  React.useEffect(() => {
    setAddPerms(ROLE_DEFAULTS[addRole] || ROLE_DEFAULTS["viewer"]);
  }, [addRole]);

  const myRole = members.find(m => m.uid === user?.uid)?.role;
  const isOwnerOrAdmin = myRole === "owner" || myRole === "admin";

  const activeMembers  = members.filter(m => m.status === "active"   || !m.status);
  const pendingMembers = members.filter(m => m.status === "pending");
  const rejectedMembers= members.filter(m => m.status === "rejected");

  const roleLabel = (role: string) => {
    const map: Record<string, [string, string]> = {
      owner:      ["مالك",   "Owner"],
      admin:      ["مدير",   "Admin"],
      manager:    ["مشرف",   "Manager"],
      accountant: ["محاسب",  "Accountant"],
      viewer:     ["مشاهد",  "Viewer"],
    };
    return map[role]?.[language === "ar" ? 0 : 1] || role;
  };

  const permLabel = (p: PermLevel) => {
    const map: Record<PermLevel, [string, string]> = {
      none:  ["لا شيء", "None"],
      read:  ["قراءة",  "Read"],
      write: ["كتابة", "Write"],
      both:  ["الكل",   "Full"],
    };
    return map[p]?.[language === "ar" ? 0 : 1] || p;
  };

  const handleAddDirect = async () => {
    if (!addName || !addEmail || !currentCompany) return;
    setLoading(true);
    try {
      const id = "m_" + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, "companies", currentCompany.id, "members", id), {
        name: addName,
        email: addEmail.toLowerCase().trim(),
        role: addRole,
        permissions: addPerms,
        status: "pending",
        addedAt: new Date(),
        addedBy: user?.uid,
      });
      toast.success(language === "ar" ? "تم إضافة العضو — في انتظار الموافقة" : "Member added — pending approval");
      setAddName(""); setAddEmail(""); setAddRole("viewer");
      setActiveTab("pending");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (member: Member) => {
    if (!currentCompany || !user) return;
    try {
      await approveMember(currentCompany.id, member.uid, user.uid);
      toast.success(language === "ar" ? "تمت الموافقة على العضو" : "Member approved");
    } catch {
      toast.error(language === "ar" ? "حدث خطأ" : "Something went wrong");
    }
  };

  const handleReject = async (member: Member) => {
    if (!currentCompany || !user) return;
    try {
      await rejectMember(currentCompany.id, member.uid, user.uid);
      toast.success(language === "ar" ? "تم رفض الطلب" : "Member rejected");
    } catch {
      toast.error(language === "ar" ? "حدث خطأ" : "Something went wrong");
    }
  };

  const handleReApprove = async (member: Member) => {
    if (!currentCompany || !user) return;
    try {
      await approveMember(currentCompany.id, member.uid, user.uid);
      toast.success(language === "ar" ? "تمت إعادة الموافقة" : "Member re-approved");
    } catch {
      toast.error(language === "ar" ? "حدث خطأ" : "Something went wrong");
    }
  };

  const updateRole = async (uid: string, role: string) => {
    if (!currentCompany) return;
    await updateDoc(doc(db, "companies", currentCompany.id, "members", uid), {
      role,
      permissions: ROLE_DEFAULTS[role] || ROLE_DEFAULTS["viewer"],
    });
    toast.success(language === "ar" ? "تم تحديث الدور" : "Role updated");
  };

  const removeMember = async (uid: string) => {
    if (!currentCompany || uid === user?.uid) {
      return toast.error(language === "ar" ? "لا يمكنك حذف نفسك" : "Cannot remove yourself");
    }
    await deleteDoc(doc(db, "companies", currentCompany.id, "members", uid));
    toast.success(language === "ar" ? "تم حذف العضو" : "Member removed");
  };

  const tabs = [
    { id: "active",  labelEn: `Active (${activeMembers.length})`,   labelAr: `نشط (${activeMembers.length})` },
    { id: "pending", labelEn: `Pending (${pendingMembers.length})`,  labelAr: `معلق (${pendingMembers.length})`, highlight: pendingMembers.length > 0 },
    { id: "add",     labelEn: "Add Member",                         labelAr: "إضافة عضو" },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "إدارة المستخدمين" : "User Management"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {language === "ar" ? "أعضاء الفريق والصلاحيات" : "Team members and permissions"}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: language === "ar" ? "إجمالي" : "Total",          value: members.length,                         cls: "text-slate-800" },
          { label: language === "ar" ? "نشط" : "Active",            value: activeMembers.length,                   cls: "text-emerald-600" },
          { label: language === "ar" ? "في الانتظار" : "Pending",   value: pendingMembers.length,                  cls: pendingMembers.length > 0 ? "text-amber-600" : "text-slate-400" },
          { label: language === "ar" ? "مرفوض" : "Rejected",        value: rejectedMembers.length,                 cls: rejectedMembers.length > 0 ? "text-red-500" : "text-slate-400" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending alert banner */}
      {pendingMembers.length > 0 && (
        <div
          onClick={() => setActiveTab("pending")}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-amber-100 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm font-semibold text-amber-800">
            {language === "ar"
              ? `${pendingMembers.length} طلب وصول في انتظار مراجعتك — انقر للمراجعة`
              : `${pendingMembers.length} access request${pendingMembers.length > 1 ? "s" : ""} awaiting your review — click to review`}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {language === "ar" ? tab.labelAr : tab.labelEn}
            {(tab as any).highlight && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-amber-500 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* ── ACTIVE MEMBERS ── */}
      {activeTab === "active" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {activeMembers.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              {language === "ar" ? "لا يوجد أعضاء نشطون" : "No active members yet"}
            </div>
          ) : activeMembers.map(m => (
            <div key={m.uid} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                  {(m.name || m.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.name || "—"}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Mail className="h-3 w-3" />{m.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge(m.role)}`}>
                  {roleIcon(m.role)} {roleLabel(m.role)}
                </span>
                {isOwnerOrAdmin && m.role !== "owner" && (
                  <>
                    <select
                      value={m.role}
                      onChange={e => updateRole(m.uid, e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none"
                    >
                      {["manager","admin","accountant","viewer"].map(r => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                    <button onClick={() => removeMember(m.uid)} className="p-1 text-slate-400 hover:text-red-500 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                {m.uid === user?.uid && (
                  <span className="text-xs text-slate-400 italic">({language === "ar" ? "أنت" : "you"})</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PENDING + REJECTED ── */}
      {activeTab === "pending" && (
        <div className="space-y-4">

          {/* Pending */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              {language === "ar" ? "في انتظار الموافقة" : "Awaiting Approval"}
            </p>
            {pendingMembers.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {language === "ar" ? "لا توجد طلبات معلقة" : "No pending requests"}
              </div>
            ) : pendingMembers.map(m => (
              <div key={m.uid} className="bg-white border border-amber-200 rounded-xl p-4 flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center font-bold text-amber-700 text-sm">
                    {(m.name || m.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{m.name || "—"}</p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${statusBadge("pending")}`}>
                      {language === "ar" ? "معلق" : "Pending"}
                    </span>
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {language === "ar" ? "موافقة" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleReject(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      {language === "ar" ? "رفض" : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Rejected */}
          {rejectedMembers.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                {language === "ar" ? "المرفوضون" : "Rejected"}
              </p>
              {rejectedMembers.map(m => (
                <div key={m.uid} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-600">{m.name || m.email}</p>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${statusBadge("rejected")}`}>
                      {language === "ar" ? "مرفوض" : "Rejected"}
                    </span>
                  </div>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleReApprove(m)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {language === "ar" ? "إعادة قبول" : "Re-approve"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ADD MEMBER ── */}
      {activeTab === "add" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl">
          <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-brand-primary" />
            {language === "ar" ? "إضافة عضو جديد" : "Add New Member"}
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={language === "ar" ? "الاسم الكامل" : "Full Name"}
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder={language === "ar" ? "مثال: أحمد محمد" : "e.g. Ahmed Mohamed"}
              />
              <Input
                label={language === "ar" ? "البريد الإلكتروني" : "Email"}
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="user@company.com"
              />
            </div>
            <Select
              label={language === "ar" ? "الدور" : "Role"}
              value={addRole}
              onChange={e => setAddRole(e.target.value)}
              options={[
                { value: "manager",    label: language === "ar" ? "مشرف"  : "Manager" },
                { value: "accountant", label: language === "ar" ? "محاسب" : "Accountant" },
                { value: "viewer",     label: language === "ar" ? "مشاهد" : "Viewer" },
              ]}
            />

            {/* Granular permissions */}
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-3">
                {language === "ar" ? "صلاحيات الوحدات" : "Module Permissions"}
              </p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <span className="col-span-2">{language === "ar" ? "الوحدة" : "Module"}</span>
                  <span className="text-center">{language === "ar" ? "مستوى الوصول" : "Access Level"}</span>
                  <span className="text-center">{language === "ar" ? "الحالة" : "Status"}</span>
                </div>
                {MODULES.map(mod => {
                  const perm = addPerms[mod.id] || "none";
                  return (
                    <div key={mod.id} className="grid grid-cols-4 items-center px-4 py-2.5 border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <span className="col-span-2 text-sm text-slate-700">
                        {language === "ar" ? mod.labelAr : mod.labelEn}
                      </span>
                      <select
                        value={perm}
                        onChange={e => setAddPerms(prev => ({ ...prev, [mod.id]: e.target.value as PermLevel }))}
                        className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-primary"
                      >
                        <option value="none">{permLabel("none")}</option>
                        <option value="read">{permLabel("read")}</option>
                        <option value="write">{permLabel("write")}</option>
                        <option value="both">{permLabel("both")}</option>
                      </select>
                      <span className={`text-xs font-semibold text-center px-2 py-0.5 rounded-full mx-auto ${
                        perm === "both"  ? "bg-emerald-100 text-emerald-700" :
                        perm === "write" ? "bg-blue-100 text-blue-700" :
                        perm === "read"  ? "bg-slate-100 text-slate-600" :
                                           "bg-slate-50 text-slate-400"
                      }`}>
                        {permLabel(perm)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                {language === "ar"
                  ? "سيتم إضافة العضو بحالة 'في الانتظار' — يجب الموافقة عليه قبل أن يتمكن من الدخول"
                  : "Member will be added as 'Pending' — you must approve them before they can log in"}
              </p>
            </div>

            <Button
              onClick={handleAddDirect}
              loading={loading}
              className="flex items-center gap-2 self-end"
            >
              <UserPlus className="h-4 w-4" />
              {language === "ar" ? "إضافة العضو" : "Add Member"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
