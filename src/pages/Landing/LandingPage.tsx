import * as React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, FileText, BarChart3, Users, Zap, Globe,
  CheckCircle, ArrowRight, Star, Building2, TrendingUp,
  Receipt, Package, Clock, Award, ChevronDown
} from "lucide-react";

const PLANS = [
  {
    id: "trial", nameEn: "Free Trial", nameAr: "تجربة مجانية",
    price: 0, priceYear: 0, popular: false,
    descEn: "15-day full access", descAr: "15 يوم وصول كامل",
    features: ["50 invoices/month","3 users","ZATCA Phase 1","AI scanning","Excel/PDF export"],
  },
  {
    id: "starter", nameEn: "Starter", nameAr: "المبتدئ",
    price: 99, priceYear: 990, popular: false,
    descEn: "Freelancers & micro businesses", descAr: "المستقلون والمشاريع الصغيرة",
    features: ["50 invoices/month","2 users","ZATCA Phase 1","Excel/PDF export","Customers & Suppliers"],
  },
  {
    id: "growth", nameEn: "Growth", nameAr: "النمو",
    price: 249, priceYear: 2490, popular: false,
    descEn: "Small businesses & trading companies", descAr: "الشركات الصغيرة والتجارية",
    features: ["200 invoices/month","5 users","ZATCA Phase 1","AI receipt scanning","Payroll & Attendance","Bulk import","Projects module"],
  },
  {
    id: "professional", nameEn: "Professional", nameAr: "الاحترافي",
    price: 599, priceYear: 5990, popular: true,
    descEn: "Medium businesses & contractors", descAr: "الشركات المتوسطة والمقاولات",
    features: ["1000 invoices/month","15 users","ZATCA Phase 1 & 2","Advanced reports","Custom invoice template","Audit logs","Two-factor auth"],
  },
  {
    id: "enterprise", nameEn: "Enterprise", nameAr: "المؤسسي",
    price: 1499, priceYear: 14990, popular: false,
    descEn: "Large enterprises & groups", descAr: "المؤسسات الكبيرة والمجموعات",
    features: ["Unlimited everything","Unlimited users","White label","API access","Priority support","ZATCA Phase 1 & 2","Multi-branch"],
  },
];

const FEATURES = [
  { icon: ShieldCheck, titleEn: "ZATCA Compliant", titleAr: "متوافق مع زاتكا", descEn: "Full Phase 1 & 2 compliance with QR codes, UBL XML and e-invoicing integration", descAr: "توافق كامل مع المرحلتين الأولى والثانية مع رموز QR وتكامل الفوترة الإلكترونية" },
  { icon: Zap, titleEn: "AI Receipt Scanning", titleAr: "مسح الإيصالات بالذكاء الاصطناعي", descEn: "Snap a photo of any receipt — Gemini AI auto-fills all expense fields instantly", descAr: "التقط صورة لأي إيصال — يملأ الذكاء الاصطناعي جميع حقول المصروفات تلقائياً" },
  { icon: FileText, titleEn: "Smart Invoicing", titleAr: "فوترة ذكية", descEn: "Create standard, simplified, credit note and debit note invoices with full VAT calculation", descAr: "إنشاء الفواتير القياسية والمبسطة وإشعارات الدائن والمدين مع احتساب الضريبة" },
  { icon: BarChart3, titleEn: "Financial Reports", titleAr: "التقارير المالية", descEn: "Real-time P&L, balance sheet, VAT returns and partner ledger with Excel/PDF export", descAr: "أرباح وخسائر فورية وميزانية عمومية وإقرارات ضريبية مع تصدير Excel وPDF" },
  { icon: Users, titleEn: "Team Management", titleAr: "إدارة الفريق", descEn: "Invite team members with role-based access control and per-module permissions", descAr: "دعوة أعضاء الفريق مع التحكم في الوصول بناءً على الأدوار والصلاحيات" },
  { icon: Globe, titleEn: "Arabic & English", titleAr: "عربي وإنجليزي", descEn: "Fully bilingual interface with complete RTL support for Arabic users", descAr: "واجهة ثنائية اللغة مع دعم كامل لاتجاه RTL للمستخدمين العرب" },
];

const STATS = [
  { value: "100%", labelEn: "ZATCA Compliant", labelAr: "متوافق مع زاتكا" },
  { value: "15%", labelEn: "VAT Auto-calculated", labelAr: "ضريبة محتسبة تلقائياً" },
  { value: "∞", labelEn: "Invoices on Pro+", labelAr: "فواتير بلا حدود" },
  { value: "2", labelEn: "Languages Supported", labelAr: "لغة مدعومة" },
];

