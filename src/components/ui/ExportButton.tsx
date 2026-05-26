import * as React from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

interface ExportButtonProps {
  data: Record<string, any>[];
  filename: string;
  headers?: Record<string, string>;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ data, filename, headers }) => {
  const { language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const exportCSV = () => {
    if (!data.length) return;
    const keys = headers ? Object.keys(headers) : Object.keys(data[0]);
    const headerRow = keys.map(k => headers?.[k] || k).join(",");
    const rows = data.map(row => keys.map(k => {
      const val = row[k] ?? "";
      return typeof val === "string" && val.includes(",") ? `"${val}"` : val;
    }).join(","));
    const csv = [headerRow, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const exportPrint = () => {
    if (!data.length) return;
    const keys = headers ? Object.keys(headers) : Object.keys(data[0]);
    const headerRow = keys.map(k => `<th style="border:1px solid #ddd;padding:8px;background:#f1f5f9;text-align:left">${headers?.[k] || k}</th>`).join("");
    const rows = data.map(row =>
      `<tr>${keys.map(k => `<td style="border:1px solid #ddd;padding:8px">${row[k] ?? ""}</td>`).join("")}</tr>`
    ).join("");
    const html = `
      <html><head><title>${filename}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h2{color:#1e293b}table{border-collapse:collapse;width:100%}
      @media print{button{display:none}}</style></head>
      <body>
        <h2>${currentCompany?.name || ""} — ${filename}</h2>
        <p style="color:#64748b;font-size:12px">Generated: ${new Date().toLocaleDateString()}</p>
        <table>${headerRow ? `<thead><tr>${headerRow}</tr></thead>` : ""}<tbody>${rows}</tbody></table>
        <br><button onclick="window.print()">Print</button>
      </body></html>`;
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <Download className="h-3.5 w-3.5" />
        {language === "ar" ? "تصدير" : "Export"}
      </button>
      {open && (
        <div className="absolute top-full mt-1 end-0 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <button onClick={exportCSV} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            {language === "ar" ? "تصدير CSV" : "Export CSV"}
          </button>
          <button onClick={exportJSON} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
            <FileText className="h-4 w-4 text-blue-500" />
            {language === "ar" ? "تصدير JSON" : "Export JSON"}
          </button>
          <button onClick={exportPrint} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
            <FileText className="h-4 w-4 text-slate-500" />
            {language === "ar" ? "طباعة / PDF" : "Print / PDF"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
