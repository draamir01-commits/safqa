import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Globe, Mail, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { loginWithEmail, loginWithGoogle } from "../../firebase/auth";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { language, setLanguage } = useUIStore();
  const { loadUserCompanies } = useCompanyStore();
  
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(language === "ar" ? "برجاء ملء جميع الحقول المطلوبة" : "Please complete all fields");
      return;
    }
    
    setLoading(true);
    try {
      const loggedUser = await loginWithEmail(email, password);
      toast.success(language === "ar" ? "أهلاً بك! تم الدخول بنجاح" : "Welcome back! Login successful");
      
      // Load user companies access mapping
      await loadUserCompanies(loggedUser.uid);
      navigate("/");
    } catch (err: any) {
      console.error("Login failed:", err);
      toast.error(language === "ar" ? "البريد الإلكتروني أو كلمة المرور غير صحيحة" : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // loginWithGoogle uses redirect on localhost — page will reload automatically
      // No need to handle the result here; App.tsx handles it via getRedirectResult
      await loginWithGoogle();
    } catch (err: any) {
      console.error("Google Auth failed:", err);
      toast.error(language === "ar" ? "تم إلغاء عملية المصادقة" : "Google Authentication cancelled");
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 relative p-4 font-sans">
      {/* Top language selector floating button */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="secondary" size="sm" onClick={toggleLanguage} className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {language === "ar" ? "English" : "العربية"}
        </Button>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-md p-6 flex flex-col gap-6 relative">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="p-2 rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="flex flex-col select-none">
            <span className="font-bold text-2xl text-slate-900 tracking-tight">Safqa</span>
            <span className="font-semibold text-xs text-slate-500 font-sans tracking-wide">صفقة</span>
          </div>
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">{t("auth.login")}</h2>
          <p className="text-xs text-slate-500 mt-1">Smart ZATCA Phase 1 & 2 compliant billing</p>
        </div>

        {/* Traditional Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            label={t("auth.email")}
            placeholder="user@saudibusiness.sa"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label={t("auth.password")}
            placeholder="******"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <Button type="submit" loading={loading} className="w-full py-2.5 mt-2 font-semibold">
            {t("auth.login")}
          </Button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-3 text-xs text-slate-400 uppercase">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        {/* Google Authentication */}
        <Button variant="secondary" onClick={handleGoogleLogin} className="w-full py-2.5 border-slate-300 font-semibold gap-2">
          <svg className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.253-3.133C18.256.745 15.424 0 12.24 0 5.582 0 0 5.37 0 12s5.582 12 12.24 12c6.96 0 11.57-4.814 11.57-11.79 0-.795-.084-1.398-.188-1.925H12.24z"
            />
          </svg>
          {t("auth.loginWithGoogle")}
        </Button>

        {/* Redirection Link */}
        <div className="text-center text-xs text-slate-500">
          <span>{t("auth.noAccount")} </span>
          <Link to="/register" className="font-semibold text-brand-primary hover:underline">
            {t("auth.register")}
          </Link>
        </div>
      </div>
    </div>
  );
};
export default LoginPage;
