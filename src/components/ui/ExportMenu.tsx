import * as React from "react";
import { Download, FileText, FileSpreadsheet, FileDown, X, UserCheck, ChevronDown, Image as ImageIcon, Stamp, Printer } from "lucide-react";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useCompanyStore } from "../../stores/companyStore";
import { useUIStore } from "../../stores/uiStore";

export interface ExportSection {
  title: string;
  data: Record<string, any>[];
  headers?: string[];
}

interface AuthorizedSignatory {
  id: string;
  name: string;
  designation: string;
  signatureUrl?: string;
  isActive: boolean;
}

interface LetterheadOption {
  id: string;
  name: string;
  url: string;
}

export interface ExportMenuProps {
  data: Record<string, any>[] | ExportSection[];
  filename: string;
  headers?: Record<string, string>;
  label?: string;
  className?: string;
}

const isSectioned = (d: any[]): d is ExportSection[] =>
  d.length > 0 && "title" in d[0] && "data" in d[0];

const sanitize = (s: string) => s.replace(/[/\\?%*:|"<>]/g, "-").substring(0, 200);

const toFirebaseDate = (v: any): string => {
  if (!v) return "";
  if (v?.seconds) return new Date(v.seconds * 1000).toLocaleDateString();
  if (typeof v === "string") return v;
  return String(v);
};

const flattenRow = (row: Record<string, any>): Record<string, any> => {
  const flat: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "__styles" || k === "__cellStyles") continue;
    if (v == null) { flat[k] = ""; continue; }
    if (typeof v === "object" && v.seconds) { flat[k] = toFirebaseDate(v); continue; }
    if (typeof v === "object") { flat[k] = JSON.stringify(v).substring(0, 500); continue; }
    flat[k] = v;
  }
  return flat;
};

// Load image as base64 for jsPDF
const loadImageAsBase64 = (url: string): Promise<string> =>
  new Promise((resolve, reject) => {
    if (url.startsWith("data:")) { resolve(url); return; }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });

