import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { registerWithEmail } from "../../firebase/auth";
import { useUIStore } from "../../stores/uiStore";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { language, setLanguage } = useUIStore();
  
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please complete all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error(language === "ar" ? "كلمات المرور غير متطابقة" : "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      toast.error(language === "ar" ? "كلمة المرور يجب أن تكون 6 خانات على الأقل" : "Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      await registerWithEmail(email, password, fullName);
      toast.success(language === "ar" ? "تم تسجيل الحساب بنجاح! مرحباً بك" : "Account registered successfully! Welcome");
      navigate("/onboarding");
    } catch (err: any) {
      console.error("Register failed:", err);
      toast.error(language === "ar" ? "فشل التسجيل. البريد الإلكتروني مسجل بالفعل" : "Registration failed. Email are already in use");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 relative p-4 font-sans">
      {/* Language Trigger */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <Button variant="secondary" size="sm" onClick={toggleLanguage} className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {language === "ar" ? "English" : "العربية"}
        </Button>
      </div>

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-md p-6 flex flex-col gap-6 relative">
        {/* Brand */}
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
          <h2 className="text-xl font-bold text-slate-800">{t("auth.register")}</h2>
          <p className="text-xs text-slate-500 mt-1">Start e-invoicing today and avoid hefty ZATCA penalties</p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <Input
            label={t("auth.fullName")}
            placeholder="Aamir Al-Sudari"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
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
          <Input
            label={t("auth.confirmPassword")}
            placeholder="******"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          
          <Button type="submit" loading={loading} className="w-full py-2.5 mt-2 font-semibold">
            {t("auth.register")}
          </Button>
        </form>

        <div className="text-center text-xs text-slate-500">
          <span>{t("auth.hasAccount")} </span>
          <Link to="/login" className="font-semibold text-brand-primary hover:underline">
            {t("auth.login")}
          </Link>
        </div>
      </div>
    </div>
  );
};
export default RegisterPage;
