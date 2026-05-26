import * as React from "react";
import { Upload, X, FileText, Image, Eye, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { uploadFile } from "../../firebase/storage";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";

interface AttachmentUploaderProps {
  folder: string;
  attachments: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  accept?: string;
}

export const AttachmentUploader: React.FC<AttachmentUploaderProps> = ({
  folder, attachments, onChange, maxFiles = 5, accept = "image/*,application/pdf"
}) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !currentCompany) return;
    if (attachments.length + files.length > maxFiles) {
      toast.error(language === "ar" ? `الحد الأقصى ${maxFiles} مرفقات` : `Maximum ${maxFiles} attachments`);
      return;
    }
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(language === "ar" ? "حجم الملف يتجاوز 10 ميجابايت" : "File exceeds 10MB limit");
          continue;
        }
        const url = await uploadFile(currentCompany.id, folder, file);
        urls.push(url);
      }
      onChange([...attachments, ...urls]);
      if (urls.length) toast.success(language === "ar" ? "تم رفع المرفقات" : "Attachments uploaded");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (idx: number) => {
    onChange(attachments.filter((_, i) => i !== idx));
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp)/i.test(url) || url.startsWith("data:image");
  const isPdf = (url: string) => /\.pdf/i.test(url) || url.startsWith("data:application/pdf");

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-700">
        {language === "ar" ? "المرفقات" : "Attachments"} ({attachments.length}/{maxFiles})
      </p>

      {/* Upload zone */}
      {attachments.length < maxFiles && (
        <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${uploading ? "border-brand-primary bg-blue-50" : "border-slate-300 hover:border-brand-primary hover:bg-slate-50"}`}>
          <input type="file" accept={accept} multiple className="hidden"
            onChange={e => handleFiles(e.target.files)} disabled={uploading} />
          {uploading ? (
            <><Loader2 className="h-5 w-5 text-brand-primary animate-spin" />
              <span className="text-xs text-brand-primary font-medium">{language === "ar" ? "جاري الرفع..." : "Uploading..."}</span></>
          ) : (
            <><Upload className="h-5 w-5 text-slate-400" />
              <span className="text-xs text-slate-500">{language === "ar" ? "اسحب أو اضغط لرفع ملف" : "Drag or click to upload"}</span>
              <span className="text-[10px] text-slate-400">PDF, JPG, PNG — Max 10MB</span></>
          )}
        </label>
      )}

      {/* Attachments list */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((url, i) => (
            <div key={i} className="relative group bg-slate-50 border border-slate-200 rounded-lg p-2 flex items-center gap-2">
              {isImage(url) ? (
                <img src={url} alt={`attachment-${i}`} className="h-10 w-10 object-cover rounded cursor-pointer"
                  onClick={() => setPreview(url)} />
              ) : (
                <div className="h-10 w-10 bg-red-50 rounded flex items-center justify-center cursor-pointer"
                  onClick={() => window.open(url, "_blank")}>
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-500 truncate">{isImage(url) ? (language === "ar" ? "صورة" : "Image") : (language === "ar" ? "ملف PDF" : "PDF")}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => isImage(url) ? setPreview(url) : window.open(url, "_blank")}
                  className="p-1 text-slate-400 hover:text-brand-primary rounded transition-colors">
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => removeAttachment(i)}
                  className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-screen p-4">
            <button onClick={() => setPreview(null)} className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-lg">
              <X className="h-5 w-5 text-slate-700" />
            </button>
            <img src={preview} alt="preview" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AttachmentUploader;
