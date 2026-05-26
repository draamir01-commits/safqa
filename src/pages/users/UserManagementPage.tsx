import * as React from "react";
import { Users, UserPlus, ShieldCheck, Shield, Eye, Trash2, Mail, Crown, Clock, XCircle, CheckCircle, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, where, query } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Modal from "../../components/ui/Modal";
import { Member } from "../../types";

const MODULES = [
  { id: "invoices", labelEn: "Invoices", labelAr: "الفواتير" },
  { id: "customers", labelEn: "Customers", labelAr: "العملاء" },
  { id: "suppliers", labelEn: "Suppliers", labelAr: "الموردون" },
  { id: "products", labelEn: "Products", labelAr: "المنتجات" },
  { id: "bills", labelEn: "Bills", labelAr: "المشتريات" },
  { id: "expenses", labelEn: "Expenses", labelAr: "المصروفات" },
  { id: "income", labelEn: "Income", labelAr: "الإيرادات" },
  { id: "payroll", labelEn: "Payroll", labelAr: "الرواتب" },
  { id: "reports", labelEn: "Reports", labelAr: "التقارير" },
  { id: "projects", labelEn: "Projects", labelAr: "المشاريع" },
  { id: "journal", labelEn: "Journal Entries", labelAr: "القيود اليومية" },
  { id: "coa", labelEn: "Chart of Accounts", labelAr: "دليل الحسابات" },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: MODULES.map(m => m.id),
  accountant: ["invoices","income","customers","suppliers","bills","expenses","reports","journal","coa"],
  viewer: ["invoices","income","customers","reports"],
};

const roleIcon = (role: string) => {
  if (role === "owner") return <Crown className="h-4 w-4 text-amber-500" />;
  if (role === "admin") return <ShieldCheck className="h-4 w-4 text-blue-500" />;
  if (role === "accountant") return <Shield className="h-4 w-4 text-emerald-500" />;
  return <Eye className="h-4 w-4 text-slate-400" />;
};

const roleBadge = (role: string) => {
  if (role === "owner") return "bg-amber-100 text-amber-800";
  if (role === "admin") return "bg-blue-100 text-blue-800";
  if (role === "accountant") return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-600";
};