export const LandingPage: React.FC = () => {
  const [language, setLanguage] = React.useState<"ar" | "en">("ar");
  const [billing, setBilling] = React.useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const isRtl = language === "ar";

  const FAQS = [
    { q: language === "ar" ? "هل صفقة متوافقة مع متطلبات زاتكا؟" : "Is Safqa ZATCA compliant?", a: language === "ar" ? "نعم، صفقة متوافقة بالكامل مع متطلبات زاتكا للمرحلتين الأولى والثانية، بما في ذلك رموز QR وتوليد XML وتكامل واجهة برمجة التطبيقات." : "Yes, Safqa is fully compliant with ZATCA Phase 1 and Phase 2 requirements, including QR codes, XML generation and API integration." },
    { q: language === "ar" ? "هل يمكنني تجربة صفقة مجاناً؟" : "Can I try Safqa for free?", a: language === "ar" ? "نعم، نقدم تجربة مجانية لمدة 15 يوماً مع وصول كامل إلى جميع الميزات دون الحاجة لبطاقة ائتمان." : "Yes, we offer a 15-day free trial with full access to all features — no credit card required." },
    { q: language === "ar" ? "هل يدعم صفقة اللغة العربية؟" : "Does Safqa support Arabic?", a: language === "ar" ? "نعم، صفقة ثنائي اللغة بالكامل مع دعم كامل لاتجاه RTL وجميع المستندات بالعربية والإنجليزية." : "Yes, Safqa is fully bilingual with complete RTL support and all documents in both Arabic and English." },
    { q: language === "ar" ? "هل يمكن تصدير البيانات؟" : "Can I export my data?", a: language === "ar" ? "نعم، يمكنك تصدير أي بيانات إلى Excel أو PDF مع ورق الرسائل الخاص بشركتك، بالإضافة إلى نسخة احتياطية كاملة بصيغة JSON." : "Yes, you can export any data to Excel or PDF with your company letterhead, plus a full JSON backup of all your data." },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-white font-sans" style={{ fontFamily: isRtl ? "'Noto Kufi Arabic', sans-serif" : "'Inter', sans-serif" }}>

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-[#1D4ED8] flex items-center justify-center text-white font-bold text-lg">ص</div>
            <span className="font-bold text-slate-800 text-lg">Safqa <span className="text-slate-400 font-normal text-sm">| صفقة</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-brand-primary transition-colors">{language === "ar" ? "المميزات" : "Features"}</a>
            <a href="#pricing" className="hover:text-brand-primary transition-colors">{language === "ar" ? "الأسعار" : "Pricing"}</a>
            <a href="#faq" className="hover:text-brand-primary transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors">
              {language === "ar" ? "English" : "العربية"}
            </button>
            <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-brand-primary transition-colors">
              {language === "ar" ? "تسجيل الدخول" : "Sign In"}
            </Link>
            <Link to="/register" className="bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
              {language === "ar" ? "ابدأ مجاناً" : "Start Free"}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0F172A] to-[#1D4ED8] text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm font-semibold mb-8">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            {language === "ar" ? "متوافق مع زاتكا المرحلة 1 و 2" : "ZATCA Phase 1 & 2 Compliant"}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            {language === "ar"
              ? <><span className="text-white">نظام محاسبة</span><br /><span className="text-[#60A5FA]">ذكي لأعمالك السعودية</span></>
              : <><span className="text-white">Smart Accounting</span><br /><span className="text-[#60A5FA]">for Saudi Businesses</span></>}
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            {language === "ar"
              ? "إصدار الفواتير الإلكترونية المتوافقة مع زاتكا، إدارة المصروفات بالذكاء الاصطناعي، التقارير المالية، إدارة الرواتب — كل شيء في منصة واحدة."
              : "ZATCA-compliant e-invoicing, AI expense management, financial reports, payroll — everything in one platform."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#1D4ED8] hover:bg-blue-600 text-white font-bold px-8 py-4 rounded-2xl text-base transition-all shadow-lg shadow-blue-500/30">
              {language === "ar" ? "ابدأ تجربتك المجانية — أنشئ شركة" : "Get Started — Create Company"}
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all border border-white/20">
              {language === "ar" ? "لدي شركة — تسجيل الدخول" : "I Have a Company — Sign In"}
            </Link>
          </div>
          <p className="text-slate-400 text-sm mt-5">{language === "ar" ? "✓ 15 يوم مجاناً • ✓ بدون بطاقة ائتمان • ✓ إلغاء في أي وقت" : "✓ 15-day free trial • ✓ No credit card • ✓ Cancel anytime"}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#1D4ED8] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s, i) => (
            <div key={i}>
              <p className="text-3xl md:text-4xl font-bold">{s.value}</p>
              <p className="text-blue-200 text-sm mt-1">{language === "ar" ? s.labelAr : s.labelEn}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              {language === "ar" ? "كل ما تحتاجه لإدارة أعمالك" : "Everything You Need to Run Your Business"}
            </h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              {language === "ar" ? "منصة متكاملة مصممة خصيصاً للأعمال السعودية المتوافقة مع متطلبات هيئة الزكاة والضريبة والجمارك" : "An all-in-one platform designed specifically for Saudi businesses compliant with ZATCA requirements"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-brand-primary/30 transition-all group">
                  <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                    <Icon className="h-6 w-6 text-[#1D4ED8]" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">{language === "ar" ? f.titleAr : f.titleEn}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{language === "ar" ? f.descAr : f.descEn}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              {language === "ar" ? "أسعار شفافة بدون مفاجآت" : "Transparent Pricing, No Surprises"}
            </h2>
            <p className="text-slate-500 text-lg mb-8">{language === "ar" ? "اختر الخطة المناسبة لحجم عملك" : "Choose the plan that fits your business size"}</p>
            <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
              <button onClick={() => setBilling("monthly")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billing === "monthly" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
                {language === "ar" ? "شهري" : "Monthly"}
              </button>
              <button onClick={() => setBilling("yearly")} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${billing === "yearly" ? "bg-white shadow text-slate-800" : "text-slate-500"}`}>
                {language === "ar" ? "سنوي (شهران مجاناً)" : "Yearly (2 months free)"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className={`relative flex flex-col rounded-2xl border p-6 ${plan.popular ? "border-[#1D4ED8] shadow-xl shadow-blue-100 scale-105" : "border-slate-200 hover:border-slate-300"} transition-all`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1D4ED8] text-white text-xs font-bold px-3 py-1 rounded-full">
                    {language === "ar" ? "الأكثر شيوعاً" : "Most Popular"}
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="font-bold text-slate-800">{language === "ar" ? plan.nameAr : plan.nameEn}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{language === "ar" ? plan.descAr : plan.descEn}</p>
                </div>
                <div className="mb-6">
                  <span className="text-3xl font-bold text-slate-800">{billing === "yearly" ? Math.round(plan.priceYear / 12) : plan.price}</span>
                  <span className="text-slate-500 text-sm"> {language === "ar" ? "ر.س/شهر" : "SAR/mo"}</span>
                  {billing === "yearly" && plan.price > 0 && (
                    <p className="text-xs text-emerald-600 font-semibold mt-0.5">{language === "ar" ? `${plan.priceYear} ر.س/سنة` : `${plan.priceYear} SAR/yr`}</p>
                  )}
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register"
                  className={`w-full text-center py-2.5 rounded-xl text-sm font-bold transition-colors ${plan.popular ? "bg-[#1D4ED8] text-white hover:bg-blue-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                  {plan.price === 0 ? (language === "ar" ? "ابدأ مجاناً" : "Start Free") : (language === "ar" ? "اشترك الآن" : "Get Started")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl font-bold text-slate-800 text-center mb-12">
            {language === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-start font-semibold text-slate-800 hover:bg-slate-50 transition-colors">
                  {faq.q}
                  <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform shrink-0 ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-[#0F172A] to-[#1D4ED8] text-white text-center">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {language === "ar" ? "ابدأ رحلتك مع صفقة اليوم" : "Start Your Journey with Safqa Today"}
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            {language === "ar" ? "15 يوماً مجاناً — بدون بطاقة ائتمان — إلغاء في أي وقت" : "15 days free — no credit card — cancel anytime"}
          </p>
          <Link to="/register" className="inline-flex items-center gap-2 bg-white text-[#1D4ED8] font-bold px-10 py-4 rounded-2xl text-base hover:bg-blue-50 transition-all shadow-lg">
            {language === "ar" ? "إنشاء حساب مجاني" : "Create Free Account"}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-slate-400 py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#1D4ED8] flex items-center justify-center text-white font-bold text-sm">ص</div>
            <span className="font-semibold text-white">Safqa | صفقة</span>
          </div>
          <p className="text-xs text-center">
            {language === "ar" ? "© 2026 صفقة. جميع الحقوق محفوظة. متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك." : "© 2026 Safqa. All rights reserved. ZATCA compliant ERP for Saudi businesses."}
          </p>
          <div className="flex gap-4 text-xs">
            <Link to="/login" className="hover:text-white transition-colors">{language === "ar" ? "تسجيل الدخول" : "Sign In"}</Link>
            <Link to="/register" className="hover:text-white transition-colors">{language === "ar" ? "إنشاء حساب" : "Register"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default LandingPage;
 
