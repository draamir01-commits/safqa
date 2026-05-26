import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight, ArrowLeft, Upload, ShieldCheck, HeartHandshake, Eye, Globe } from "lucide-react";
import toast from "react-hot-toast";

import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { isValidSaudiVat, isValidSaudiCrn } from "../../utils/validators";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";

export const CompanySetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createCompany, loading } = useCompanyStore();
  const { language, setLanguage } = useUIStore();

  const [step, setStep] = React.useState(1);

  // Form States
  const [nameEn, setNameEn] = React.useState("");
  const [nameAr, setNameAr] = React.useState("");
  const [crn, setCrn] = React.useState("");
  const [vat, setVat] = React.useState("");
  const [businessType, setBusinessType] = React.useState("LLC");

  const [addressEn, setAddressEn] = React.useState("");
  const [addressAr, setAddressAr] = React.useState("");
  const [city, setCity] = React.useState("Riyadh");
  const [phone, setPhone] = React.useState("+966 5");
  const [email, setEmail] = React.useState(user?.email || "");

  const [logoBase64, setLogoBase64] = React.useState("");
  const [zatcaPhase, setZatcaPhase] = React.useState<1 | 2>(1);

  const cities = [
    { value: "Riyadh", label: language === "ar" ? "الرياض" : "Riyadh" },
    { value: "Jeddah", label: language === "ar" ? "جدة" : "Jeddah" },
    { value: "Dammam", label: language === "ar" ? "الدمام" : "Dammam" },
    { value: "Makkah", label: language === "ar" ? "مكة المكرمة" : "Makkah" },
    { value: "Madinah", label: language === "ar" ? "المدينة المنورة" : "Madinah" },
    { value: "Khobar", label: language === "ar" ? "الخبر" : "Khobar" },
    { value: "Jubail", label: language === "ar" ? "الجبيل" : "Jubail" }
  ];

  const validateStep = () => {
    if (step === 1) {
      if (!nameEn || !nameAr || !crn || !vat) {
        toast.error(language === "ar" ? "برجاء استكمال كافة الحقول المطلوبة" : "Please fill out all fields");
        return false;
      }
      if (!isValidSaudiCrn(crn)) {
        toast.error(language === "ar" ? "رقم السجل التجاري يجب أن يكون 10 أرقام" : "Commercial Registration Number must be 10 digits");
        return false;
      }
      if (!isValidSaudiVat(vat)) {
        toast.error(language === "ar" ? "الرقم الضريبي غير صالح. يجب أن يتكون من 15 خانة تبدأ بالرقم 3 وتنتهي بالرقم 3" : "VAT Number must be 15 digits starting and ending with 3");
        return false;
      }
    }
    if (step === 2) {
      if (!addressEn || !addressAr || !phone || !email) {
        toast.error(language === "ar" ? "برجاء ملء العنوان ومعلومات التواصل" : "Please enter address and contact details");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoBase64(reader.result as string);
        toast.success(language === "ar" ? "تم رفع الشعار مسبقاً بنجاح" : "Logo draft uploaded");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user) {
      toast.error("You must be logged in to complete setup.");
      return;
    }
    try {
      await createCompany({
        name: nameEn,
        nameAr,
        crNumber: crn,
        vatNumber: vat,
        address: addressEn,
        addressAr,
        city,
        country: "SA",
        phone,
        email,
        logo: logoBase64,
        zatcaPhase,
        invoiceCounter: 0,
        currency: "SAR",
        defaultVatRate: 15,
        language: language,
        fiscalYearStart: "01-01",
        plan: "standard"
      }, user.uid, user.email || "no-reply@safqa.sa", user.displayName || "Owner");

      toast.success(language === "ar" ? "تم تأسيس الشركة بنجاح! مرحباً بك في لوحة التحكم" : "Company registered successfully! Welcome to your Dashboard");
      
      // Navigate safely to layout
      navigate("/");
    } catch (err: any) {
      console.error("Failed to create company onboarding:", err);
      toast.error("Error: " + (err?.message || "Failed to save. Check console for details."));
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 p-4 md:p-8 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-lg border border-slate-200 shadow-md p-6 md:p-8 flex flex-col gap-6">
        
        {/* Brand */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-slate-800">Safqa (صفقة)</span>
            <span className="text-xs text-slate-400">| Onboarding</span>
          </div>
          <button
            onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
          >
            <Globe className="h-4 w-4 text-slate-400" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md text-slate-600">
            {language === "ar" ? `الخطوة ${step} من 4` : `Step ${step} of 4`}
          </span>
        </div>

        {/* Step Visual Indicator */}
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center font-semibold text-xs transition-colors duration-300 ${
                  step === s
                    ? "bg-brand-primary text-white"
                    : step > s
                    ? "bg-brand-emerald text-white"
                    : "bg-slate-100 text-slate-400 border border-slate-250"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              <div
                className={`hidden md:block h-1 flex-1 rounded-sm ${
                  step > s ? "bg-brand-emerald" : "bg-slate-100"
                }`}
              />
            </div>
          ))}
        </div>

        {/* STEP CONTENT SWITCHER */}
        <div className="min-h-[250px] py-2">
          {step === 1 && (
            <div className="flex flex-col gap-4 ">
              <h3 className="font-bold text-slate-800 text-lg">
                {language === "ar" ? "الخطوة 1: البيانات الرسمية للمنشأة" : "Step 1: Official Corporate Profile"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={language === "ar" ? "اسم المنشأة بالإنجليزية" : "Company Name (English)"}
                  placeholder="E.g., Saudi Trading LLC"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                />
                <Input
                  label={language === "ar" ? "اسم المنشأة بالمسجل بالعربي" : "Company Name (Arabic)"}
                  placeholder="مثال: شركة مؤسسة التجارة السعودية"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                />
                <Input
                  label={language === "ar" ? "رقم السجل التجاري (10 خانات)" : "Commercial Registration No. (CRN)"}
                  placeholder="1010XXXXXX"
                  value={crn}
                  onChange={(e) => setCrn(e.target.value)}
                />
                <Input
                  label={language === "ar" ? "الرقم الضريبي KSA VAT (15 خانة)" : "Saudi 15-Digit VAT Number"}
                  placeholder="300XXXXXXXXXXXX3"
                  value={vat}
                  onChange={(e) => setVat(e.target.value)}
                />
              </div>
              <Select
                label={language === "ar" ? "الكيان القانوني للشركة" : "Business Legal Type"}
                options={[
                  { value: "SoleProp", label: language === "ar" ? "مؤسسة فردية" : "Sole Proprietorship" },
                  { value: "LLC", label: language === "ar" ? "شركة ذات مسؤولية محدودة" : "LLC" },
                  { value: "Corp", label: language === "ar" ? "شركة مساهمة" : "Corporation" }
                ]}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
              />
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4 ">
              <h3 className="font-bold text-slate-800 text-lg">
                {language === "ar" ? "الخطوة 2: العنوان الوطني ووسائل الاتصال" : "Step 2: National Address & Contacts"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={language === "ar" ? "رمز الشارع والحي (إنجليزي)" : "Street & District Address (EN)"}
                  placeholder="Flat 10, King Fahd Road, Olaya"
                  value={addressEn}
                  onChange={(e) => setAddressEn(e.target.value)}
                />
                <Input
                  label={language === "ar" ? "موقع المنشأة والحي (عربي)" : "تفاصيل العنوان بالكامل (بالعربي)"}
                  placeholder="مكتب 10، طريق الملك فهد، حي العليا"
                  value={addressAr}
                  onChange={(e) => setAddressAr(e.target.value)}
                />
                <Select
                  label={language === "ar" ? "المدينة بموجب السجل" : "Saudi City Location"}
                  options={cities}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label={language === "ar" ? "رقم الهاتف للفرع (+966)" : "KSA Branch Phone No."}
                  placeholder="+966 5XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <Input
                label={language === "ar" ? "البريد الإلكتروني التجاري" : "Business Support Email"}
                placeholder="billing@saudibusiness.sa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-4 items-center justify-center py-6 text-center ">
              <div className="max-w-md flex flex-col gap-3">
                <h3 className="font-bold text-slate-800 text-lg">
                  {language === "ar" ? "الخطوة 3: إضافة شعار المنشأة" : "Step 3: Upload Business Logo"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ar"
                    ? "يفضل استخدام خلفية شفافة وتنسيق مربع لعرضه بأعلى دقة في فواتير ضريبة القيمة المضافة ومستندات PDF"
                    : "Recommended: Transparent background square image to present on invoice PDFs beautifully"}
                </p>
              </div>

              {/* Upload Panel */}
              <div className="w-full max-w-sm border-2 border-dashed border-slate-300 hover:border-brand-primary rounded-lg p-6 bg-slate-50/50 flex flex-col items-center justify-center gap-4 transition-colors">
                {logoBase64 ? (
                  <div className="relative h-24 w-24 bg-white p-1 rounded-md border border-slate-200">
                    <img src={logoBase64} alt="Company logo draft" className="h-full w-full object-contain rounded-sm" />
                    <button
                      type="button"
                      onClick={() => setLogoBase64("")}
                      className="absolute -top-2 -right-2 p-1 bg-brand-danger text-white hover:bg-red-700 rounded-full text-xs"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-slate-400 stroke-[1.5]" />
                    <div className="text-xs text-slate-500">
                      <label className="cursor-pointer font-bold text-brand-primary hover:underline">
                        {language === "ar" ? "اضغط هنا لتصفح الملفات" : "Click to select a file"}
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      </label>
                      <p className="mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4 ">
              <h3 className="font-bold text-slate-800 text-lg">
                {language === "ar" ? "الخطوة 4: اختيار مستوى ربط الفوترة ZATCA" : "Step 4: Select ZATCA E-Invoicing Phase"}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                {/* Phase 1 */}
                <div
                  className={`border rounded-lg p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 ${
                    zatcaPhase === 1
                      ? "border-brand-primary ring-2 ring-blue-100 bg-blue-50/20 shadow-sm"
                      : "border-slate-250 bg-white hover:bg-slate-50/50"
                  }`}
                  onClick={() => setZatcaPhase(1)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800">
                        {language === "ar" ? "المرحلة الأولى: إصدار الفواتير" : "ZATCA Phase 1: Generation"}
                      </span>
                      {zatcaPhase === 1 && <span className="h-4 w-4 bg-brand-primary text-white rounded-full flex items-center justify-center text-[10px]">✓</span>}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {language === "ar"
                        ? "توليد كود الاستجابة السريعة (QR) محلياً وتضمين القيم المشفرة. جاهز للتشغيل مباشرة دون أي ربط خارجي."
                        : "Includes local QR block generators, offline hash chaining. Instantly active without API link requirements."}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand-primary bg-blue-50 px-2 py-1 rounded inline-block self-start mt-2">
                    {language === "ar" ? "جاهز للاستخدام اليوم" : "Ready Today"}
                  </span>
                </div>

                {/* Phase 2 */}
                <div
                  className={`border rounded-lg p-5 flex flex-col justify-between gap-4 cursor-pointer transition-all duration-200 ${
                    zatcaPhase === 2
                      ? "border-brand-primary ring-2 ring-blue-100 bg-blue-50/25 shadow-sm"
                      : "border-slate-250 bg-white hover:bg-slate-50"
                  }`}
                  onClick={() => setZatcaPhase(2)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-800">
                        {language === "ar" ? "المرحلة الثانية: الربط والتكامل" : "ZATCA Phase 2: Integration"}
                      </span>
                      {zatcaPhase === 2 && <span className="h-4 w-4 bg-brand-primary text-white rounded-full flex items-center justify-center text-[10px]">✓</span>}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {language === "ar"
                        ? "ربط فوري وحي مع بوابة 'فاتورة' التابع للهيئة. يدعم الربط عبر شهادات التوثيق الرقمية (CSID) للحصول على clearance حية."
                        : "Full REST real-time clearance for B2B standards & reporting for B2C simplified receipts via cryptographic CSID signing."}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded inline-block self-start mt-2">
                    {language === "ar" ? "ربط فني واختباري" : "Technical Integration Ready"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t pt-4 border-slate-100 mt-2">
          {step > 1 ? (
            <Button variant="secondary" onClick={handleBack} disabled={loading} className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 rtl:hidden" />
              <ArrowRight className="h-4 w-4 ltr:hidden" />
              {language === "ar" ? "السابق" : "Back"}
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button onClick={handleNext} className="flex items-center gap-2">
              {language === "ar" ? "التالي" : "Next"}
              <ArrowRight className="h-4 w-4 rtl:hidden" />
              <ArrowLeft className="h-4 w-4 ltr:hidden" />
            </Button>
          ) : (
            <Button onClick={handleComplete} loading={loading} variant="success" className="flex items-center gap-2 font-bold px-6">
              {language === "ar" ? "إتمام التأسيس والربط" : "Complete Activation"}
            </Button>
          )}
        </div>

      </div>
    </div>
  );
};
export default CompanySetupPage;