export const ExportMenu: React.FC<ExportMenuProps> = ({
  data, filename, headers, label, className = ""
}) => {
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();
  const [open, setOpen] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  // Branding options
  const [includeLogo, setIncludeLogo]             = React.useState(true);
  const [includeLetterhead, setIncludeLetterhead] = React.useState(false);
  const [selectedLetterheadId, setSelectedLetterheadId] = React.useState("primary");
  const [includeStamp, setIncludeStamp]           = React.useState(false);
  const [includeSignature, setIncludeSignature]   = React.useState(false);

  // Data
  const [signatories, setSignatories]   = React.useState<AuthorizedSignatory[]>([]);
  const [selectedSigId, setSelectedSigId] = React.useState("");
  const [letterheads, setLetterheads]   = React.useState<LetterheadOption[]>([]);

  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open || !currentCompany) return;

    // Load signatories
    const q = query(collection(db, "companies", currentCompany.id, "signatories"), where("isActive", "==", true));
    getDocs(q).then(snap => setSignatories(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuthorizedSignatory))));

    // Load additional letterheads from company
    const lhs: LetterheadOption[] = [];
    if ((currentCompany as any).logo || (currentCompany as any).nameAr) {
      lhs.push({ id: "primary", name: language === "ar" ? "الترويسة الرئيسية" : "Primary Letterhead", url: "" });
    }
    ((currentCompany as any).additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setLetterheads(lhs);
  }, [open, currentCompany]);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getSections = (): ExportSection[] => {
    if (isSectioned(data)) return data;
    const keys = headers ? Object.keys(headers) : (data.length ? Object.keys(data[0]) : []);
    const mapped = (data as Record<string, any>[]).map(row => {
      const out: Record<string, any> = {};
      keys.forEach(k => { out[headers?.[k] || k] = row[k] ?? ""; });
      return out;
    });
    return [{ title: filename, data: mapped }];
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const sections = getSections();
    const lines: string[] = [];
    sections.forEach(sec => {
      if (!sec.data.length) return;
      const keys = sec.headers || Object.keys(sec.data[0]);
      lines.push(keys.join(","));
      sec.data.forEach(row => {
        const flat = flattenRow(row);
        lines.push(keys.map(k => {
          const v = String(flat[k] ?? "");
          return v.includes(",") ? `"${v}"` : v;
        }).join(","));
      });
      lines.push("");
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${sanitize(filename)}.csv`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  // ── Excel ──────────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    setGenerating(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Safqa"; wb.created = new Date();
      const ws = wb.addWorksheet("Data");

      // Company header
      if (currentCompany) {
        const titleRow = ws.addRow([currentCompany.name + (currentCompany.nameAr ? ` | ${currentCompany.nameAr}` : "")]);
        titleRow.font = { bold: true, size: 14, color: { argb: "FF1D4ED8" } };
        ws.addRow([`VAT: ${currentCompany.vatNumber || ""}   CR: ${currentCompany.crNumber || ""}   Generated: ${new Date().toLocaleDateString()}`]);
        ws.addRow([]);
      }

      const sections = getSections();
      sections.forEach(sec => {
        if (!sec.data.length) return;
        const titleRow = ws.addRow([sec.title.toUpperCase()]);
        titleRow.font = { bold: true, size: 12, color: { argb: "FF0F172A" } };
        const keys = sec.headers || Object.keys(sec.data[0]);
        const hRow = ws.addRow(keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)));
        hRow.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
          cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
          cell.alignment = { horizontal: "center" };
        });
        sec.data.forEach(row => {
          const flat = flattenRow(row);
          ws.addRow(keys.map(k => flat[k] ?? ""));
        });
        ws.addRow([]);
      });

      ws.columns.forEach(col => {
        let max = 10;
        col.eachCell?.({ includeEmpty: true }, cell => {
          const len = cell.value ? String(cell.value).length : 10;
          if (len > max) max = len;
        });
        col.width = Math.min(max + 2, 50);
      });

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob); 
      const a = document.createElement("a"); a.href = url; a.download = `${sanitize(filename)}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (e) { console.error(e); alert("Excel export failed."); }
    finally { setGenerating(false); }
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const selectedSig = signatories.find(s => s.id === selectedSigId);
      let y = 15;

      // ── LETTERHEAD ──────────────────────────────────────────────────────────
      if (includeLetterhead) {
        const selectedLH = letterheads.find(l => l.id === selectedLetterheadId);
        if (selectedLH && selectedLH.url) {
          try {
            const b64 = await loadImageAsBase64(selectedLH.url);
            doc.addImage(b64, "PNG", 0, 0, pw, 35);
            y = 40;
          } catch { /* fallback to text header */ }
        } else {
          // Primary letterhead — text-based
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, pw, 28, "F");
          if (includeLogo && (currentCompany as any)?.logo) {
            try {
              const logoB64 = await loadImageAsBase64((currentCompany as any).logo);
              doc.addImage(logoB64, "PNG", 8, 4, 20, 20);
            } catch {}
          }
          doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
          doc.text(currentCompany?.name || "Report", includeLogo ? 32 : 14, 13);
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(180);
          doc.text(
            [currentCompany?.vatNumber ? `VAT: ${currentCompany.vatNumber}` : "", currentCompany?.city || "", currentCompany?.phone || ""].filter(Boolean).join("   "),
            includeLogo ? 32 : 14, 22
          );
          y = 36;
        }
      } else {
        // Simple text header
        if (includeLogo && (currentCompany as any)?.logo) {
          try {
            const logoB64 = await loadImageAsBase64((currentCompany as any).logo);
            doc.addImage(logoB64, "PNG", 14, y - 5, 18, 18);
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
            doc.text(currentCompany?.name || "Report", 36, y + 4);
            y += 16;
          } catch {
            doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
            doc.text(currentCompany?.name || "Report", 14, y); y += 8;
          }
        } else {
          doc.setFontSize(14); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(currentCompany?.name || "Report", 14, y); y += 8;
        }
        if (currentCompany?.vatNumber) {
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
          doc.text(`VAT: ${currentCompany.vatNumber}  |  CR: ${currentCompany.crNumber || ""}  |  ${currentCompany.city || ""}`, 14, y); y += 5;
        }
        doc.setFontSize(9); doc.setTextColor(100);
        doc.text(`${sanitize(filename).replace(/_/g, " ").toUpperCase()}   |   ${new Date().toLocaleDateString()}`, 14, y); y += 3;
        doc.setDrawColor(200); doc.line(14, y + 1, pw - 14, y + 1); y += 8;
      }

      // ── TABLE SECTIONS ──────────────────────────────────────────────────────
      const sections = getSections();
      sections.forEach(sec => {
        if (!sec.data.length) return;
        const keys = sec.headers || Object.keys(sec.data[0]);
        const body = sec.data.map(row => {
          const flat = flattenRow(row);
          return keys.map(k => String(flat[k] ?? ""));
        });

        doc.setFillColor(15, 23, 42);
        doc.rect(14, y, pw - 28, 8, "F");
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(255);
        doc.text(sec.title.toUpperCase(), pw / 2, y + 5.5, { align: "center" });
        y += 10;

        autoTable(doc, {
          head: [keys.map(k => k.charAt(0).toUpperCase() + k.slice(1))],
          body,
          startY: y,
          theme: "grid",
          headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold", fontSize: 7 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          margin: { top: 15, bottom: selectedSig ? 50 : 30 },
          rowPageBreak: "avoid",
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      });

      // ── SIGNATORY + STAMP ───────────────────────────────────────────────────
      if (selectedSig || includeStamp) {
        if (y + 50 > ph - 20) { doc.addPage(); y = 20; }
        doc.setDrawColor(200); doc.line(14, y, pw - 14, y); y += 8;

        if (selectedSig) {
          // Signature image if available
          if (includeSignature && (selectedSig as any).signatureUrl) {
            try {
              const sigB64 = await loadImageAsBase64((selectedSig as any).signatureUrl);
              doc.addImage(sigB64, "PNG", 14, y, 50, 18);
              y += 20;
            } catch {}
          }
          doc.setDrawColor(150); doc.line(14, y + 2, 70, y + 2);
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(selectedSig.name, 14, y + 8);
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
          doc.text(selectedSig.designation || "", 14, y + 13);
          doc.setFontSize(7); doc.setTextColor(150);
          doc.text(language === "ar" ? "المفوض بالتوقيع" : "Authorized Signatory", 14, y + 18);
        }

        if (includeStamp && (currentCompany as any)?.stamp) {
          try {
            const stampB64 = await loadImageAsBase64((currentCompany as any).stamp);
            doc.addImage(stampB64, "PNG", pw - 55, y - 5, 40, 40);
          } catch {}
        }
      }

      // ── PAGE NUMBERS ────────────────────────────────────────────────────────
      const total = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7); doc.setTextColor(150);
        doc.text(`Page ${i} of ${total}`, pw - 14, ph - 8, { align: "right" });
        doc.text("Safqa — ZATCA Compliant ERP", 14, ph - 8);
      }

      doc.save(`${sanitize(filename)}.pdf`);
      setOpen(false);
    } catch (e) { console.error("PDF export failed", e); alert("PDF generation failed."); }
    finally { setGenerating(false); }
  };

  const selectedSig = signatories.find(s => s.id === selectedSigId);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors ${className}`}
      >
        <Download className="h-3.5 w-3.5" />
        {label || (language === "ar" ? "تصدير" : "Export")}
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "خيارات التصدير" : "Export Options"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{filename}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="flex-1 p-5 space-y-5 overflow-y-auto">

              {/* ── Letterhead toggle ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "الترويسة" : "Letterhead"}
                </p>
                <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين ترويسة" : "Include Letterhead"}</span>
                  </div>
                  <input type="checkbox" checked={includeLetterhead} onChange={e => setIncludeLetterhead(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                </label>

                {includeLetterhead && letterheads.length > 1 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold pl-1">{language === "ar" ? "اختر الترويسة:" : "Choose letterhead:"}</p>
                    {letterheads.map(lh => (
                      <label key={lh.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedLetterheadId === lh.id ? "border-brand-primary bg-blue-50" : "border-slate-100 hover:border-slate-200"}`}>
                        <input type="radio" name="letterhead" checked={selectedLetterheadId === lh.id} onChange={() => setSelectedLetterheadId(lh.id)} className="text-brand-primary" />
                        {lh.url ? (
                          <img src={lh.url} alt={lh.name} className="h-7 object-contain rounded border border-slate-200 bg-white" />
                        ) : (
                          <div className="h-7 w-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="h-3 w-3 text-slate-400" />
                          </div>
                        )}
                        <span className="text-xs font-medium text-slate-700">{lh.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Logo & Stamp ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "الشعار والختم" : "Logo & Stamp"}
                </p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الشعار" : "Include Logo"}</span>
                        {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع شعار بعد" : "No logo uploaded yet"}</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={includeLogo} onChange={e => setIncludeLogo(e.target.checked)} className="rounded border-slate-300 text-brand-primary" disabled={!(currentCompany as any)?.logo} />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary transition-colors">
                    <div className="flex items-center gap-2">
                      <Stamp className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الختم" : "Include Stamp"}</span>
                        {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع ختم بعد" : "No stamp uploaded yet"}</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={includeStamp} onChange={e => setIncludeStamp(e.target.checked)} className="rounded border-slate-300 text-brand-primary" disabled={!(currentCompany as any)?.stamp} />
                  </label>
                </div>
              </div>

              {/* ── Signatory ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">
                  {language === "ar" ? "التوقيع المفوض" : "Authorized Signatory"}
                </p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <UserCheck className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "اختر المفوض بالتوقيع" : "Select Signatory"}</span>
                  </div>
                  <select value={selectedSigId} onChange={e => setSelectedSigId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary bg-white">
                    <option value="">{language === "ar" ? "بدون توقيع" : "None"}</option>
                    {signatories.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>

                  {selectedSig && (selectedSig as any).signatureUrl && (
                    <label className="flex items-center justify-between mt-2 cursor-pointer">
                      <span className="text-xs text-slate-600">{language === "ar" ? "تضمين صورة التوقيع" : "Include signature image"}</span>
                      <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}

                  {selectedSig && (selectedSig as any).signatureUrl && includeSignature && (
                    <img src={(selectedSig as any).signatureUrl} alt="signature" className="h-10 object-contain border border-slate-200 rounded bg-white p-1 mt-1" />
                  )}

                  {signatories.length === 0 && (
                    <p className="text-[10px] text-slate-400">{language === "ar" ? "أضف مفوضين من صفحة الإعدادات" : "Add signatories in Settings"}</p>
                  )}
                </div>
              </div>

              {/* ── Preview strip ── */}
              {(includeLetterhead || includeLogo || includeStamp || selectedSigId) && (
                <div className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 space-y-1">
                  <p className="font-bold text-white text-xs mb-2">{language === "ar" ? "سيحتوي الملف على:" : "PDF will include:"}</p>
                  {includeLetterhead && <p>✓ {letterheads.find(l => l.id === selectedLetterheadId)?.name || "Letterhead"}</p>}
                  {includeLogo && (currentCompany as any)?.logo && <p>✓ {language === "ar" ? "شعار الشركة" : "Company logo"}</p>}
                  {includeStamp && (currentCompany as any)?.stamp && <p>✓ {language === "ar" ? "الختم الرسمي" : "Company stamp"}</p>}
                  {selectedSig && <p>✓ {selectedSig.name} — {selectedSig.designation}</p>}
                  {includeSignature && selectedSig && (selectedSig as any).signatureUrl && <p>✓ {language === "ar" ? "صورة التوقيع" : "Signature image"}</p>}
                </div>
              )}

              {/* ── Export buttons ── */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-3">
                  {language === "ar" ? "تنسيق الملف" : "Output Format"}
                </p>
                <div className="space-y-2">
                  <button onClick={exportPDF} disabled={generating}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-900 hover:bg-brand-primary text-white rounded-xl transition-colors font-semibold text-sm disabled:opacity-50">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-400" />
                      <span>{generating ? (language === "ar" ? "جاري الإنشاء..." : "Generating...") : (language === "ar" ? "تحميل PDF" : "Download PDF")}</span>
                    </div>
                    <Download className="h-4 w-4 opacity-50" />
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={exportExcel} disabled={generating}
                      className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 rounded-xl border border-transparent hover:border-emerald-200 transition-all text-xs font-bold disabled:opacity-50">
                      <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                      {language === "ar" ? "ملف Excel" : "Excel Sheet"}
                    </button>
                    <button onClick={exportCSV}
                      className="flex flex-col items-center gap-2 p-4 bg-slate-50 hover:bg-amber-50 hover:text-amber-700 text-slate-600 rounded-xl border border-transparent hover:border-amber-200 transition-all text-xs font-bold">
                      <FileDown className="h-6 w-6 text-amber-500" />
                      {language === "ar" ? "ملف CSV" : "CSV Data"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
              <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Safqa — ZATCA Compliant ERP</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
