import * as React from "react";
import { Camera, Sparkles, Upload, CheckCircle, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useUIStore } from "../../stores/uiStore";
import { extractExpenseFromReceipt, ExtractedExpense } from "../../services/aiService";

interface AIReceiptScannerProps {
  onExtracted: (data: ExtractedExpense) => void;
}

export const AIReceiptScanner: React.FC<AIReceiptScannerProps> = ({ onExtracted }) => {
  const { language } = useUIStore();
  const [scanning, setScanning] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<ExtractedExpense | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return toast.error(language === "ar" ? "يرجى رفع صورة أو PDF" : "Please upload an image or PDF");
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPreview(base64);
      setScanning(true);
      setResult(null);
      try {
        const extracted = await extractExpenseFromReceipt(base64, file.type);
        if (extracted) {
          setResult(extracted);
          toast.success(language === "ar" ? "تم استخراج البيانات بنجاح!" : "Data extracted successfully!");
        }
      } catch (err: any) {
        if (err.message?.includes("API_KEY") || err.message?.includes("api key")) {
          toast.error(language === "ar" ? "يرجى إضافة VITE_GEMINI_API_KEY في ملف .env.local" : "Add VITE_GEMINI_API_KEY to your .env.local file");
        } else {
          toast.error(language === "ar" ? "فشل استخراج البيانات" : "Failed to extract data");
        }
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    if (result) { onExtracted(result); toast.success(language === "ar" ? "تم تطبيق البيانات" : "Data applied to form"); }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
        <Sparkles className="h-4 w-4 text-brand-primary" />
        <span className="text-sm font-semibold text-slate-700">{language === "ar" ? "مسح الإيصال بالذكاء الاصطناعي" : "AI Receipt Scanner"}</span>
        <span className="ms-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Gemini AI</span>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {!preview ? (
          <label className="cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-brand-primary transition-colors block">
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <Camera className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">{language === "ar" ? "اضغط لرفع صورة الإيصال" : "Click to upload receipt image"}</p>
            <p className="text-xs text-slate-400 mt-1">{language === "ar" ? "JPG, PNG, PDF مدعوم" : "Supports JPG, PNG, PDF"}</p>
          </label>
        ) : (
          <div className="flex gap-3">
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shrink-0">
              {preview.startsWith("data:image") ? (
                <img src={preview} alt="receipt" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-100 flex items-center justify-center"><Upload className="h-6 w-6 text-slate-400" /></div>
              )}
            </div>
            <div className="flex-1">
              {scanning ? (
                <div className="flex items-center gap-2 text-sm text-brand-primary font-medium">
                  <div className="h-4 w-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                  {language === "ar" ? "جاري تحليل الإيصال..." : "Analyzing receipt..."}
                </div>
              ) : result ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1 text-emerald-600 font-semibold mb-2">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {language === "ar" ? "تم الاستخراج" : "Extracted successfully"}
                  </div>
                  {result.date && <p><span className="text-slate-500">{language === "ar" ? "التاريخ:" : "Date:"}</span> {result.date}</p>}
                  {result.supplierName && <p><span className="text-slate-500">{language === "ar" ? "المورد:" : "Supplier:"}</span> {result.supplierName}</p>}
                  {result.totalAmount && <p><span className="text-slate-500">{language === "ar" ? "الإجمالي:" : "Total:"}</span> <strong>{result.totalAmount} SAR</strong></p>}
                  {result.vatAmount && <p><span className="text-slate-500">{language === "ar" ? "الضريبة:" : "VAT:"}</span> {result.vatAmount} SAR</p>}
                  {result.category && <p><span className="text-slate-500">{language === "ar" ? "الفئة:" : "Category:"}</span> {result.category}</p>}
                </div>
              ) : null}
              <div className="flex gap-2 mt-2">
                {result && (
                  <button onClick={handleApply} className="text-xs px-3 py-1.5 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {language === "ar" ? "تطبيق البيانات" : "Apply to Form"}
                  </button>
                )}
                <button onClick={() => { setPreview(null); setResult(null); }} className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 transition-colors">
                  {language === "ar" ? "مسح آخر" : "Scan Another"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {language === "ar"
            ? "يتطلب هذا الميزة مفتاح Gemini API. أضف VITE_GEMINI_API_KEY في ملف .env.local"
            : "Requires a Gemini API key. Add VITE_GEMINI_API_KEY to your .env.local file"}
        </div>
      </div>
    </div>
  );
};
export default AIReceiptScanner;