export const UserManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [members, setMembers] = React.useState<Member[]>([]);
  const [invitations, setInvitations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"active" | "pending" | "add">("active");
  const [showModal, setShowModal] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("viewer");
  const [invitePerms, setInvitePerms] = React.useState<string[]>([]);
  const [addName, setAddName] = React.useState("");
  const [addEmail, setAddEmail] = React.useState("");
  const [addRole, setAddRole] = React.useState("viewer");

  React.useEffect(() => {
    if (!currentCompany) return;
    const u1 = onSnapshot(collection(db, "companies", currentCompany.id, "members"), snap =>
      setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as Member))));
    const u2 = onSnapshot(collection(db, "companies", currentCompany.id, "invitations"), snap =>
      setInvitations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); };
  }, [currentCompany]);

  React.useEffect(() => { setInvitePerms(ROLE_DEFAULTS[inviteRole] || []); }, [inviteRole]);

  const myRole = members.find(m => m.uid === user?.uid)?.role;
  const isOwner = myRole === "owner" || myRole === "admin";

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentCompany) return;
    setLoading(true);
    try {
      const id = "inv_" + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, "companies", currentCompany.id, "invitations", id), {
        email: inviteEmail.toLowerCase().trim(), role: inviteRole, permissions: invitePerms,
        status: "pending", invitedBy: user?.uid, invitedAt: new Date(),
        companyId: currentCompany.id, companyName: currentCompany.name,
      });
      toast.success(language === "ar" ? "تم إرسال الدعوة" : "Invitation sent");
      setShowModal(false); setInviteEmail("");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleAddDirect = async () => {
    if (!addName || !addEmail || !currentCompany) return;
    setLoading(true);
    try {
      const id = "direct_" + Math.random().toString(36).substr(2, 9);
      await setDoc(doc(db, "companies", currentCompany.id, "members", id), {
        name: addName, email: addEmail.toLowerCase().trim(), role: addRole,
        permissions: ROLE_DEFAULTS[addRole] || [],
        addedAt: new Date(), addedBy: user?.uid, status: "active",
      });
      toast.success(language === "ar" ? "تم إضافة العضو" : "Member added");
      setAddName(""); setAddEmail(""); setAddRole("viewer");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const updateRole = async (uid: string, role: string) => {
    if (!currentCompany) return;
    await updateDoc(doc(db, "companies", currentCompany.id, "members", uid), { role });
    toast.success(language === "ar" ? "تم تحديث الدور" : "Role updated");
  };

  const removeMember = async (uid: string) => {
    if (!currentCompany || uid === user?.uid) return toast.error(language === "ar" ? "لا يمكنك حذف نفسك" : "Cannot remove yourself");
    await deleteDoc(doc(db, "companies", currentCompany.id, "members", uid));
    toast.success(language === "ar" ? "تم الحذف" : "Member removed");
  };

  const approveInvitation = async (inv: any) => {
    if (!currentCompany) return;
    const memberId = "m_" + Math.random().toString(36).substr(2, 9);
    await setDoc(doc(db, "companies", currentCompany.id, "members", memberId), {
      email: inv.email, role: inv.role, permissions: inv.permissions || [],
      name: inv.email.split("@")[0], addedAt: new Date(), status: "active",
    });
    await updateDoc(doc(db, "companies", currentCompany.id, "invitations", inv.id), { status: "approved" });
    toast.success(language === "ar" ? "تمت الموافقة" : "Invitation approved");
  };

  const rejectInvitation = async (inv: any) => {
    if (!currentCompany) return;
    await updateDoc(doc(db, "companies", currentCompany.id, "invitations", inv.id), { status: "rejected" });
    toast.success(language === "ar" ? "تم الرفض" : "Invitation rejected");
  };

  const togglePerm = (id: string) => setInvitePerms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const roleLabel = (role: string) => {
    const map: Record<string, [string, string]> = { owner: ["مالك","Owner"], admin: ["مدير","Admin"], accountant: ["محاسب","Accountant"], viewer: ["مشاهد","Viewer"] };
    return map[role]?.[language === "ar" ? 0 : 1] || role;
  };

  const pendingInvites = invitations.filter(i => i.status === "pending");
  const rejectedInvites = invitations.filter(i => i.status === "rejected");

  const tabs = [
    { id: "active", labelEn: `Active (${members.length})`, labelAr: `نشط (${members.length})` },
    { id: "pending", labelEn: `Pending (${pendingInvites.length})`, labelAr: `معلق (${pendingInvites.length})`, highlight: pendingInvites.length > 0 },
    { id: "add", labelEn: "Add Member", labelAr: "إضافة عضو" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-primary" />
            {language === "ar" ? "إدارة المستخدمين" : "User Management"}
          </h2>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "أعضاء الفريق والصلاحيات" : "Team members and permissions"}</p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />{language === "ar" ? "دعوة عضو" : "Invite Member"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: language === "ar" ? "إجمالي" : "Total", value: members.length, cls: "text-slate-800" },
          { label: language === "ar" ? "مدراء" : "Admins", value: members.filter(m => m.role === "admin").length, cls: "text-blue-600" },
          { label: language === "ar" ? "محاسبون" : "Accountants", value: members.filter(m => m.role === "accountant").length, cls: "text-emerald-600" },
          { label: language === "ar" ? "دعوات معلقة" : "Pending Invites", value: pendingInvites.length, cls: pendingInvites.length > 0 ? "text-amber-600" : "text-slate-400" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`relative px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.id ? "border-brand-primary text-brand-primary" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
            {language === "ar" ? tab.labelAr : tab.labelEn}
            {(tab as any).highlight && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-amber-500 rounded-full" />}
          </button>
        ))}
      </div>

      {/* Active Members */}
      {activeTab === "active" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {members.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">{language === "ar" ? "لا يوجد أعضاء" : "No members yet"}</div>
          ) : members.map(m => (
            <div key={m.uid} className="flex items-center justify-between px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-sm">
                  {(m.name || m.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{m.name || "—"}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="h-3 w-3" />{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${roleBadge(m.role)}`}>
                  {roleIcon(m.role)} {roleLabel(m.role)}
                </span>
                {isOwner && m.role !== "owner" && (
                  <>
                    <select value={m.role} onChange={e => updateRole(m.uid, e.target.value)}
                      className="text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none">
                      {["admin","accountant","viewer"].map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                    <button onClick={() => removeMember(m.uid)} className="p-1 text-slate-400 hover:text-red-500 rounded"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
                {m.uid === user?.uid && <span className="text-xs text-slate-400 italic">({language === "ar" ? "أنت" : "you"})</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending Invitations */}
      {activeTab === "pending" && (
        <div className="space-y-3">
          {pendingInvites.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              {language === "ar" ? "لا توجد دعوات معلقة" : "No pending invitations"}
            </div>
          ) : pendingInvites.map(inv => (
            <div key={inv.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{inv.email}</p>
                <p className="text-xs text-slate-500 mt-0.5">{language === "ar" ? "الدور:" : "Role:"} {roleLabel(inv.role)} • {language === "ar" ? "أُرسلت:" : "Sent:"} {inv.invitedAt?.toDate?.().toLocaleDateString() || "—"}</p>
              </div>
              {isOwner && (
                <div className="flex gap-2">
                  <button onClick={() => approveInvitation(inv)} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors">
                    <CheckCircle className="h-3.5 w-3.5" />{language === "ar" ? "قبول" : "Approve"}
                  </button>
                  <button onClick={() => rejectInvitation(inv)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">
                    <XCircle className="h-3.5 w-3.5" />{language === "ar" ? "رفض" : "Reject"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {rejectedInvites.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{language === "ar" ? "الدعوات المرفوضة" : "Rejected Invitations"}</p>
              {rejectedInvites.map(inv => (
                <div key={inv.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between mb-2">
                  <p className="text-sm text-slate-500 line-through">{inv.email}</p>
                  <span className="text-xs text-red-500 font-semibold">{language === "ar" ? "مرفوض" : "Rejected"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Member Directly */}
      {activeTab === "add" && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><UserPlus className="h-5 w-5 text-brand-primary" />{language === "ar" ? "إضافة عضو مباشرة" : "Add Member Directly"}</h3>
          <div className="flex flex-col gap-4">
            <Input label={language === "ar" ? "الاسم الكامل" : "Full Name"} value={addName} onChange={e => setAddName(e.target.value)} placeholder={language === "ar" ? "مثال: أحمد محمد" : "e.g. John Smith"} />
            <Input label={language === "ar" ? "البريد الإلكتروني" : "Email"} type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="user@company.com" />
            <Select label={language === "ar" ? "الدور" : "Role"} value={addRole} onChange={e => setAddRole(e.target.value)}
              options={[{ value: "admin", label: language === "ar" ? "مدير" : "Admin" }, { value: "accountant", label: language === "ar" ? "محاسب" : "Accountant" }, { value: "viewer", label: language === "ar" ? "مشاهد" : "Viewer" }]} />
            <Button onClick={handleAddDirect} loading={loading} className="flex items-center gap-2 self-end">
              <UserPlus className="h-4 w-4" />{language === "ar" ? "إضافة العضو" : "Add Member"}
            </Button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={language === "ar" ? "دعوة عضو جديد" : "Invite New Member"}>
        <div className="flex flex-col gap-4">
          <Input label={language === "ar" ? "البريد الإلكتروني" : "Email"} type="email" placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
          <Select label={language === "ar" ? "الدور" : "Role"} value={inviteRole} onChange={e => setInviteRole(e.target.value)}
            options={[{ value: "admin", label: language === "ar" ? "مدير" : "Admin" }, { value: "accountant", label: language === "ar" ? "محاسب" : "Accountant" }, { value: "viewer", label: language === "ar" ? "مشاهد" : "Viewer" }]} />
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">{language === "ar" ? "الصلاحيات" : "Module Access"}</p>
            <div className="grid grid-cols-2 gap-2">
              {MODULES.map(mod => (
                <label key={mod.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={invitePerms.includes(mod.id)} onChange={() => togglePerm(mod.id)} className="rounded border-slate-300" />
                  {language === "ar" ? mod.labelAr : mod.labelEn}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>{language === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleInvite} loading={loading} className="flex items-center gap-2">
              <Mail className="h-4 w-4" />{language === "ar" ? "إرسال الدعوة" : "Send Invite"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default UserManagementPage;
