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
  // letterheadMode: "none" | "header" | "full"
  //   none   = no letterhead
  //   header = header+footer banner images only
  //   full   = full A4 page background
  const [letterheadMode, setLetterheadMode] = React.useState<"none"|"header"|"full">("none");
  const [selectedLetterheadId, setSelectedLetterheadId] = React.useState("primary");
  const [includeStamp, setIncludeStamp]           = React.useState(false);
  const [includeSignature, setIncludeSignature]   = React.useState(false);
  // Keep legacy for compat
  const includeLetterhead = letterheadMode !== "none";

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
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = doc.internal.pageSize.getWidth();   // 210mm
      const ph = doc.internal.pageSize.getHeight();  // 297mm
      const ML = 14; const MR = 14;                  // left/right margin
      const selectedSig = signatories.find(s => s.id === selectedSigId);

      // ── Per-mode constants ─────────────────────────────────────────────────
      // FULL  : background image fills entire A4, content inside safe zone
      // HEADER: banner image at top (≤50mm), optional footer banner at bottom (≤25mm)
      // NONE  : just company text header
      const FULL_TOP    = 48;   // mm — content starts below letterhead header branding
      const FULL_BOTTOM = 28;   // mm — content ends above letterhead footer branding
      const MAX_HEADER_BANNER = 50;  // mm max height for header banner
      const MAX_FOOTER_BANNER = 25;  // mm max height for footer banner

      // Resolved at runtime after images load
      let lhB64       = "";   // full-page or header banner base64
      let footerB64   = "";   // footer banner base64
      let headerH     = 0;    // actual rendered header height in mm
      let footerH     = 0;    // actual rendered footer height in mm
      const isFullMode   = letterheadMode === "full";
      const isHeaderMode = letterheadMode === "header";

      // Helper — get pixel dimensions of a base64 image
      const imgPx = (b64: string) => new Promise<{w:number;h:number}>(res => {
        const img = new window.Image();
        img.onload  = () => res({ w: img.naturalWidth  || 1, h: img.naturalHeight || 1 });
        img.onerror = () => res({ w: 1, h: 1 });
        img.src = b64;
      });

      // ── Step 1: pre-load images ────────────────────────────────────────────
      const selectedLH = letterheads.find(l => l.id === selectedLetterheadId);
      if (letterheadMode !== "none" && selectedLH?.url) {
        try { lhB64 = await loadImageAsBase64(selectedLH.url); } catch {}
      }
      if (isHeaderMode) {
        const fUrl = (currentCompany as any).footerAsset || (currentCompany as any).letterheadFooter;
        if (fUrl) try { footerB64 = await loadImageAsBase64(fUrl); } catch {}
      }
      let logoB64 = "";
      if (includeLogo && (currentCompany as any)?.logo) {
        try { logoB64 = await loadImageAsBase64((currentCompany as any).logo); } catch {}
      }
      let stampB64 = "";
      if (includeStamp && (currentCompany as any)?.stamp) {
        try { stampB64 = await loadImageAsBase64((currentCompany as any).stamp); } catch {}
      }
      let sigB64 = "";
      if (includeSignature && (selectedSig as any)?.signatureUrl) {
        try { sigB64 = await loadImageAsBase64((selectedSig as any).signatureUrl); } catch {}
      }

      // ── Step 2: calculate actual image heights ─────────────────────────────
      if (lhB64) {
        const { w, h } = await imgPx(lhB64);
        if (isFullMode) {
          // Full page: always render at full A4 size
          headerH = ph;
        } else {
          // Header banner: scale width to page width, cap height
          headerH = Math.min(Math.round((h / w) * pw), MAX_HEADER_BANNER);
        }
      }
      if (footerB64) {
        const { w, h } = await imgPx(footerB64);
        footerH = Math.min(Math.round((h / w) * pw), MAX_FOOTER_BANNER);
      }

      // ── Step 3: compute content margins ───────────────────────────────────
      // topMargin  = where content (tables) START
      // botMargin  = how much space to RESERVE at bottom for footer
      let topMargin: number;
      let botMargin: number;

      if (isFullMode) {
        topMargin = FULL_TOP;
        botMargin = FULL_BOTTOM;
      } else if (isHeaderMode) {
        topMargin = headerH > 0 ? headerH + 5 : 36;
        botMargin = footerH > 0 ? footerH + 6 : 15;
      } else {
        topMargin = 15;
        botMargin = 15;
      }

      // ── Step 4: draw page function (background layer) ─────────────────────
      const drawPageBg = (pageDoc: typeof doc) => {
        if (isFullMode && lhB64) {
          pageDoc.addImage(lhB64, "JPEG", 0, 0, pw, ph, undefined, "FAST");
        } else if (isHeaderMode) {
          if (lhB64 && headerH > 0) {
            pageDoc.addImage(lhB64, "JPEG", 0, 0, pw, headerH, undefined, "FAST");
          }
          if (footerB64 && footerH > 0) {
            pageDoc.addImage(footerB64, "JPEG", 0, ph - footerH, pw, footerH, undefined, "FAST");
          }
        }
      };

      // ── Step 5: draw foreground clips (branding on top of tables) ─────────
      const drawPageFg = (pageDoc: typeof doc) => {
        if (isFullMode && lhB64) {
          // Clip & redraw header region
          try {
            pageDoc.saveGraphicsState();
            pageDoc.rect(0, 0, pw, FULL_TOP - 2).clip();
            pageDoc.addImage(lhB64, "JPEG", 0, 0, pw, ph, undefined, "FAST");
            pageDoc.restoreGraphicsState();
          } catch {}
          // Clip & redraw footer region
          try {
            pageDoc.saveGraphicsState();
            pageDoc.rect(0, ph - FULL_BOTTOM, pw, FULL_BOTTOM).clip();
            pageDoc.addImage(lhB64, "JPEG", 0, 0, pw, ph, undefined, "FAST");
            pageDoc.restoreGraphicsState();
          } catch {}
        } else if (isHeaderMode) {
          if (lhB64 && headerH > 0) {
            try {
              pageDoc.saveGraphicsState();
              pageDoc.rect(0, 0, pw, headerH).clip();
              pageDoc.addImage(lhB64, "JPEG", 0, 0, pw, headerH, undefined, "FAST");
              pageDoc.restoreGraphicsState();
            } catch {}
          }
          if (footerB64 && footerH > 0) {
            try {
              pageDoc.saveGraphicsState();
              pageDoc.rect(0, ph - footerH, pw, footerH).clip();
              pageDoc.addImage(footerB64, "JPEG", 0, ph - footerH, pw, footerH, undefined, "FAST");
              pageDoc.restoreGraphicsState();
            } catch {}
          }
        }
      };

      // ── Step 6: first page setup ───────────────────────────────────────────
      drawPageBg(doc);

      // Monkey-patch addPage so background auto-redraws on every new page
      const _origAddPage = doc.addPage.bind(doc);
      (doc as any).addPage = function() {
        const r = _origAddPage.apply(this, arguments as any);
        drawPageBg(this as typeof doc);
        return r;
      };

      let y = topMargin;

      // ── Step 7: company text header (none mode or fallback) ────────────────
      if (letterheadMode === "none") {
        if (logoB64) {
          doc.addImage(logoB64, "JPEG", ML, y - 4, 16, 16);
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(currentCompany?.name || "", ML + 20, y + 4);
          y += 14;
        } else {
          doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(currentCompany?.name || "", ML, y + 4); y += 10;
        }
        if (currentCompany?.vatNumber) {
          doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
          doc.text(`VAT: ${currentCompany.vatNumber}  |  CR: ${currentCompany.crNumber || ""}  |  ${currentCompany.city || ""}`, ML, y);
          y += 5;
        }
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`${sanitize(filename).replace(/_/g, " ").toUpperCase()}   |   ${new Date().toLocaleDateString()}`, ML, y);
        y += 2;
        doc.setDrawColor(220); doc.line(ML, y + 2, pw - MR, y + 2); y += 7;
      }

      // ── Step 8: table sections ─────────────────────────────────────────────
      const sections = getSections();
      sections.forEach(sec => {
        if (!sec.data.length) return;
        const keys = sec.headers || Object.keys(sec.data[0]);
        const body = sec.data.map(row => {
          const flat = flattenRow(row);
          return keys.map(k => String(flat[k] ?? ""));
        });

        // Section title bar
        doc.setFillColor(15, 23, 42);
        doc.rect(ML, y, pw - ML - MR, 8, "F");
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
          styles: { fontSize: 7, cellPadding: 2.5, overflow: "linebreak" },
          // top/bottom margins prevent table from drawing over letterhead
          margin: { left: ML, right: MR, top: topMargin, bottom: botMargin + 10 },
          rowPageBreak: "avoid",
          didDrawPage: (data) => {
            // On continuation pages redraw foreground branding on top of the table
            if (data.pageNumber > 1) drawPageFg(doc);
          },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      });

      // ── Step 9: signatory + stamp ──────────────────────────────────────────
      if (selectedSig || includeStamp) {
        // Ensure enough space — if not, add page
        const needH = 50;
        const maxY = ph - botMargin - needH;
        if (y > maxY) { doc.addPage(); y = topMargin; }

        doc.setDrawColor(200); doc.setLineWidth(0.3);
        doc.line(ML, y, pw - MR, y); y += 8;

        if (selectedSig) {
          // Signature image above the line
          if (sigB64) {
            doc.addImage(sigB64, "JPEG", ML, y, 45, 16);
            y += 18;
          }
          doc.setDrawColor(140); doc.line(ML, y, ML + 60, y); y += 4;
          doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(selectedSig.name, ML, y + 4);
          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80);
          doc.text(selectedSig.designation || "", ML, y + 9);
          doc.setFontSize(7); doc.setTextColor(140);
          doc.text(language === "ar" ? "المفوض بالتوقيع" : "Authorized Signatory", ML, y + 14);
        }

        if (stampB64) {
          // Stamp on right side, vertically centred with signatory block
          const stampSize = 38;
          const stampY = selectedSig ? y - (sigB64 ? 18 : 0) - 4 : y - 4;
          doc.addImage(stampB64, "JPEG", pw - MR - stampSize, stampY, stampSize, stampSize);
        }
      }

      // ── Step 10: page numbers + final foreground pass ──────────────────────
      const total = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        // Redraw foreground branding on top of everything on every page
        drawPageFg(doc);
        // Page number — positioned inside the safe footer area
        const numY = isFullMode
          ? ph - FULL_BOTTOM + 6
          : footerH > 0
            ? ph - footerH - 2
            : ph - 6;
        doc.setFontSize(7);
        doc.setTextColor(isFullMode ? 200 : 130);
        doc.text(`Page ${p} of ${total}`, pw - MR, numY, { align: "right" });
        doc.text("Safqa — ZATCA Compliant ERP", ML, numY);
      }

      doc.save(`${sanitize(filename)}.pdf`);
      setOpen(false);
    } catch (e) { console.error("PDF export failed", e); alert("PDF generation failed. Check console for details."); }
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
                  {letterheadMode === "full" && <p>✓ {language === "ar" ? "ترويسة صفحة كاملة" : "Full page letterhead"} — {letterheads.find(l => l.id === selectedLetterheadId)?.name || "Primary"}</p>}
                  {letterheadMode === "header" && <p>✓ {language === "ar" ? "رأس وتذييل" : "Header + footer"} — {letterheads.find(l => l.id === selectedLetterheadId)?.name || "Primary"}</p>}
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
