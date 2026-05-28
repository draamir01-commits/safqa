import * as React from "react";
import { X, Download, Printer, FileText, Image as ImageIcon, ExternalLink, Loader2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  fileName?: string;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  isOpen,
  onClose,
  url,
  fileName = "document",
}) => {
  const { language } = useUIStore();
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const isPdf   = url ? (url.includes("application/pdf") || url.toLowerCase().endsWith(".pdf") || url.startsWith("data:application/pdf")) : false;
  const isImage = url ? (url.includes("image/") || /\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(url) || url.startsWith("data:image/")) : false;

  // Convert data: PDF URLs to blob URLs — Chrome blocks data: in iframes
  React.useEffect(() => {
    if (!isOpen || !url) { setBlobUrl(null); return; }
    if (isPdf && url.startsWith("data:application/pdf")) {
      setLoading(true);
      try {
        const base64 = url.split(",")[1];
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: "application/pdf" });
        const bUrl = URL.createObjectURL(blob);
        setBlobUrl(bUrl);
      } catch { setError(true); }
      finally { setLoading(false); }
    }
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [isOpen, url]);

  const handleDownload = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = blobUrl || url;
    a.download = fileName;
    a.click();
  };

  const handlePrint = () => {
    if (!url) return;
    const win = window.open(blobUrl || url, "_blank");
    if (win) { win.focus(); win.print(); }
  };

  if (!isOpen) return null;

  const displayUrl = blobUrl || url;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            {isPdf   ? <FileText  className="h-5 w-5 text-red-500"   /> :
             isImage ? <ImageIcon  className="h-5 w-5 text-blue-500"  /> :
                       <FileText  className="h-5 w-5 text-slate-400" />}
            <p className="font-semibold text-slate-800 text-sm truncate max-w-xs">{fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Printer className="h-3.5 w-3.5" />
              {language === "ar" ? "طباعة" : "Print"}
            </button>
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-primary rounded-lg hover:opacity-90 transition-opacity">
              <Download className="h-3.5 w-3.5" />
              {language === "ar" ? "تنزيل" : "Download"}
            </button>
            <button onClick={() => url && window.open(blobUrl || url, "_blank")}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <ExternalLink className="h-4 w-4" />
            </button>
            <button onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
            </div>
          ) : error || !displayUrl ? (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">{language === "ar" ? "تعذر عرض الملف" : "Unable to preview this file"}</p>
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Download className="h-4 w-4" />
                {language === "ar" ? "تنزيل الملف" : "Download File"}
              </button>
            </div>
          ) : isPdf ? (
            <iframe
              src={displayUrl}
              title={fileName}
              className="w-full h-full border-0"
              onError={() => setError(true)}
            />
          ) : isImage ? (
            <img
              src={displayUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain p-4"
              onError={() => setError(true)}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <FileText className="h-12 w-12 opacity-30" />
              <p className="text-sm">{language === "ar" ? "لا يمكن معاينة هذا النوع من الملفات" : "Preview not available for this file type"}</p>
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                <Download className="h-4 w-4" />
                {language === "ar" ? "تنزيل الملف" : "Download File"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
