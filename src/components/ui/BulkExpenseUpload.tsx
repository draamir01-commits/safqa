import * as React from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";
import { addDocument } from "../../firebase/firestore";
import Button from "./Button";

interface ParsedExpense {
  date: string;
  description: string;
  category: string;
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  valid: boolean;
  error?: string;
}

const REQUIRED_COLS = ["date", "description", "amount"];
const SAMPLE_CSV = `date,description,category,amount,vatRate
2026-01-15,Office supplies,office,100,15
2026-01-16,Team lunch,meals,200,15
2026-01-20,Software subscription,it,500,15
2026-01-22,Travel expenses,travel,300,0`;

export const BulkExpenseUpload: React.FC<{ onClose: () => void; onSuccess: () => void }> = ({ onClose, onSuccess }) => {
  const { user } = useAuthStore();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [parsed, setParsed] = React.useState<ParsedExpense[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<"upload" | "preview" | "done">("upload");

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "expense-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv")) return toast.error(language === "ar" ? "يرجى رفع ملف CSV فقط" : "Please upload a CSV file");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.trim().split("\n");
      if (lines.length < 2) return toast.error(language === "ar" ? "الملف فارغ" : "File is empty");

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
      const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
      if (missing.length) return toast.error(`Missing columns: ${missing.join(", ")}`);

      const rows: ParsedExpense[] = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const get = (col: string) => cols[headers.indexOf(col)] || "";
        const amount = parseFloat(get("amount")) || 0;
        const vatRate = parseFloat(get("vatrate") || get("vat_rate") || "15") || 15;
        const vatAmount = Math.round(amount * (vatRate / 100) * 100) / 100;
        const date = get("date");
        const desc = get("description");
        const valid = !!(date && desc && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date));
        return {
          date, description: desc, category: get("category") || "other",
          amount, vatRate, vatAmount, totalAmount: amount + vatAmount,
          valid, error: !valid ? (language === "ar" ? "بيانات ناقصة أو تاريخ خاطئ" : "Missing data or invalid date") : undefined,
        };
      }).filter(r => r.description);

      setParsed(rows);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!currentCompany || !user) return;
    const valid = parsed.filter(r => r.valid);
    if (!valid.length) return toast.error(language === "ar" ? "لا توجد صفوف صالحة للاستيراد" : "No valid rows to import");
    setLoading(true);
    try {
      await Promise.all(valid.map(r => addDocument(`companies/${currentCompany.id}/expenses`, {
        title: r.description, titleAr: r.description, description: r.description,
        category: r.category, amount: r.amount, vatRate: r.vatRate,
        vatAmount: r.vatAmount, totalAmount: r.totalAmount,
        date: r.date, createdBy: user.uid, createdAt: new Date(),
      })));
      toast.success(language === "ar" ? `تم استيراد ${valid.length} مصروف` : `Imported ${valid.length} expenses`);
      setStep("done");
      onSuccess();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-4">
      {step === "upload" && (
        <>
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-brand-primary transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
            <Upload className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 mb-1">{language === "ar" ? "اسحب ملف CSV هنا أو اضغط للاختيار" : "Drag a CSV file here or click to browse"}</p>
            <p className="text-xs text-slate-400 mb-4">{language === "ar" ? "الأعمدة المطلوبة: date, description, amount" : "Required columns: date, description, amount"}</p>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <span className="px-4 py-2 bg-brand-primary text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors">
                {language === "ar" ? "اختر الملف" : "Choose File"}
              </span>
            </label>
          </div>
          <button onClick={downloadTemplate} className="flex items-center justify-center gap-2 text-xs text-brand-primary hover:underline font-semibold">
            <Download className="h-4 w-4" />
            {language === "ar" ? "تحميل قالب CSV" : "Download CSV Template"}
          </button>
        </>
      )}

      {step === "preview" && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle className="h-4 w-4" />{parsed.filter(r => r.valid).length} {language === "ar" ? "صالح" : "valid"}</span>
            {parsed.some(r => !r.valid) && <span className="flex items-center gap-1 text-red-500 font-semibold"><XCircle className="h-4 w-4" />{parsed.filter(r => !r.valid).length} {language === "ar" ? "خطأ" : "errors"}</span>}
          </div>
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {["", language === "ar" ? "التاريخ" : "Date", language === "ar" ? "الوصف" : "Description",
                    language === "ar" ? "الفئة" : "Category", language === "ar" ? "المبلغ" : "Amount",
                    language === "ar" ? "الضريبة" : "VAT", language === "ar" ? "الإجمالي" : "Total"].map((h, i) =>
                    <th key={i} className="px-3 py-2 text-slate-600 font-semibold text-start">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.map((r, i) => (
                  <tr key={i} className={r.valid ? "" : "bg-red-50"}>
                    <td className="px-3 py-2">{r.valid ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5 text-red-500" title={r.error} />}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2 max-w-[120px] truncate">{r.description}</td>
                    <td className="px-3 py-2">{r.category}</td>
                    <td className="px-3 py-2">{r.amount.toFixed(2)}</td>
                    <td className="px-3 py-2">{r.vatAmount.toFixed(2)}</td>
                    <td className="px-3 py-2 font-semibold">{r.totalAmount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setParsed([]); setStep("upload"); }}>{language === "ar" ? "رجوع" : "Back"}</Button>
            <Button onClick={handleImport} loading={loading} disabled={!parsed.some(r => r.valid)}>
              {language === "ar" ? `استيراد ${parsed.filter(r => r.valid).length} مصروف` : `Import ${parsed.filter(r => r.valid).length} Expenses`}
            </Button>
          </div>
        </>
      )}

      {step === "done" && (
        <div className="text-center py-6">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-lg font-bold text-slate-800">{language === "ar" ? "تم الاستيراد بنجاح!" : "Import Successful!"}</p>
          <p className="text-sm text-slate-500 mt-1">{language === "ar" ? "تم إضافة المصاريف إلى قائمة المصروفات" : "Expenses have been added to your expenses list"}</p>
          <Button onClick={onClose} className="mt-4">{language === "ar" ? "إغلاق" : "Close"}</Button>
        </div>
      )}
    </div>
  );
};
export default BulkExpenseUpload;
