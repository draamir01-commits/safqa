import * as React from "react";
import { Printer, X, FileText, Loader2, Image as ImageIcon, UserCheck, Stamp } from "lucide-react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useUIStore } from "../../stores/uiStore";
import { useCompanyStore } from "../../stores/companyStore";

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

export interface PrintOptions {
  includeLetterhead: boolean;
  selectedLetterheadId: string;
  includeLogo: boolean;
  includeStamp: boolean;
  selectedSignatoryId: string;
  includeSignature: boolean;
}

interface PrintManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: (options: PrintOptions) => void;
  title: string;
  itemCount?: number;
  // Optional: pass the data rows + column headers to render a proper table
  data?: any[];
  headers?: Record<string, string>;
}

export const PrintManager: React.FC<PrintManagerProps> = ({
  isOpen, onClose, onConfirm, title, itemCount, data, headers
}) => {
  const { language } = useUIStore();
  const { currentCompany } = useCompanyStore();
  const [step, setStep] = React.useState<"options" | "generating">("options");

  const [lhMode, setLhMode] = React.useState<"none" | "header" | "full">("none");
  const [selectedLetterheadId, setSelectedLetterheadId] = React.useState("primary");
  const [includeLogo, setIncludeLogo] = React.useState(true);
  const [includeStamp, setIncludeStamp] = React.useState(false);
  const [selectedSigId, setSelectedSigId] = React.useState("");
  const [includeSignature, setIncludeSignature] = React.useState(false);
  const [signatories, setSignatories] = React.useState<AuthorizedSignatory[]>([]);
  const [letterheads, setLetterheads] = React.useState<LetterheadOption[]>([]);

  React.useEffect(() => {
    if (!isOpen) { setStep("options"); return; }
    if (!currentCompany) return;
    const co = currentCompany as any;

    // Auto-detect letterhead mode
    if (co?.fullLetterhead) setLhMode("full");
    else if (co?.additionalLetterheads?.length || co?.headerAsset) setLhMode("header");
    else setLhMode("none");

    // Load letterheads
    const lhs: LetterheadOption[] = [
      { id: "primary", name: "Primary Letterhead", url: co?.fullLetterhead || co?.headerAsset || "" }
    ];
    (co?.additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setLetterheads(lhs);

    // Load signatories
    getDocs(query(collection(db, "companies", currentCompany.id, "signatories"), where("isActive", "==", true)))
      .then(snap => {
        const sigs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuthorizedSignatory));
        setSignatories(sigs);
        if (sigs.length === 1) {
          setSelectedSigId(sigs[0].id);
          setIncludeSignature(!!(sigs[0] as any).signatureUrl);
        } else if (co?.defaultSignatoryId) {
          const fnd = sigs.find(s => s.id === co.defaultSignatoryId);
          if (fnd) { setSelectedSigId(fnd.id); setIncludeSignature(!!(fnd as any).signatureUrl); }
        }
      });
    setIncludeLogo(co?.defaultShowLogo ?? !!(co?.logo));
    setIncludeStamp(co?.defaultShowStamp ?? !!(co?.stamp));
  }, [isOpen, currentCompany]);

  const selectedSig = signatories.find(s => s.id === selectedSigId);

  const generateAndPrint = () => {
    // Open window FIRST (synchronously) to avoid popup blocker
    const win = window.open("", "_blank", "width=960,height=800");
    if (!win) { alert("Please allow popups to print / export PDF"); return; }
    win.document.write("<html><body style='font-family:sans-serif;padding:40px;color:#555'>Generating...</body></html>");
    setStep("generating");
    onClose();

    try {
      const co = currentCompany as any;
      const selLH = letterheads.find(l => l.id === selectedLetterheadId) || letterheads[0];
      const lhUrl = selLH?.url || co?.fullLetterhead || "";
      const headerUrl = co?.headerAsset || co?.letterheadHeader || "";
      const footerUrl = co?.footerAsset || co?.letterheadFooter || "";
      const sigObj = selectedSig;

      // ── Letterhead ──────────────────────────────────────────────────────
      let padTop = "14mm", padBot = "20mm";
      let headerHTML = "";
      if (lhMode === "full" && lhUrl) {
        headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1"><img src="${lhUrl}" style="width:100%;height:100%;object-fit:fill"/></div>`;
        padTop = "52mm";
        padBot = "28mm";
      } else if (lhMode === "header") {
        const hUrl = headerUrl || lhUrl;
        if (hUrl) {
          headerHTML = `<div style="position:fixed;top:0;left:0;width:100%;z-index:5;line-height:0"><img src="${hUrl}" style="width:100%;max-height:50mm;object-fit:cover;display:block"/></div>`;
          padTop = "55mm";
        }
      } else {
        const leftLines = [co?.address, co?.city ? co.city + ", KSA" : "", co?.phone, co?.vatNumber ? "VAT: " + co.vatNumber : ""].filter(Boolean).map((l: string) => `<div style="font-size:7.5pt;color:#444;line-height:1.7">${l}</div>`).join("");
        headerHTML = `<table style="width:100%;border-bottom:2px solid #e2e8f0;margin-bottom:12px;border-collapse:collapse"><tr>
          <td style="width:38%;vertical-align:top;padding-bottom:10px"><div style="font-size:11pt;font-weight:700;margin-bottom:4px">${co?.name || ""}</div>${leftLines}</td>
          <td style="width:24%;text-align:center;vertical-align:middle">${includeLogo && co?.logo ? `<img src="${co.logo}" style="max-height:55px;max-width:110px;object-fit:contain;display:block;margin:0 auto"/>` : ""}</td>
          <td style="width:38%;text-align:right;vertical-align:top;padding-bottom:10px"><div style="font-family:Cairo,Arial,sans-serif;font-size:11pt;font-weight:700;direction:rtl;margin-bottom:4px">${co?.nameAr || co?.name || ""}</div></td>
        </tr></table>`;
      }

      // ── Footer ───────────────────────────────────────────────────────────
      const pgLine = `<div style="display:flex;justify-content:space-between;padding:4px 12mm;font-size:7pt;color:#888;border-top:0.5px solid #e8ecf0"><span>${co?.name || ""}</span><span>${title}</span><span>${new Date().toLocaleDateString()}</span></div>`;
      let footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;z-index:10">${pgLine}</div>`;
      if (lhMode === "header" && footerUrl) {
        footerHTML = `<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff">${pgLine}<div style="line-height:0"><img src="${footerUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block"/></div></div>`;
        padBot = "32mm";
      }
      if (lhMode === "full") { footerHTML = ""; padBot = "32mm"; }

      // ── Table rows ───────────────────────────────────────────────────────
      const cols = headers ? Object.entries(headers) : [];
      let tableHTML = "";
      if (cols.length && data?.length) {
        const ths = cols.map(([, label]) => `<th style="padding:7px 8px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt">${label}</th>`).join("");
        const trs = data.map((row, i) =>
          `<tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"}">` +
          cols.map(([key]) => `<td style="padding:5px 8px;border:0.5px solid #e2e8f0;font-size:8pt">${String(row[key] ?? "")}</td>`).join("") +
          `</tr>`
        ).join("");
        tableHTML = `<table style="width:100%;border-collapse:collapse;margin-bottom:12px"><thead><tr style="background:#2d3748;color:#fff">${ths}</tr></thead><tbody>${trs}</tbody></table>`;
      }

      // ── Signatory + stamp ────────────────────────────────────────────────
      const sigHTML = (sigObj || (includeStamp && co?.stamp)) ? `
        <div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;${lhMode==='full'?'margin-bottom:16mm':''}">
          <div style="flex:1">${sigObj ? `
            <div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>
            ${includeSignature && (sigObj as any).signatureUrl ? `<img src="${(sigObj as any).signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}
            <div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div>
            <div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div>
            <div style="font-size:8pt;color:#555">${sigObj.designation || ""}</div>` : ""}
          </div>
          ${includeStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:80px;height:80px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}
        </div>` : "";

      const html = [
        "<!DOCTYPE html><html><head><meta charset='UTF-8'/>",
        `<title>${title}</title>`,
        "<style>*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}",
        `body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}`,
        `@media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}`,
        "</style></head><body>",
        headerHTML,
        `<div style="text-align:center;margin:8px 0 12px"><span style="font-size:18pt;font-weight:800">${title}</span></div>`,
        `<div style="border-top:2px solid #e2e8f0;margin-bottom:12px"></div>`,
        tableHTML,
        sigHTML,
        footerHTML,
        `<script>document.title="${title}";window.onload=function(){setTimeout(function(){window.print()},1200)};</script>`,
        "</body></html>"
      ].join("\n");

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      win?.close();
      alert("Failed to generate PDF");
    } finally {
      setStep("options");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden max-h-[90vh] flex flex-col">

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-800">{language === "ar" ? "طباعة / تصدير PDF" : "Print / Export PDF"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Document info */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-start gap-3">
            <FileText className="h-7 w-7 text-brand-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">{title}</p>
              {itemCount !== undefined && <p className="text-xs text-slate-500">{itemCount} {language === "ar" ? "سجل" : "records"}</p>}
              {currentCompany && <p className="text-xs text-slate-400">{currentCompany.name}</p>}
            </div>
          </div>

          {step === "generating" ? (
            <div className="flex items-center justify-center gap-3 py-6 text-brand-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">{language === "ar" ? "جاري الإنشاء..." : "Generating PDF..."}</span>
            </div>
          ) : (
            <>
              {/* Letterhead mode */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "الترويسة" : "Letterhead"}</p>
                <div className="space-y-2">
                  {([
                    { mode: "none",   icon: "⊘", labelEn: "No Letterhead",       descEn: "Plain company text header" },
                    { mode: "header", icon: "▬", labelEn: "Header + Footer",      descEn: "Banner image top & bottom" },
                    { mode: "full",   icon: "▮", labelEn: "Full Page Letterhead", descEn: "Full A4 background" },
                  ] as const).map(opt => (
                    <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${lhMode === opt.mode ? "border-brand-primary bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="radio" name="pmLH" checked={lhMode === opt.mode} onChange={() => setLhMode(opt.mode)} className="mt-0.5 text-brand-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{opt.icon}</span>
                          <span className="text-xs font-semibold text-slate-700">{opt.labelEn}</span>
                          {opt.mode === "full" && !(currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-amber-500 font-semibold">not uploaded</span>}
                          {opt.mode === "full" && (currentCompany as any)?.fullLetterhead && <span className="text-[9px] text-emerald-500 font-semibold">✓ A4</span>}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{opt.descEn}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Logo & Stamp */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "الشعار والختم" : "Logo & Stamp"}</p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الشعار" : "Include Logo"}</span>
                      {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع شعار" : "No logo uploaded"}</p>}
                    </div>
                    <input type="checkbox" checked={includeLogo} onChange={e => setIncludeLogo(e.target.checked)} disabled={!(currentCompany as any)?.logo} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{language === "ar" ? "تضمين الختم" : "Include Stamp"}</span>
                      {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">{language === "ar" ? "لم يُرفع ختم" : "No stamp uploaded"}</p>}
                    </div>
                    <input type="checkbox" checked={includeStamp} onChange={e => setIncludeStamp(e.target.checked)} disabled={!(currentCompany as any)?.stamp} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                </div>
              </div>

              {/* Signatory */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "التوقيع المفوض" : "Authorized Signatory"}</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={selectedSigId} onChange={e => setSelectedSigId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">{language === "ar" ? "بدون توقيع" : "None"}</option>
                    {signatories.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>
                  {selectedSig && (selectedSig as any).signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer mt-1">
                      <span className="text-xs text-slate-600">{language === "ar" ? "تضمين صورة التوقيع" : "Include signature image"}</span>
                      <input type="checkbox" checked={includeSignature} onChange={e => setIncludeSignature(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                  {signatories.length === 0 && <p className="text-[10px] text-slate-400">{language === "ar" ? "أضف مفوضين من الإعدادات" : "Add signatories in Settings"}</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {step !== "generating" && (
          <div className="p-5 border-t border-slate-100 shrink-0">
            <button
              onClick={generateAndPrint}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-brand-primary text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <FileText className="h-4 w-4" />
              {language === "ar" ? "طباعة / حفظ PDF" : "Print / Save as PDF"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintManager;
