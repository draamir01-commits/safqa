import * as React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, FileText, BarChart3, Users, Zap, Globe,
  CheckCircle, ArrowRight, ChevronDown
} from "lucide-react";

// ── Palette 1 Navy + Lime brand tokens ──────────────────────────────────────
const NAVY   = "#0F2D6B";
const NAVY2  = "#071A45";
const NAVY3  = "#1A4490";
const LIME   = "#B8F400";
const LIME2  = "#94C700";

// ── Prism SVG mark ───────────────────────────────────────────────────────────
const PrismMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 64 72" style={{ flexShrink: 0 }}>
    <polygon points="32,2 60,18 60,50 32,66 4,50 4,18" fill={NAVY} />
    <polygon points="32,2 60,18 32,34"                 fill={NAVY2} />
    <polygon points="32,34 60,18 60,50 32,66"           fill={LIME} />
    <polygon points="4,18 32,34 32,66 4,50"             fill={LIME2} />
    <polygon points="32,2 32,34 4,18"                   fill={NAVY3} />
  </svg>
);

// ── Wordmark ─────────────────────────────────────────────────────────────────
const Wordmark: React.FC<{ dark?: boolean; size?: "sm"|"md"|"lg" }> = ({ dark, size = "md" }) => {
  const enSize = size === "lg" ? 42 : size === "md" ? 28 : 20;
  const arSize = size === "lg" ? 22 : size === "md" ? 15 : 12;
  const tagSize = size === "lg" ? 11 : 10;
  const textColor = dark ? "#fff" : NAVY2;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: enSize, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: textColor }}>
        <span style={{ fontStyle: "italic", color: LIME2 }}>S</span>afqa
      </div>
      <div style={{ fontFamily: "Cairo,Arial,sans-serif", fontSize: arSize, fontWeight: 900, color: dark ? LIME : LIME2, direction: "rtl", marginTop: 3 }}>
        <span style={{ fontWeight: 200, color: dark ? "rgba(255,255,255,0.7)" : NAVY2 }}>صف</span>قة
      </div>
      {size === "lg" && (
        <div style={{ height: 2, background: NAVY, borderRadius: 1, margin: "6px 0 5px" }} />
      )}
    </div>
  );
};

const PLANS = [
  { id: "trial",        nameEn: "Free Trial",    nameAr: "تجربة مجانية",    price: 0,    priceYear: 0,     popular: false, descEn: "15-day full access",                    descAr: "15 يوم وصول كامل",                          features: ["50 invoices/month","3 users","ZATCA Phase 1","AI scanning","Excel/PDF export"] },
  { id: "starter",      nameEn: "Starter",       nameAr: "المبتدئ",         price: 99,   priceYear: 990,   popular: false, descEn: "Freelancers & micro businesses",         descAr: "المستقلون والمشاريع الصغيرة",               features: ["50 invoices/month","2 users","ZATCA Phase 1","Excel/PDF export","Customers & Suppliers"] },
  { id: "growth",       nameEn: "Growth",        nameAr: "النمو",           price: 249,  priceYear: 2490,  popular: false, descEn: "Small businesses & trading companies",   descAr: "الشركات الصغيرة والتجارية",                features: ["200 invoices/month","5 users","ZATCA Phase 1","AI receipt scanning","Payroll & Attendance","Bulk import","Projects module"] },
  { id: "professional", nameEn: "Professional",  nameAr: "الاحترافي",       price: 599,  priceYear: 5990,  popular: true,  descEn: "Medium businesses & contractors",        descAr: "الشركات المتوسطة والمقاولات",               features: ["1000 invoices/month","15 users","ZATCA Phase 1 & 2","Advanced reports","Custom invoice template","Audit logs","Two-factor auth"] },
  { id: "enterprise",   nameEn: "Enterprise",    nameAr: "المؤسسي",         price: 1499, priceYear: 14990, popular: false, descEn: "Large enterprises & groups",             descAr: "المؤسسات الكبيرة والمجموعات",               features: ["Unlimited everything","Unlimited users","White label","API access","Priority support","ZATCA Phase 1 & 2","Multi-branch"] },
];

