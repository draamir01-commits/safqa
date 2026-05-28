import * as React from "react";
import { ShieldAlert, LogOut, RefreshCw, Clock } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useUIStore } from "../../stores/uiStore";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuthStore } from "../../stores/authStore";
import toast from "react-hot-toast";

interface PendingApprovalScreenProps {
  status: "pending" | "rejected";
  companyName?: string;
}

export const PendingApprovalScreen: React.FC<PendingApprovalScreenProps> = ({ status, companyName }) => {
  const { language } = useUIStore();
  const { user } = useAuthStore();
  const [requesting, setRequesting] = React.useState(false);
  const isRejected = status === "rejected";

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/";
  };

  const handleReRequest = async () => {
    if (!user) return;
    setRequesting(true);
    try {
      // Find company member doc and reset status to pending
      // We search across companies the user might belong to via users doc
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        reRequestedAt: serverTimestamp(),
        memberStatus: "pending",
      });
      toast.success(
        language === "ar"
          ? "تم إعادة إرسال طلب الوصول بنجاح"
          : "Access re-request sent successfully"
      );
    } catch (err) {
      toast.error(language === "ar" ? "حدث خطأ، حاول مرة أخرى" : "Something went wrong, please try again");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg p-8 text-center">

        {/* Icon */}
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
          isRejected ? "bg-red-50" : "bg-amber-50"
        }`}>
          <ShieldAlert className={`h-8 w-8 ${isRejected ? "text-red-500" : "text-amber-500"}`} />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {isRejected
            ? (language === "ar" ? "تم رفض طلب الوصول" : "Access Request Rejected")
            : (language === "ar" ? "في انتظار موافقة المدير" : "Awaiting Admin Approval")}
        </h2>

        {/* Company name */}
        {companyName && (
          <p className="text-sm font-semibold text-brand-primary mb-3">{companyName}</p>
        )}

        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed mb-8">
          {isRejected
            ? (language === "ar"
                ? "تم رفض طلب وصولك من قبل مدير الشركة. يمكنك إعادة إرسال الطلب أو التواصل مع مدير الشركة مباشرة."
                : "Your access request was rejected by the company admin. You can re-request access or contact the company admin directly.")
            : (language === "ar"
                ? "تم إنشاء حسابك بنجاح. في انتظار تأكيد هويتك من قبل مدير الشركة قبل أن تتمكن من الوصول إلى النظام."
                : "Your account was created successfully. The company admin needs to verify your identity and approve your access before you can use the system.")}
        </p>

        {/* Pending indicator */}
        {!isRejected && (
          <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-700">
              {language === "ar" ? "في انتظار مراجعة المدير..." : "Waiting for admin review..."}
            </span>
            <span className="h-2 w-2 bg-amber-400 rounded-full animate-pulse" />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {isRejected && (
            <button
              onClick={handleReRequest}
              disabled={requesting}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold py-2.5 px-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`h-4 w-4 ${requesting ? "animate-spin" : ""}`} />
              {language === "ar" ? "إعادة إرسال طلب الوصول" : "Re-request Access"}
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 text-slate-600 font-semibold py-2.5 px-4 rounded-xl hover:bg-slate-200 transition-colors text-sm"
          >
            <LogOut className="h-4 w-4" />
            {language === "ar" ? "تسجيل الخروج" : "Sign Out"}
          </button>
        </div>

        <p className="text-xs text-slate-300 mt-6 font-mono">
          UID: {user?.uid?.slice(0, 12)}...
        </p>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;
