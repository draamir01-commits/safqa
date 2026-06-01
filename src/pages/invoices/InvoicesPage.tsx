import * as React from "react";
import { ExportMenu } from "../../components/ui/ExportMenu";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Eye, Printer, ShieldAlert, Sparkles, AlertCircle, FileSpreadsheet, Pencil, Trash2, X, CheckCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";

import { useCompanyStore } from "../../stores/companyStore";
import { useAuthStore } from "../../stores/authStore";
import { useUIStore } from "../../stores/uiStore";
import { PrintManager } from "../../components/ui/PrintManager";

import { listenCompanyCollection, updateDocument, deleteDocument } from "../../firebase/firestore";
import { generateZatcaQrHtmlCanvas, generateQRDataURL, encodeTLV } from "../../utils/zatca/qrEncoder";
import { processPhase1Invoice } from "../../utils/zatca/phase1";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Invoice, InvoiceStatus, ZatcaStatus } from "../../types";

import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import DataTable, { Column } from "../../components/ui/DataTable";
import CurrencyDisplay from "../../components/ui/CurrencyDisplay";

export const InvoicesPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentCompany } = useCompanyStore();
  const { language } = useUIStore();

  const { user } = useAuthStore();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [showPrint, setShowPrint] = React.useState(false);


  // Export options panel (same as quotations)
  const [showExportPanel, setShowExportPanel] = React.useState(false);
  const [exportingInvoice, setExportingInvoice] = React.useState<Invoice | null>(null);
  const [expLHMode, setExpLHMode] = React.useState<"none"|"header"|"full">("none");
  const [expLHId, setExpLHId] = React.useState("primary");
  const [expLogo, setExpLogo] = React.useState(true);
  const [expStamp, setExpStamp] = React.useState(false);
  const [expSigId, setExpSigId] = React.useState("");
  const [expIncludeSig, setExpIncludeSig] = React.useState(false);
  const [expSignatories, setExpSignatories] = React.useState<any[]>([]);
  const [expLetterheads, setExpLetterheads] = React.useState<any[]>([]);
  const [expGenerating, setExpGenerating] = React.useState(false);

  React.useEffect(() => {
    if (!showExportPanel || !currentCompany) return;
    const co = currentCompany as any;
    // Load signatories
    // Load signatories using already-imported db and collection functions
    (async () => {
      try {
        const { collection: fc, query: fq, where: fw, getDocs: fgd } = await import("firebase/firestore");
        const qsig = fq(fc(db, "companies", currentCompany.id, "signatories"), fw("isActive", "==", true));
        const snap = await fgd(qsig);
        const sigs = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
        setExpSignatories(sigs);
        if (sigs.length === 1) { setExpSigId(sigs[0].id); setExpIncludeSig(!!(sigs[0] as any).signatureUrl); }
      } catch {}
    })();
    // Build letterheads
    const lhs: any[] = [{ id: "primary", name: "Primary Letterhead", url: co?.fullLetterhead || "" }];
    (co?.additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setExpLetterheads(lhs);
    // Smart defaults
    setExpLogo(co?.defaultShowLogo ?? !!(co?.logo));
    setExpStamp(co?.defaultShowStamp ?? !!(co?.stamp));
    if (co?.fullLetterhead) setExpLHMode("full");
    else if (co?.additionalLetterheads?.length) setExpLHMode("header");
    else setExpLHMode("none");
  }, [showExportPanel, currentCompany]);

  const openExportPanel = (inv: Invoice) => {
    const co = currentCompany as any;
    setExportingInvoice(inv);
    // Pre-build letterheads immediately (no async needed)
    const lhs: any[] = [{ id: "primary", name: "Primary Letterhead", url: co?.fullLetterhead || "" }];
    (co?.additionalLetterheads || []).forEach((lh: any) => lhs.push(lh));
    setExpLetterheads(lhs);
    // Smart defaults
    setExpLogo(co?.defaultShowLogo ?? !!(co?.logo));
    setExpStamp(co?.defaultShowStamp ?? !!(co?.stamp));
    if (co?.fullLetterhead) setExpLHMode("full");
    else if (co?.additionalLetterheads?.length) setExpLHMode("header");
    else setExpLHMode("none");
    setShowExportPanel(true);
  };
  const [qrDataUrl, setQrDataUrl] = React.useState<string>("");
  const [generatingQr, setGeneratingQr] = React.useState(false);

  // Edit modal state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);
  // Edit form fields
  const [editIssueDate, setEditIssueDate] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editSupplyDate, setEditSupplyDate] = React.useState("");
  const [editStatus, setEditStatus] = React.useState("");
  const [editPaymentStatus, setEditPaymentStatus] = React.useState("");
  const [editAmountPaid, setEditAmountPaid] = React.useState("");
  const [editNotes, setEditNotes] = React.useState("");
  const [editNotesAr, setEditNotesAr] = React.useState("");
  const [editCustomerName, setEditCustomerName] = React.useState("");
  const [editCustomerNameAr, setEditCustomerNameAr] = React.useState("");
  const [editCustomerVat, setEditCustomerVat] = React.useState("");
  // Edit line items
  const [editLines, setEditLines] = React.useState<any[]>([]);

  // Set up realtime sync listen
  React.useEffect(() => {
    if (!currentCompany) return;
    const unsubscribe = listenCompanyCollection(currentCompany.id, "invoices", (data) => {
      // Sort newest first
      const sorted = (data as Invoice[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInvoices(sorted);
    });
    return unsubscribe;
  }, [currentCompany]);

  const handleOpenPreview = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setQrDataUrl("");
    setPreviewOpen(true);
    setGeneratingQr(true);
    try {
      if (inv.zatcaQRCode) {
        // Already has TLV base64 — generate QR image from it
        const url = await generateQRDataURL(inv.zatcaQRCode);
        setQrDataUrl(url);
      } else if (currentCompany) {
        // Missing QR (e.g. converted from quotation without phase1) — generate now
        const tlv = encodeTLV(
          currentCompany.nameAr || currentCompany.name,
          currentCompany.vatNumber || "",
          inv.issueDate ? new Date(inv.issueDate).toISOString() : new Date().toISOString(),
          String(inv.grandTotal),
          String(inv.totalVat)
        );
        const url = await generateQRDataURL(tlv);
        setQrDataUrl(url);
        // Save the generated QR back to Firestore so it persists
        if (inv.id) {
          updateDocument(`companies/${currentCompany.id}/invoices`, inv.id, {
            zatcaQRCode: tlv,
            updatedAt: new Date(),
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("QR generation failed:", e);
    } finally {
      setGeneratingQr(false);
    }
  };

  // ── Load image as base64 for PDF ─────────────────────────────────────────
  // ── Robust image loader: cache → fetch+CORS → white canvas composite ──
  const loadImgB64 = async (url: string): Promise<string> => {
    if (!url) throw new Error("No URL");
    if (url.startsWith("data:")) return url;

    const cacheKey = "img_cache_" + btoa(url.slice(0, 100)).replace(/[^a-z0-9]/gi, "");
    try {
      // 1. Check localStorage cache
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;

      // 2. Fetch with CORS (works for Firebase Storage URLs)
      let dataUrl = url;
      try {
        const resp = await fetch(url, { mode: "cors", credentials: "omit" });
        if (resp.ok) {
          const blob = await resp.blob();
          dataUrl = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onloadend = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
          try { localStorage.setItem(cacheKey, dataUrl); } catch {}
        }
      } catch { /* fallback to direct img load */ }

      // 3. Load via Image element
      const rawImg = await new Promise<HTMLImageElement>((res, rej) => {
        const img = new window.Image();
        if (dataUrl.startsWith("http")) img.crossOrigin = "anonymous";
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("load failed"));
        img.src = dataUrl;
      });

      // 4. Composite on white canvas (fixes transparency + black square bug)
      const canvas = document.createElement("canvas");
      canvas.width = rawImg.naturalWidth || rawImg.width || 200;
      canvas.height = rawImg.naturalHeight || rawImg.height || 200;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(rawImg, 0, 0);
        const composited = canvas.toDataURL("image/jpeg", 0.95);
        try { localStorage.setItem(cacheKey, composited); } catch {}
        return composited;
      }
      return dataUrl;
    } catch (err) {
      console.error("[loadImgB64] failed:", err);
      throw err;
    }
  };

  // ── Invoice PDF generator — all options applied ─────────────────────────
  const exportInvoicePDF = async (inv: Invoice, qrUrl: string, opts?: { lhMode: string; lhId: string; logo: boolean; stamp: boolean; sigId: string; includeSig: boolean; }) => {
    const co = currentCompany as any;
    const invNum = inv.invoiceNumber || "Invoice";
    const titleEN = inv.type === "simplified" ? "Simplified Tax Invoice" : "Tax Invoice";
    const titleAR = inv.type === "simplified" ? "فاتورة ضريبية مبسطة" : "فاتورة ضريبية";
    const o = opts || { lhMode: "none", lhId: "primary", logo: true, stamp: false, sigId: "", includeSig: false };

    // Resolve letterhead image — build list inline as fallback if state not loaded yet
    const lhList = expLetterheads.length > 0 ? expLetterheads :
      [{ id: "primary", url: co?.fullLetterhead || "" },
       ...((co?.additionalLetterheads || []) as any[])];
    const selLH = lhList.find((l: any) => l.id === o.lhId) || lhList[0];
    const lhImgUrl = selLH?.url || co?.fullLetterhead || "";
    const footerImgUrl = co?.footerAsset || co?.letterheadFooter || "";

    // Resolve signatory
    const sigObj = expSignatories.find((s: any) => s.id === o.sigId) || null;

    // Company text lines
    const leftLines = [co?.address||"", co?.city ? co.city+", Kingdom of Saudi Arabia":"",
      co?.email||"", co?.phone||"",
      co?.vatNumber ? "VAT number "+co.vatNumber:"", co?.crNumber ? "CR Number "+co.crNumber:""]
      .filter(Boolean).map(l=>`<div style="font-size:7.5pt;color:#444;line-height:1.7">${l}</div>`).join("");

    const rightLines = [co?.addressAr||co?.address||"",
      co?.vatNumber ? "رقم التسجيل الضريبي "+co.vatNumber:"",
      co?.crNumber ? "رقم السجل التجاري "+co.crNumber:""]
      .filter(Boolean).map(l=>`<div style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#444;line-height:1.7;direction:rtl" lang="ar">${l}</div>`).join("");

    // ── Header section based on mode ──────────────────────────────────────
    let headerHTML = "";
    let bodyPaddingTop = "12mm";
    let bodyPaddingBottom = "22mm";

    if (o.lhMode === "full" && lhImgUrl) {
      // Full page: image as fixed background behind content
      headerHTML = `
<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1">
  <img src="${lhImgUrl}" style="width:100%;height:100%;object-fit:fill" alt=""/>
</div>`;
      bodyPaddingTop = "48mm";
    } else if (o.lhMode === "header" && lhImgUrl) {
      // Header banner: image at very top, proportional height capped at 50mm
      headerHTML = `
<div style="position:fixed;top:0;left:0;width:100%;z-index:5;line-height:0">
  <img src="${lhImgUrl}" style="width:100%;max-height:50mm;object-fit:cover;display:block" alt=""/>
</div>`;
      bodyPaddingTop = "55mm";
    } else {
      // No letterhead: bilingual text header
      headerHTML = `
<table style="width:100%;border-bottom:2px solid #e2e8f0;margin-bottom:10px;border-collapse:collapse">
  <tr>
    <td style="width:38%;vertical-align:top;padding-bottom:10px">
      <div style="font-size:11pt;font-weight:700;margin-bottom:4px">${co?.name||""}</div>
      ${leftLines}
    </td>
    <td style="width:24%;text-align:center;vertical-align:middle;padding:0 8px 10px">
      ${o.logo && co?.logo ? `<img src="${co.logo}" style="max-height:55px;max-width:110px;object-fit:contain;display:block;margin:0 auto"/>` : ""}
    </td>
    <td style="width:38%;text-align:right;vertical-align:top;padding-bottom:10px">
      <div style="font-family:Cairo,Arial,sans-serif;font-size:11pt;font-weight:700;direction:rtl;margin-bottom:4px" lang="ar">${co?.nameAr||""}</div>
      ${rightLines}
    </td>
  </tr>
</table>`;
    }

    // ── Footer section based on mode ──────────────────────────────────────
    let footerHTML = "";
    const pageNumBar = `<div style="display:flex;justify-content:space-between;font-size:7pt;color:#888;padding:4px 0"><span>${co?.name||""}</span><span>Page 1 of 1 - ${invNum}</span><span>${invNum}</span></div>`;

    if (o.lhMode === "header" && footerImgUrl) {
      footerHTML = `
<div style="position:fixed;bottom:0;left:0;width:100%;z-index:5;background:#fff">
  ${pageNumBar.replace('padding:4px 0', 'padding:4px 0;border-top:0.5px solid #e8ecf0')}
  <div style="line-height:0"><img src="${footerImgUrl}" style="width:100%;max-height:25mm;object-fit:cover;display:block" alt=""/></div>
</div>`;
      bodyPaddingBottom = "32mm";
    } else if (o.lhMode === "full") {
      footerHTML = `
<div style="position:fixed;bottom:6mm;left:0;width:100%;z-index:10;padding:0 12mm">
  ${pageNumBar}
</div>`;
    } else {
      footerHTML = `
<div style="position:fixed;bottom:0;left:0;width:100%;background:#fff;border-top:0.5px solid #e8ecf0;padding:5px 12mm 6px;z-index:10">
  ${pageNumBar}
</div>`;
    }

    // ── Info grid row ──────────────────────────────────────────────────────
    const IR = (le: string, ve: string, la: string, va: string) => !ve && !va ? "" :
      `<tr>
        <td style="font-weight:700;padding:5px 8px;width:95px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">${le}</td>
        <td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;min-width:110px">${ve||""}</td>
        <td style="font-family:Cairo,Arial,sans-serif;font-weight:700;padding:5px 8px;width:110px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl" lang="ar">${la}</td>
        <td style="font-family:Cairo,Arial,sans-serif;padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;min-width:110px" lang="ar">${va||""}</td>
      </tr>`;

    // ── Line items ─────────────────────────────────────────────────────────
    const lineRows = (inv.lineItems||[]).map((l:any,i:number)=>{
      const net = (l.lineTotal||0)-(l.vatAmount||0);
      return `<tr style="background:${i%2===0?"#fff":"#f8fafc"}">
        <td style="text-align:center;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${i+1}</td>
        <td style="padding:6px 7px;border:0.5px solid #cbd5e0;font-size:8pt">${l.name||""}${l.nameAr?`<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#666;direction:rtl" lang="ar">${l.nameAr}</span>`:""}</td>
        <td style="text-align:center;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${l.qty||1}<br><span style="font-size:7pt;color:#666">${l.unit||"PCE"}</span></td>
        <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${(l.unitPrice||0).toFixed(2)}</td>
        <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${net.toFixed(2)}</td>
        <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${(l.vatAmount||0).toFixed(2)}<br><span style="font-size:7pt;color:#666">${l.vatRate||15}%</span></td>
        <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt;font-weight:700">${(l.lineTotal||0).toFixed(2)}</td>
      </tr>`;
    }).join("");

    // ── Signatory + Stamp ──────────────────────────────────────────────────
    const sigHTML = (sigObj || (o.stamp && co?.stamp)) ? `
<div style="margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px">
  <div style="flex:1;min-width:0">
    <div style="font-size:9pt;font-weight:700;color:#1a1a1a;margin-bottom:12px">Authorized Signatory / <span style="font-family:Cairo,Arial,sans-serif" lang="ar">المفوض بالتوقيع</span></div>
    ${sigObj && o.includeSig && (sigObj as any).signatureUrl ? `<img src="${(sigObj as any).signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:4px"/>` : `<div style="height:36px"></div>`}
    <div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div>
    <div style="font-size:9.5pt;font-weight:700;color:#1a1a1a">${sigObj ? (sigObj as any).name : ""}</div>
    <div style="font-size:8pt;color:#555;margin-top:2px">${sigObj ? ((sigObj as any).designation||"") : ""}</div>
  </div>
  ${o.stamp && co?.stamp ? `<div style="flex-shrink:0;text-align:center"><img src="${co.stamp}" style="width:90px;height:90px;object-fit:contain;display:block"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp / <span style="font-family:Cairo,Arial,sans-serif" lang="ar">ختم الشركة</span></div></div>` : ""}
</div>` : "";

    const html = `<!DOCTYPE html>
<html lang="en" translate="no">
<head>
<meta charset="UTF-8"/>
<title>${invNum}</title>
<style>
${FONT_CSS}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${bodyPaddingTop} 12mm ${bodyPaddingBottom}}
table{border-collapse:collapse;width:100%}
@media print{@page{size:A4;margin:0}body{padding:${bodyPaddingTop} 8mm ${bodyPaddingBottom}}}
</style>
</head>
<body translate="no">

${headerHTML}

<!-- TITLE -->
<div style="text-align:center;margin:8px 0 4px">
  <span style="font-size:18pt;font-weight:800;margin-right:24px">${titleEN}</span>
  <span style="font-family:Cairo,Arial,sans-serif;font-size:18pt;font-weight:800;direction:rtl" lang="ar">${titleAR}</span>
</div>
<div style="border-top:2px solid #e2e8f0;margin-bottom:8px"></div>

<!-- INFO GRID -->
<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
  ${IR("Customer", inv.customerName||"", "العميل", inv.customerNameAr||inv.customerName||"")}
  ${inv.customerAddress ? IR("Address", inv.customerAddress, "العنوان", inv.customerAddress) : ""}
  ${inv.customerVatNumber ? IR("VAT number", inv.customerVatNumber, "رقم التسجيل الضريبي", inv.customerVatNumber) : ""}
  ${IR("Invoice number", invNum, "رقم الفاتورة", invNum)}
  ${IR("Date", inv.issueDate||"", "التاريخ", inv.issueDate||"")}
  ${(inv as any).projectName ? IR("Project", (inv as any).projectName, "المشروع", (inv as any).projectName) : ""}
  ${inv.dueDate ? IR("Due date", inv.dueDate, "تاريخ الاستحقاق", inv.dueDate) : ""}
</table>

<!-- ITEMS TABLE -->
<table style="width:100%;border-collapse:collapse;margin-bottom:10px">
  <thead>
    <tr style="background:#2d3748;color:#fff">
      <th style="padding:6px 5px;text-align:center;border:0.5px solid #4a5568;font-size:7.5pt;width:22px">#</th>
      <th style="padding:6px 7px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt">Description<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0;direction:rtl" lang="ar">الوصف</span></th>
      <th style="padding:6px 5px;text-align:center;border:0.5px solid #4a5568;font-size:7.5pt;width:44px">Qty<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0" lang="ar">الكمية</span></th>
      <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:58px">Price<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0" lang="ar">السعر</span></th>
      <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:70px">Taxable amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0" lang="ar">المبلغ الخاضع</span></th>
      <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:62px">VAT amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0" lang="ar">القيمة المضافة</span></th>
      <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:68px">Line amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0" lang="ar">المجموع</span></th>
    </tr>
  </thead>
  <tbody>
    ${lineRows||`<tr><td colspan="7" style="text-align:center;padding:12px;color:#999">No items</td></tr>`}
  </tbody>
</table>

<!-- QR + TOTALS -->
<table style="width:100%;margin-bottom:12px">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:12px">
      ${qrUrl ? `<img src="${qrUrl}" style="width:88px;height:88px;border:0.5px solid #dde;display:block"/>` : ""}
      <div style="font-size:6.5pt;color:#555;margin-top:5px;max-width:200px;line-height:1.5">
        This QR code is encoded as per ZATCA e-invoicing requirements<br>
        <span style="font-family:Cairo,Arial,sans-serif;direction:rtl;display:block;margin-top:3px" lang="ar">تم ترميز هذا الرمز وفقاً لمتطلبات هيئة الزكاة</span>
      </div>
    </td>
    <td style="width:50%;vertical-align:top">
      <table style="width:100%;border-collapse:collapse;border:0.5px solid #c8cdd5">
        <tr><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600">Subtotal<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#555;direction:rtl;display:block" lang="ar">المجموع الفرعي</span></td><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600;text-align:right">${(inv.subtotal||0).toFixed(2)} ریال</td></tr>
        <tr><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600">Total VAT<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#555;direction:rtl;display:block" lang="ar">إجمالي ضريبة القيمة المضافة</span></td><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600;text-align:right">${(inv.totalVat||0).toFixed(2)} ریال</td></tr>
        <tr style="background:#1e2d3d"><td style="padding:6px 10px;border:0.5px solid #2d3e4f;font-size:8pt;font-weight:700;color:#fff">Total<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#ccc;direction:rtl;display:block" lang="ar">المجموع شامل القيمة المضافة</span></td><td style="padding:6px 10px;border:0.5px solid #2d3e4f;font-size:8pt;font-weight:700;color:#fff;text-align:right">${(inv.grandTotal||0).toFixed(2)} ریال</td></tr>
      </table>
    </td>
  </tr>
</table>

${sigHTML}
${footerHTML}

<script>
document.title="${invNum}";
window.onload=function(){setTimeout(function(){window.print()},1200)};
</script>
</body></html>`;
    return html;
  };

    const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditIssueDate(inv.issueDate || "");
    setEditDueDate(inv.dueDate || "");
    setEditSupplyDate(inv.supplyDate || inv.issueDate || "");
    setEditStatus(inv.status || "draft");
    setEditPaymentStatus(inv.paymentStatus || "unpaid");
    setEditAmountPaid(String(inv.amountPaid || 0));
    setEditNotes(inv.notes || "");
    setEditNotesAr(inv.notesAr || "");
    setEditCustomerName(inv.customerName || "");
    setEditCustomerNameAr(inv.customerNameAr || "");
    setEditCustomerVat(inv.customerVatNumber || "");
    setEditLines(inv.lineItems ? inv.lineItems.map(l => ({ ...l })) : []);
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingInvoice || !currentCompany) return;
    setEditSaving(true);
    try {
      // Recalculate totals from edited lines
      let subtotal = 0, totalVat = 0, totalDiscount = 0;
      const recalcLines = editLines.map(l => {
        const lineNet = l.qty * l.unitPrice;
        const disc = l.discountAmount || 0;
        const net = lineNet - disc;
        const vat = Math.round(net * (l.vatRate / 100) * 100) / 100;
        const total = Math.round((net + vat) * 100) / 100;
        subtotal += net;
        totalVat += vat;
        totalDiscount += disc;
        return { ...l, vatAmount: vat, lineTotal: total };
      });
      const grandTotal = Math.round((subtotal + totalVat - totalDiscount) * 100) / 100;
      const amountPaidNum = parseFloat(editAmountPaid) || 0;

      await updateDocument(`companies/${currentCompany.id}/invoices`, editingInvoice.id, {
        issueDate: editIssueDate,
        dueDate: editDueDate,
        supplyDate: editSupplyDate,
        status: editStatus,
        paymentStatus: editPaymentStatus,
        amountPaid: amountPaidNum,
        amountDue: Math.max(0, grandTotal - amountPaidNum),
        notes: editNotes,
        notesAr: editNotesAr,
        customerName: editCustomerName,
        customerNameAr: editCustomerNameAr,
        customerVatNumber: editCustomerVat,
        lineItems: recalcLines,
        subtotal: Math.round(subtotal * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        grandTotal,
        updatedAt: new Date(),
      });
      toast.success(language === "ar" ? "تم تحديث الفاتورة" : "Invoice updated successfully");
      setEditOpen(false);
      setEditingInvoice(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!currentCompany || !window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الفاتورة؟" : "Delete this invoice permanently?")) return;
    try {
      await deleteDocument(`companies/${currentCompany.id}/invoices`, inv.id);
      toast.success(language === "ar" ? "تم حذف الفاتورة" : "Invoice deleted");
      if (previewOpen && selectedInvoice?.id === inv.id) setPreviewOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const updateEditLine = (idx: number, field: string, value: any) => {
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };



  const columns: Column<Invoice>[] = [
    {
      header: t("invoice.number"),
      render: (row) => (
        <span className="font-bold text-slate-800">{row.invoiceNumber}</span>
      )
    },
    {
      header: t("invoice.customer"),
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-800">{language === "ar" ? row.customerNameAr || row.customerName : row.customerName}</span>
          {row.customerVatNumber && (
            <span className="text-[10px] text-slate-400 font-mono">VAT: {row.customerVatNumber}</span>
          )}
        </div>
      )
    },
    {
      header: t("invoice.issueDate"),
      render: (row) => (
        <span className="text-xs text-slate-605">{formatDate(row.issueDate, language)}</span>
      )
    },
    {
      header: t("invoice.total"),
      render: (row) => (
        <div className="flex flex-col text-slate-800 font-bold text-xs">
          <CurrencyDisplay amount={row.grandTotal} />
          <span className="text-[9px] text-emerald-600 font-medium">%15 VAT incl.</span>
        </div>
      )
    },
    {
      header: "ZATCA " + t("nav.zatca"),
      render: (row) => {
        const statuses: { [key: string]: string } = {
          cleared: "bg-emerald-50 text-emerald-800 border-emerald-250 font-bold",
          reported: "bg-teal-50 text-teal-800 border-teal-200",
          failed: "bg-red-50 text-red-800 border-red-200 font-bold",
          not_submitted: "bg-slate-100 text-slate-600 border-slate-200"
        };
        const stCl = statuses[row.zatcaStatus] || "bg-slate-50 text-slate-600";
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase border font-semibold ${stCl}`}>
            {row.zatcaStatus === "not_submitted" ? (language === "ar" ? "جاهز/محلي" : "Local draft") : row.zatcaStatus}
          </span>
        );
      }
    },
    {
      header: t("invoice.status"),
      render: (row) => (
        <StatusBadge status={row.status} />
      )
    },
    {
      header: t("common.actions"),
      render: (row) => (
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => handleOpenPreview(row)} className="p-1 px-2 flex items-center gap-1.5 hover:border-brand-primary">
            <Eye className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs">{language === "ar" ? "معاينة" : "View"}</span>
          </Button>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-colors"
            title={language === "ar" ? "تعديل" : "Edit"}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => handleDeleteInvoice(row)}
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title={language === "ar" ? "حذف" : "Delete"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{language === "ar" ? "سجل الفواتير الإلكترونية" : "Tax Invoices Ledger"}</h2>
          <p className="text-xs text-slate-500">Official Phase 1 generation with offline hash-chains & Phase 2 API clearance simulator.</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu data={invoices} filename="invoices" headers={{ invoiceNumber: "Invoice #", customerName: "Customer", issueDate: "Date", grandTotal: "Total", status: "Status", zatcaStatus: "ZATCA" }} />
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            {language === "ar" ? "\u0637\u0628\u0627\u0639\u0629" : "Print"}
          </button>
          <Link to="/invoices/new">
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("invoice.new")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Data Table */}
      <DataTable
        columns={columns}
        data={invoices}
        searchPlaceholder={language === "ar" ? "البحث برقم الفاتورة..." : "Search by number..."}
        searchField="invoiceNumber"
        exportFileName={`safqa-invoices-${Date.now()}.csv`}
      />

      {/* OFFICIALLY CONFORMANT ZATCA INVOICE PREVIEW MODAL */}
      <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title={language === "ar" ? "معاينة الفاتورة الضريبية" : "ZATCA Tax Invoice Preview"} size="lg">
        {selectedInvoice && (
          <div className="flex flex-col gap-6">
            
            {/* Top Toolbar Actions */}
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <div className="flex items-center gap-2">
                <StatusBadge status={selectedInvoice.status} />
                <span className="text-xs text-slate-400">UUID: {selectedInvoice.zatcaUUID?.substring(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setPreviewOpen(false); handleOpenEdit(selectedInvoice); }} className="flex items-center gap-2">
                  <Pencil className="h-3.5 w-3.5" />
                  {language === "ar" ? "تعديل" : "Edit"}
                </Button>
                <Button onClick={() => openExportPanel(selectedInvoice)} variant="success" size="sm" className="flex items-center gap-2 font-bold px-4">
                  <Printer className="h-4 w-4" />
                  {language === "ar" ? "طباعة / تصدير PDF" : "Print / Export PDF"}
                </Button>
              </div>
            </div>

            {/* PRINT WRAPPER FRAME FOR CSS SELECTORS */}
            <div id="zatca-print-frame" className="p-2 select-none" dir={language === "ar" ? "rtl" : "ltr"}>
              <div className="flex flex-col gap-6 border border-slate-100 rounded-lg p-6 bg-white shrink-0">
                
                {/* 1. Header (Corporate Descriptors & Logo) */}
                <div className="flex items-start justify-between border-b pb-4 border-slate-200">
                  {/* Left Side: Corporate Details (Bilingual) */}
                  <div className="flex flex-col gap-1.5 text-right rtl:text-right ltr:text-left">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">
                      {currentCompany?.name}
                    </h1>
                    <h1 className="text-lg font-bold text-slate-900 leading-none font-sans">
                      {currentCompany?.nameAr || "شركة صفقة للتجارة"}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-semibold mt-1">
                      CR No / السجل التجاري: <span className="font-mono text-xs">{currentCompany?.crNumber}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      VAT ID / الرقم الضريبي للمنشأة: <span className="font-mono text-xs text-brand-primary">{currentCompany?.vatNumber}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 leading-tight max-w-sm">
                      {currentCompany?.addressAr || currentCompany?.address}, {currentCompany?.city}, SA
                    </p>
                  </div>

                  {/* Right Side: Document Logo Placeholder or uploaded Asset */}
                  <div className="flex flex-col items-center gap-2">
                    {currentCompany?.logo ? (
                      <div className="h-16 w-16 bg-slate-50 p-1 border rounded object-contain flex items-center justify-center">
                        <img src={currentCompany.logo} alt="corporate logo" className="max-h-full max-w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded bg-brand-primary text-white flex items-center justify-center font-bold text-xl uppercase">
                        ص
                      </div>
                    )}
                    <span className="text-[9px] uppercase font-bold tracking-widest text-[#0F172A] bg-slate-100 px-2 py-0.5 rounded leading-none shrink-0 border border-slate-200">
                      {selectedInvoice.type === "standard" ? (language === "ar" ? "فاتورة ضريبية B2B" : "Tax Invoice B2B") : (language === "ar" ? "فاتورة مبسطة B2C" : "Simplified Tax B2C")}
                    </span>
                  </div>
                </div>

                {/* 2. Metadata Columns (Dates, Numbers, Supply date) */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs font-medium">
                  {/* Left Column values */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "رقم الفاتورة" : "Invoice No."}:</span>
                      <span className="font-bold text-slate-800">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "تاريخ الإصدار" : "Issue Date"}:</span>
                      <span className="text-slate-700">{formatDate(selectedInvoice.issueDate, language)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-bold">{language === "ar" ? "تاريخ التوريد" : "Supply Date"}:</span>
                      <span className="text-slate-705">{formatDate(selectedInvoice.supplyDate || selectedInvoice.issueDate, language)}</span>
                    </div>
                  </div>

                  {/* Right Column: Customer parameters */}
                  <div className="flex flex-col gap-2 border-l rtl:border-l-0 rtl:border-r pl-4 rtl:pl-0 rtl:pr-4">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{language === "ar" ? "العميل المستلم" : "Billed Recipient"}</p>
                    <span className="font-bold text-slate-900 leading-tight">
                      {language === "ar" ? selectedInvoice.customerNameAr || selectedInvoice.customerName : selectedInvoice.customerName}
                    </span>
                    {selectedInvoice.customerVatNumber ? (
                      <div className="flex flex-col gap-1 mt-1 text-[10px] text-slate-500 font-semibold">
                        <p>VAT / الضريبة: <span className="font-mono text-xs">{selectedInvoice.customerVatNumber}</span></p>
                        {selectedInvoice.customerAddress && <p className="text-slate-400 font-medium">{selectedInvoice.customerAddress}</p>}
                      </div>
                    ) : (
                      <span className="text-[10px] text-brand-primary bg-blue-50 px-2 py-0.5 rounded inline-block self-start font-bold mt-1">
                        {language === "ar" ? "فرد - مستهلك نهائي" : "Simplified Final Consumer"}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. Items Table Breakdown */}
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                      <th className="px-3 py-2 text-right">{language === "ar" ? "البيان / الصنف" : "Item Description"}</th>
                      <th className="px-3 py-2 text-center">{language === "ar" ? "الكمية" : "Qty"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "سعر الوحدة" : "Unit Price"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "الخصم" : "Discount"}</th>
                      <th className="px-3 py-2 text-center">{language === "ar" ? "الضريبة" : "VAT %"}</th>
                      <th className="px-3 py-2 text-right">{language === "ar" ? "الإجمالي" : "Amount"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {selectedInvoice.lineItems?.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/20 text-slate-700">
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                          {language === "ar" ? line.nameAr || line.name : line.name}
                          <p className="text-[9px] text-slate-400 font-mono">CODE: {line.productId?.substring(0, 8)}</p>
                        </td>
                        <td className="px-3 py-2.5 text-center font-semibold text-slate-605">{line.qty} {line.unit}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(line.unitPrice, language)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 font-mono">-{formatCurrency(line.discountAmount || 0, language)}</td>
                        <td className="px-3 py-2.5 text-center text-slate-600 font-bold">%{line.vatRate}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900 font-mono">{formatCurrency(line.lineTotal, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 4. Bottom Row: QR block, secure chained hash & Totals Panel */}
                <div className="flex flex-col md:flex-row items-center md:items-start justify-between border-t pt-5 border-slate-200 gap-6">
                  
                  {/* Dynamic ZATCA QR block with generated TLV byte parsing */}
                  <div className="flex flex-col items-center justify-center p-3 border border-slate-150 rounded-lg bg-slate-50 max-w-[200px] gap-2">
                    {generatingQr ? (
                      <div className="h-32 w-32 bg-slate-50 flex items-center justify-center border border-dashed border-slate-300 rounded-sm">
                        <div className="flex flex-col items-center gap-1 text-slate-400">
                          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>
                          <span className="text-[9px]">Generating...</span>
                        </div>
                      </div>
                    ) : qrDataUrl ? (
                      <div className="h-32 w-32 bg-white p-1 rounded-sm border border-slate-200">
                        <img src={qrDataUrl} alt="ZATCA QR Code" className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="h-32 w-32 bg-slate-100 flex items-center justify-center border text-slate-400 text-xs text-center border-dashed border-slate-300">
                        QR Code unavailable
                      </div>
                    )}
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide text-center">
                      ZATCA SHA256 APPROVED
                    </span>
                  </div>

                  {/* Invoice Totals Summaries */}
                  <div className="w-full md:max-w-xs flex flex-col gap-2 text-right">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span>{language === "ar" ? "المجموع الخاضع للضريبة" : "Taxable Subtotal"}:</span>
                      <span className="font-mono text-slate-700">{formatCurrency(selectedInvoice.subtotal, language)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 border-b pb-1.5">
                      <span>{language === "ar" ? "إجمالي الخصومات" : "Total Discounts"}:</span>
                      <span className="font-mono text-slate-700">-{formatCurrency(selectedInvoice.totalDiscount || 0, language)}</span>
                    </div>

                    {/* VAT break counts */}
                    {selectedInvoice.vatBreakdown?.map((v, vIdx) => (
                      <div key={vIdx} className="flex justify-between items-center text-xs font-bold text-slate-500">
                        <span>{language === "ar" ? `مجموع ضريبة القيمة المضافة (${v.rate}%)` : `VAT Amount (${v.rate}%)`}:</span>
                        <span className="font-mono text-slate-800">{formatCurrency(v.amount, language)}</span>
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 border-t pt-2 border-slate-200 gap-4">
                      <span>{language === "ar" ? "الإجمالي المستحق (شامل الضريبة)" : "Invoice Grand Total (Incl. VAT)"}:</span>
                      <span className="font-bold text-lg text-emerald-600 font-sans">{formatCurrency(selectedInvoice.grandTotal, language)}</span>
                    </div>
                  </div>

                </div>

                {/* Chaining hash summary and compliance stamps */}
                <div className="border-t pt-4 border-slate-100 text-[8px] text-slate-400 flex flex-col gap-1 font-mono uppercase tracking-tight break-all leading-tight">
                  <p>ZATCA Chaining XML Hash: {selectedInvoice.zatcaHash || "—"}</p>
                  <p>ZATCA Cryptographic Key ID: ECC-secp256k1-SHA256</p>
                </div>

              </div>
            </div>

          </div>
        )}
      </Modal>


      {/* ── Edit Invoice Modal ── */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditingInvoice(null); }}
        title={`${language === "ar" ? "تعديل الفاتورة" : "Edit Invoice"} — ${editingInvoice?.invoiceNumber || ""}`}
        size="lg">
        {editingInvoice && (
          <div className="flex flex-col gap-5">

            {/* Customer info */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "معلومات العميل" : "Customer Info"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label={language === "ar" ? "اسم العميل (إنجليزي)" : "Customer Name (EN)"} value={editCustomerName} onChange={e => setEditCustomerName(e.target.value)} />
                <Input label={language === "ar" ? "اسم العميل (عربي)" : "Customer Name (AR)"} value={editCustomerNameAr} onChange={e => setEditCustomerNameAr(e.target.value)} />
                <Input label={language === "ar" ? "الرقم الضريبي" : "VAT Number"} value={editCustomerVat} onChange={e => setEditCustomerVat(e.target.value)} placeholder="300XXXXXXXXXXX3" />
              </div>
            </div>

            {/* Dates */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "التواريخ" : "Dates"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label={language === "ar" ? "تاريخ الإصدار" : "Issue Date"} type="date" value={editIssueDate} onChange={e => setEditIssueDate(e.target.value)} />
                <Input label={language === "ar" ? "تاريخ الاستحقاق" : "Due Date"} type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
                <Input label={language === "ar" ? "تاريخ التوريد" : "Supply Date"} type="date" value={editSupplyDate} onChange={e => setEditSupplyDate(e.target.value)} />
              </div>
            </div>

            {/* Payment */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "حالة الدفع" : "Payment"}</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select label={language === "ar" ? "حالة الفاتورة" : "Invoice Status"} value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  options={[
                    { value: "draft",     label: language === "ar" ? "مسودة" : "Draft" },
                    { value: "approved",  label: language === "ar" ? "معتمدة" : "Approved" },
                    { value: "paid",      label: language === "ar" ? "مدفوعة" : "Paid" },
                    { value: "cancelled", label: language === "ar" ? "ملغية" : "Cancelled" },
                  ]} />
                <Select label={language === "ar" ? "حالة الدفع" : "Payment Status"} value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)}
                  options={[
                    { value: "unpaid",         label: language === "ar" ? "غير مدفوعة" : "Unpaid" },
                    { value: "partial",        label: language === "ar" ? "مدفوعة جزئياً" : "Partial" },
                    { value: "paid",           label: language === "ar" ? "مدفوعة بالكامل" : "Fully Paid" },
                  ]} />
                <Input label={language === "ar" ? "المبلغ المدفوع (ر.س)" : "Amount Paid (SAR)"} type="number" min="0" step="0.01"
                  value={editAmountPaid} onChange={e => setEditAmountPaid(e.target.value)} />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{language === "ar" ? "بنود الفاتورة" : "Line Items"}</p>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-1 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-200">
                  <span className="col-span-4">{language === "ar" ? "الوصف" : "Description"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "الكمية" : "Qty"}</span>
                  <span className="col-span-2 text-center">{language === "ar" ? "السعر" : "Price"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "خصم" : "Disc"}</span>
                  <span className="col-span-1 text-center">{language === "ar" ? "ضريبة" : "VAT%"}</span>
                  <span className="col-span-2 text-end">{language === "ar" ? "الإجمالي" : "Total"}</span>
                  <span className="col-span-1" />
                </div>
                {editLines.map((line, idx) => {
                  const net = line.qty * line.unitPrice - (line.discountAmount || 0);
                  const vat = Math.round(net * (line.vatRate / 100) * 100) / 100;
                  const total = Math.round((net + vat) * 100) / 100;
                  return (
                    <div key={idx} className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-slate-50 last:border-0 items-center hover:bg-slate-50/50">
                      <input value={line.name} onChange={e => updateEditLine(idx, "name", e.target.value)}
                        className="col-span-4 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-primary" />
                      <input type="number" value={line.qty} onChange={e => updateEditLine(idx, "qty", +e.target.value)} min={1}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none text-center" />
                      <input type="number" value={line.unitPrice} onChange={e => updateEditLine(idx, "unitPrice", +e.target.value)} min={0} step={0.01}
                        className="col-span-2 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none" />
                      <input type="number" value={line.discountAmount || 0} onChange={e => updateEditLine(idx, "discountAmount", +e.target.value)} min={0} step={0.01}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1.5 py-1.5 focus:outline-none" />
                      <select value={line.vatRate} onChange={e => updateEditLine(idx, "vatRate", +e.target.value)}
                        className="col-span-1 text-xs border border-slate-200 rounded-lg px-1 py-1.5 focus:outline-none">
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={15}>15%</option>
                      </select>
                      <span className="col-span-2 text-xs font-semibold text-slate-700 text-end pr-1">
                        {total.toLocaleString("en", { minimumFractionDigits: 2 })}
                      </span>
                      <div className="col-span-1 flex justify-center">
                        {editLines.length > 1 && (
                          <button onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))} className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => setEditLines(prev => [...prev, { productId: "", name: "", nameAr: "", qty: 1, unit: "PCE", unitPrice: 0, discountPercent: 0, discountAmount: 0, vatRate: 15, vatAmount: 0, lineTotal: 0 }])}
                  className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-semibold text-brand-primary hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> {language === "ar" ? "إضافة بند" : "Add Line"}
                </button>
              </div>
              {/* Live totals */}
              <div className="mt-3 flex flex-col gap-1 text-xs max-w-xs ml-auto text-right">
                {(() => {
                  let sub = 0, vat = 0, disc = 0;
                  editLines.forEach(l => {
                    const net = l.qty * l.unitPrice - (l.discountAmount || 0);
                    sub += net;
                    vat += Math.round(net * (l.vatRate / 100) * 100) / 100;
                    disc += l.discountAmount || 0;
                  });
                  const grand = sub + vat;
                  return (
                    <>
                      <div className="flex justify-between text-slate-500"><span>{language === "ar" ? "الإجمالي الفرعي:" : "Subtotal:"}</span><span>{sub.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                      <div className="flex justify-between text-slate-500"><span>{language === "ar" ? "الضريبة:" : "VAT:"}</span><span>{vat.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                      <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1"><span>{language === "ar" ? "الإجمالي:" : "Grand Total:"}</span><span className="text-brand-primary">{grand.toLocaleString("en", { minimumFractionDigits: 2 })} SAR</span></div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "ملاحظات (إنجليزي)" : "Notes (EN)"}</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-600">{language === "ar" ? "ملاحظات (عربي)" : "Notes (AR)"}</label>
                <textarea value={editNotesAr} onChange={e => setEditNotesAr(e.target.value)} rows={2}
                  className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => handleDeleteInvoice(editingInvoice)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                {language === "ar" ? "حذف الفاتورة" : "Delete Invoice"}
              </button>
              <div className="flex items-center gap-3">
                <Button variant="secondary" onClick={() => { setEditOpen(false); setEditingInvoice(null); }}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={handleSaveEdit} loading={editSaving} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  {language === "ar" ? "حفظ التعديلات" : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Invoice Export Options Panel ── */}
      {showExportPanel && exportingInvoice && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowExportPanel(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <div className="relative w-80 bg-white h-full shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-slate-800">{language === "ar" ? "تصدير الفاتورة" : "Export Invoice PDF"}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{exportingInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => setShowExportPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="flex-1 p-5 space-y-5 overflow-y-auto">

              {/* Letterhead Mode */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "الترويسة" : "Letterhead"}</p>
                <div className="space-y-2">
                  {([
                    { mode: "none",   icon: "⊘", labelEn: "No Letterhead",       descEn: "Plain company text header" },
                    { mode: "header", icon: "▬", labelEn: "Header + Footer",      descEn: "Banner image top & bottom" },
                    { mode: "full",   icon: "▮", labelEn: "Full Page Letterhead",  descEn: "Full A4 background every page" },
                  ] as const).map(opt => (
                    <label key={opt.mode} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${expLHMode === opt.mode ? "border-brand-primary bg-blue-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"}`}>
                      <input type="radio" name="invLHMode" checked={expLHMode === opt.mode} onChange={() => setExpLHMode(opt.mode)} className="mt-0.5 text-brand-primary" />
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
                {expLHMode !== "none" && expLetterheads.length > 1 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-[10px] text-slate-500 font-semibold pl-1">Choose source:</p>
                    {expLetterheads.map((lh: any) => (
                      <label key={lh.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer ${expLHId === lh.id ? "border-brand-primary bg-blue-50" : "border-slate-100"}`}>
                        <input type="radio" checked={expLHId === lh.id} onChange={() => setExpLHId(lh.id)} className="text-brand-primary" />
                        {lh.url ? <img src={lh.url} alt={lh.name} className="h-7 object-contain rounded border border-slate-200 bg-white" /> : <div className="h-7 w-10 bg-slate-100 rounded border flex items-center justify-center"><FileSpreadsheet className="h-3 w-3 text-slate-300" /></div>}
                        <span className="text-xs font-medium text-slate-700">{lh.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Logo & Stamp */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "الشعار والختم" : "Logo & Stamp"}</p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">Include Logo</span>
                        {!(currentCompany as any)?.logo && <p className="text-[10px] text-slate-400">No logo uploaded</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={expLogo} onChange={e => setExpLogo(e.target.checked)} disabled={!(currentCompany as any)?.logo} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer hover:border-brand-primary">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <div>
                        <span className="text-xs font-semibold text-slate-700">Include Stamp</span>
                        {!(currentCompany as any)?.stamp && <p className="text-[10px] text-slate-400">No stamp uploaded</p>}
                      </div>
                    </div>
                    <input type="checkbox" checked={expStamp} onChange={e => setExpStamp(e.target.checked)} disabled={!(currentCompany as any)?.stamp} className="rounded border-slate-300 text-brand-primary" />
                  </label>
                </div>
              </div>

              {/* Signatory */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-primary mb-3">{language === "ar" ? "التوقيع المفوض" : "Authorized Signatory"}</p>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <select value={expSigId} onChange={e => setExpSigId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white">
                    <option value="">None</option>
                    {expSignatories.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
                  </select>
                  {expSigId && expSignatories.find((s: any) => s.id === expSigId)?.signatureUrl && (
                    <label className="flex items-center justify-between cursor-pointer mt-1">
                      <span className="text-xs text-slate-600">Include signature image</span>
                      <input type="checkbox" checked={expIncludeSig} onChange={e => setExpIncludeSig(e.target.checked)} className="rounded border-slate-300 text-brand-primary" />
                    </label>
                  )}
                  {expSignatories.length === 0 && <p className="text-[10px] text-slate-400">Add signatories in Settings</p>}
                </div>
              </div>

              {/* Preview strip */}
              {(expLHMode !== "none" || expLogo || expStamp || expSigId) && (
                <div className="bg-slate-900 rounded-xl p-3 text-[10px] text-slate-400 space-y-1">
                  <p className="font-bold text-white text-xs mb-2">PDF will include:</p>
                  {expLHMode === "full"   && <p>✓ Full page letterhead</p>}
                  {expLHMode === "header" && <p>✓ Header + footer banner</p>}
                  {expLogo && (currentCompany as any)?.logo && <p>✓ Company logo</p>}
                  {expStamp && (currentCompany as any)?.stamp && <p>✓ Company stamp</p>}
                  {expSigId && <p>✓ {expSignatories.find((s: any) => s.id === expSigId)?.name}</p>}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                disabled={expGenerating}
                onClick={async () => {
                  if (!exportingInvoice) return;
                  const win = window.open("", "_blank", "width=960,height=800");
                  if (!win) { toast.error("Please allow popups to export PDF"); return; }
                  win.document.write("<html><body style='font-family:sans-serif;padding:40px;color:#555'>Generating PDF...</body></html>");
                  setExpGenerating(true);
                  setShowExportPanel(false);
                  try {
                    const html = await exportInvoicePDF(exportingInvoice, qrDataUrl, {
                      lhMode: expLHMode, lhId: expLHId,
                      logo: expLogo, stamp: expStamp,
                      sigId: expSigId, includeSig: expIncludeSig,
                    });
                    win.document.open();
                    win.document.write(html as string);
                    win.document.close();
                    win.document.title = exportingInvoice.invoiceNumber || "Invoice";
                  } catch (e) {
                    win.close();
                    toast.error("Failed to generate PDF");
                  } finally {
                    setExpGenerating(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-brand-primary text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {expGenerating ? "Generating..." : "Download Invoice PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrintManager
        isOpen={showPrint}
        onClose={() => setShowPrint(false)}
        title={language === "ar" ? "سجل الفواتير" : "Invoices Register"}
        itemCount={invoices?.length}
      />
    </div>
  );
};
export default InvoicesPage;