const FEATURES = [
  { icon: ShieldCheck, titleEn: "ZATCA Compliant",       titleAr: "متوافق مع زاتكا",                     descEn: "Full Phase 1 & 2 compliance with QR codes, UBL XML and e-invoicing integration",       descAr: "توافق كامل مع المرحلتين الأولى والثانية مع رموز QR وتكامل الفوترة الإلكترونية" },
  { icon: Zap,          titleEn: "AI Receipt Scanning",   titleAr: "مسح الإيصالات بالذكاء الاصطناعي",     descEn: "Snap a photo of any receipt — Gemini AI auto-fills all expense fields instantly",         descAr: "التقط صورة لأي إيصال — يملأ الذكاء الاصطناعي جميع حقول المصروفات تلقائياً" },
  { icon: FileText,     titleEn: "Smart Invoicing",       titleAr: "فوترة ذكية",                          descEn: "Standard, simplified, credit & debit notes with full VAT calculation",                   descAr: "إنشاء الفواتير القياسية والمبسطة وإشعارات الدائن والمدين مع احتساب الضريبة" },
  { icon: BarChart3,    titleEn: "Financial Reports",     titleAr: "التقارير المالية",                     descEn: "Real-time P&L, balance sheet, VAT returns and partner ledger with Excel/PDF export",    descAr: "أرباح وخسائر فورية وميزانية عمومية وإقرارات ضريبية مع تصدير Excel وPDF" },
  { icon: Users,        titleEn: "Team Management",       titleAr: "إدارة الفريق",                         descEn: "Role-based access control with per-module permissions for every team member",             descAr: "دعوة أعضاء الفريق مع التحكم في الوصول بناءً على الأدوار والصلاحيات" },
  { icon: Globe,        titleEn: "Arabic & English",      titleAr: "عربي وإنجليزي",                        descEn: "Fully bilingual interface with complete RTL support for Arabic users",                   descAr: "واجهة ثنائية اللغة مع دعم كامل لاتجاه RTL للمستخدمين العرب" },
];

const STATS = [
  { value: "100%", labelEn: "ZATCA Compliant",       labelAr: "متوافق مع زاتكا" },
  { value: "15%",  labelEn: "VAT Auto-calculated",   labelAr: "ضريبة محتسبة تلقائياً" },
  { value: "∞",    labelEn: "Invoices on Pro+",       labelAr: "فواتير بلا حدود" },
  { value: "2",    labelEn: "Languages Supported",    labelAr: "لغة مدعومة" },
];

export const LandingPage: React.FC = () => {
  const [language, setLanguage] = React.useState<"ar"|"en">("ar");
  const [billing, setBilling]   = React.useState<"monthly"|"yearly">("monthly");
  const [openFaq, setOpenFaq]   = React.useState<number|null>(null);
  const isRtl = language === "ar";

  const FAQS = [
    { q: language === "ar" ? "هل صفقة متوافقة مع متطلبات زاتكا؟" : "Is Safqa ZATCA compliant?", a: language === "ar" ? "نعم، صفقة متوافقة بالكامل مع متطلبات زاتكا للمرحلتين الأولى والثانية، بما في ذلك رموز QR وتوليد XML وتكامل واجهة برمجة التطبيقات." : "Yes, Safqa is fully compliant with ZATCA Phase 1 and Phase 2 requirements, including QR codes, XML generation and API integration." },
    { q: language === "ar" ? "هل يمكنني تجربة صفقة مجاناً؟" : "Can I try Safqa for free?", a: language === "ar" ? "نعم، نقدم تجربة مجانية لمدة 15 يوماً مع وصول كامل إلى جميع الميزات دون الحاجة لبطاقة ائتمان." : "Yes, we offer a 15-day free trial with full access to all features — no credit card required." },
    { q: language === "ar" ? "هل يدعم صفقة اللغة العربية؟" : "Does Safqa support Arabic?", a: language === "ar" ? "نعم، صفقة ثنائي اللغة بالكامل مع دعم كامل لاتجاه RTL وجميع المستندات بالعربية والإنجليزية." : "Yes, Safqa is fully bilingual with complete RTL support and all documents in both Arabic and English." },
    { q: language === "ar" ? "هل يمكن تصدير البيانات؟" : "Can I export my data?", a: language === "ar" ? "نعم، يمكنك تصدير أي بيانات إلى Excel أو PDF مع ورق الرسائل الخاص بشركتك." : "Yes, you can export any data to Excel or PDF with your company letterhead, plus a full JSON backup." },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"} className="min-h-screen bg-white font-sans">

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "0.5px solid #e2e8f0" }}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <PrismMark size={34} />
            <Wordmark size="sm" />
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">{language === "ar" ? "المميزات" : "Features"}</a>
            <a href="#pricing"  className="hover:text-slate-900 transition-colors">{language === "ar" ? "الأسعار" : "Pricing"}</a>
            <a href="#faq"      className="hover:text-slate-900 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="text-xs font-bold border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors">
              {language === "ar" ? "English" : "العربية"}
            </button>
            <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              {language === "ar" ? "تسجيل الدخول" : "Sign In"}
            </Link>
            <Link to="/register" style={{ background: NAVY, color: "#fff" }}
              className="text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity">
              {language === "ar" ? "ابدأ مجاناً" : "Start Free"}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 55%, #0A2290 100%)`, color: "#fff", position: "relative", overflow: "hidden" }}>
        {/* dot grid */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.07, backgroundImage: "radial-gradient(circle at 2px 2px, #B8F400 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        {/* lime accent glow bottom-right */}
        <div style={{ position: "absolute", bottom: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: LIME, opacity: 0.08 }} />

        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-24 md:py-32 text-center">
          {/* logo lockup */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 32 }}>
            <PrismMark size={72} />
            <div style={{ textAlign: isRtl ? "right" : "left" }}>
              <div style={{ fontFamily: "Georgia,'Times New Roman',serif", fontSize: 56, fontWeight: 700, letterSpacing: -2, lineHeight: 1, color: "#fff" }}>
                <span style={{ fontStyle: "italic", color: LIME }}>S</span>afqa
              </div>
              <div style={{ fontFamily: "Cairo,Arial,sans-serif", fontSize: 28, direction: "rtl", marginTop: 4 }}>
                <span style={{ fontWeight: 200, color: "rgba(255,255,255,0.6)" }}>صف</span>
                <span style={{ fontWeight: 900, color: "#fff" }}>قة</span>
                <span style={{ fontWeight: 900, color: LIME }}>.</span>
              </div>
              <div style={{ height: 2, background: LIME, borderRadius: 1, margin: "8px 0 6px", opacity: 0.7 }} />
              <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)", fontFamily: "sans-serif" }}>ZATCA · ERP · SAUDI ARABIA</div>
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", border: "0.5px solid rgba(255,255,255,0.2)", borderRadius: 99, padding: "6px 16px", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: LIME }} />
            {language === "ar" ? "متوافق مع زاتكا المرحلة 1 و 2" : "ZATCA Phase 1 & 2 Compliant"}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
            {language === "ar"
              ? <><span style={{ color: "#fff" }}>نظام محاسبة</span><br /><span style={{ color: LIME }}>ذكي لأعمالك السعودية</span></>
              : <><span style={{ color: "#fff" }}>Smart Accounting</span><br /><span style={{ color: LIME }}>for Saudi Businesses</span></>}
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
            {language === "ar"
              ? "إصدار الفواتير الإلكترونية المتوافقة مع زاتكا، إدارة المصروفات بالذكاء الاصطناعي، التقارير المالية، إدارة الرواتب — كل شيء في منصة واحدة."
              : "ZATCA-compliant e-invoicing, AI expense management, financial reports, payroll — everything in one platform."}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" style={{ background: LIME, color: NAVY2, fontWeight: 700 }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base hover:opacity-90 transition-opacity shadow-lg">
              {language === "ar" ? "ابدأ مجاناً — 15 يوم" : "Start Free — 15 days"}
              <ArrowRight style={{ width: 18, height: 18 }} />
            </Link>
            <Link to="/login" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "0.5px solid rgba(255,255,255,0.25)" }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold hover:bg-white/20 transition-colors">
              {language === "ar" ? "تسجيل الدخول" : "Sign In"}
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20 text-center">
            {STATS.map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "20px 16px" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: LIME, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6 }}>{language === "ar" ? s.labelAr : s.labelEn}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-14">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eef2ff", border: `0.5px solid ${NAVY}20`, borderRadius: 99, padding: "4px 14px", fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 14 }}>
              {language === "ar" ? "لماذا صفقة؟" : "Why Safqa?"}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: NAVY2 }}>
              {language === "ar" ? "كل ما تحتاجه في مكان واحد" : "Everything you need in one place"}
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              {language === "ar" ? "مبني خصيصاً للأعمال السعودية مع متطلبات زاتكا الكاملة" : "Built specifically for Saudi businesses with full ZATCA compliance"}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} style={{ border: `0.5px solid #e2e8f0`, borderRadius: 16, padding: "28px 24px", transition: "border-color .2s" }}
                  className="hover:border-slate-300 group">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${NAVY}12`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                    <Icon style={{ width: 22, height: 22, color: NAVY }} />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2 text-base">{language === "ar" ? f.titleAr : f.titleEn}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{language === "ar" ? f.descAr : f.descEn}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────── */}
      <section id="pricing" style={{ background: "#f8fafc" }} className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: NAVY2 }}>
              {language === "ar" ? "أسعار شفافة بدون مفاجآت" : "Transparent Pricing, No Surprises"}
            </h2>
            <p className="text-slate-500 text-lg mb-8">{language === "ar" ? "اختر الخطة المناسبة لحجم عملك" : "Choose the plan that fits your business size"}</p>
            <div style={{ display: "inline-flex", background: "#e2e8f0", borderRadius: 12, padding: 4 }}>
              <button onClick={() => setBilling("monthly")} style={{ padding: "8px 20px", borderRadius: 9, fontSize: 14, fontWeight: 600, transition: "all .2s", background: billing === "monthly" ? "#fff" : "transparent", color: billing === "monthly" ? NAVY2 : "#64748b", boxShadow: billing === "monthly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                {language === "ar" ? "شهري" : "Monthly"}
              </button>
              <button onClick={() => setBilling("yearly")} style={{ padding: "8px 20px", borderRadius: 9, fontSize: 14, fontWeight: 600, transition: "all .2s", background: billing === "yearly" ? "#fff" : "transparent", color: billing === "yearly" ? NAVY2 : "#64748b", boxShadow: billing === "yearly" ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                {language === "ar" ? "سنوي (شهران مجاناً)" : "Yearly (2 months free)"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: 18, border: `0.5px solid ${plan.popular ? NAVY : "#e2e8f0"}`, padding: 24, background: plan.popular ? NAVY2 : "#fff", transform: plan.popular ? "scale(1.04)" : "none", boxShadow: plan.popular ? `0 8px 32px ${NAVY}30` : "none", transition: "all .2s" }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: LIME, color: NAVY2, fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 99, whiteSpace: "nowrap" }}>
                    {language === "ar" ? "الأكثر شيوعاً" : "Most Popular"}
                  </div>
                )}
                <div style={{ marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 700, color: plan.popular ? "#fff" : NAVY2, fontSize: 15 }}>{language === "ar" ? plan.nameAr : plan.nameEn}</h3>
                  <p style={{ fontSize: 11, color: plan.popular ? "rgba(255,255,255,0.5)" : "#94a3b8", marginTop: 2 }}>{language === "ar" ? plan.descAr : plan.descEn}</p>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, color: plan.popular ? LIME : NAVY }}>{billing === "yearly" ? Math.round(plan.priceYear / 12) : plan.price}</span>
                  <span style={{ fontSize: 13, color: plan.popular ? "rgba(255,255,255,0.4)" : "#94a3b8" }}> {language === "ar" ? "ر.س/شهر" : "SAR/mo"}</span>
                  {billing === "yearly" && plan.price > 0 && (
                    <p style={{ fontSize: 11, color: LIME, fontWeight: 600, marginTop: 2 }}>{language === "ar" ? `${plan.priceYear} ر.س/سنة` : `${plan.priceYear} SAR/yr`}</p>
                  )}
                </div>
                <ul style={{ listStyle: "none", flex: 1, marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {plan.features.map((feat, i) => (
                    <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: plan.popular ? "rgba(255,255,255,0.75)" : "#475569" }}>
                      <CheckCircle style={{ width: 14, height: 14, color: LIME, flexShrink: 0, marginTop: 1 }} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link to="/register" style={{ display: "block", textAlign: "center", padding: "10px 0", borderRadius: 12, fontSize: 13, fontWeight: 700, transition: "opacity .2s", background: plan.popular ? LIME : `${NAVY}12`, color: plan.popular ? NAVY2 : NAVY }}>
                  {plan.price === 0 ? (language === "ar" ? "ابدأ مجاناً" : "Start Free") : (language === "ar" ? "اشترك الآن" : "Get Started")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <h2 className="text-3xl font-bold text-center mb-12" style={{ color: NAVY2 }}>
            {language === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} style={{ border: `0.5px solid #e2e8f0`, borderRadius: 14, overflow: "hidden", background: "#fff" }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-start font-semibold hover:bg-slate-50 transition-colors"
                  style={{ color: NAVY2 }}>
                  {faq.q}
                  <ChevronDown style={{ width: 20, height: 20, color: "#94a3b8", flexShrink: 0, transform: openFaq === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 20px 16px", fontSize: 14, color: "#475569", lineHeight: 1.7, borderTop: "0.5px solid #f1f5f9" }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg, ${NAVY2} 0%, ${NAVY} 100%)`, color: "#fff" }} className="py-20 text-center">
        <div className="max-w-3xl mx-auto px-4 md:px-8">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 24 }}>
            <PrismMark size={48} />
            <div style={{ textAlign: isRtl ? "right" : "left" }}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 38, fontWeight: 700, letterSpacing: -1, color: "#fff" }}>
                <span style={{ fontStyle: "italic", color: LIME }}>S</span>afqa
              </div>
              <div style={{ fontFamily: "Cairo,Arial,sans-serif", fontSize: 20, direction: "rtl", color: LIME }}>
                <span style={{ fontWeight: 200, color: "rgba(255,255,255,0.6)" }}>صف</span>
                <span style={{ fontWeight: 900 }}>قة</span>
              </div>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {language === "ar" ? "ابدأ رحلتك مع صفقة اليوم" : "Start Your Journey with Safqa Today"}
          </h2>
          <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
            {language === "ar" ? "15 يوماً مجاناً — بدون بطاقة ائتمان — إلغاء في أي وقت" : "15 days free — no credit card — cancel anytime"}
          </p>
          <Link to="/register" style={{ display: "inline-flex", alignItems: "center", gap: 10, background: LIME, color: NAVY2, fontWeight: 700, padding: "16px 40px", borderRadius: 18, fontSize: 16 }}
            className="hover:opacity-90 transition-opacity shadow-lg">
            {language === "ar" ? "إنشاء حساب مجاني" : "Create Free Account"}
            <ArrowRight style={{ width: 20, height: 20 }} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: NAVY2, color: "#64748b" }} className="py-10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PrismMark size={30} />
            <div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff" }}>
                <span style={{ fontStyle: "italic", color: LIME }}>S</span>afqa
              </div>
              <div style={{ fontFamily: "Cairo,Arial,sans-serif", fontSize: 12, color: LIME, direction: "rtl" }}>
                <span style={{ fontWeight: 200, color: "rgba(255,255,255,0.4)" }}>صف</span>
                <span style={{ fontWeight: 900 }}>قة</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: "#334155" }}>
            {language === "ar" ? "© 2026 صفقة. جميع الحقوق محفوظة. متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك." : "© 2026 Safqa. All rights reserved. ZATCA compliant ERP for Saudi businesses."}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <Link to="/login"    style={{ color: "#475569" }} className="hover:text-white transition-colors">{language === "ar" ? "تسجيل الدخول" : "Sign In"}</Link>
            <Link to="/register" style={{ color: "#475569" }} className="hover:text-white transition-colors">{language === "ar" ? "إنشاء حساب" : "Register"}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default LandingPage;
