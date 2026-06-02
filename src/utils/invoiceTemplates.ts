// ─────────────────────────────────────────────────────────────────────────────
// Invoice PDF Templates
// Three distinct layouts — Classic, Modern, Compact
// All accept the same inputs and return an HTML string
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateId = "classic" | "modern" | "compact";

export interface TemplateOptions {
  inv: any;
  co: any;
  qrUrl: string;
  headerHTML: string;
  footerHTML: string;
  padTop: string;
  padBot: string;
  sigHTML: string;
  titleEN: string;
  titleAR: string;
  includeLogo: boolean;
}

// ─── shared helpers ───────────────────────────────────────────────────────────

const SAR = (n: number) => `${Number(n || 0).toFixed(2)} SAR`;

function buildLineRows(lineItems: any[], template: TemplateId): string {
  if (!lineItems?.length) return `<tr><td colspan="7" style="text-align:center;padding:14px;color:#999;font-size:8pt">No items</td></tr>`;
  return lineItems.map((l: any, i: number) => {
    const net = (l.lineTotal || 0) - (l.vatAmount || 0);
    const bg = i % 2 === 0 ? "#fff" : (template === "modern" ? "#f0f7ff" : "#f8fafc");
    return `<tr style="background:${bg}">
      <td style="text-align:center;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${i + 1}</td>
      <td style="padding:6px 7px;border:0.5px solid #cbd5e0;font-size:8pt">${l.name || ""}${l.nameAr ? `<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#666;direction:rtl">${l.nameAr}</span>` : ""}</td>
      <td style="text-align:center;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${l.qty || 1} <span style="font-size:7pt;color:#666">${l.unit || "PCE"}</span></td>
      <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${(l.unitPrice || 0).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${net.toFixed(2)}</td>
      <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt">${(l.vatAmount || 0).toFixed(2)}</td>
      <td style="text-align:right;padding:6px 5px;border:0.5px solid #cbd5e0;font-size:8pt;font-weight:600">${(l.lineTotal || 0).toFixed(2)}</td>
    </tr>`;
  }).join("");
}

function buildSigHTML(sigObj: any, expIncludeSig: boolean, expStamp: boolean, co: any): string {
  if (!sigObj && !(expStamp && co?.stamp)) return "";
  return `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:space-between;gap:16px">
    <div style="flex:1">${sigObj ? `
      <div style="font-size:9pt;font-weight:700;margin-bottom:12px">Authorized Signatory</div>
      ${expIncludeSig && sigObj.signatureUrl ? `<img src="${sigObj.signatureUrl}" style="height:36px;max-width:100px;object-fit:contain;display:block;margin-bottom:6px"/>` : `<div style="height:36px"></div>`}
      <div style="border-bottom:1.5px solid #333;width:160px;margin-bottom:5px"></div>
      <div style="font-size:9.5pt;font-weight:700">${sigObj.name}</div>
      <div style="font-size:8pt;color:#555">${sigObj.designation || ""}</div>` : ""}
    </div>
    ${expStamp && co?.stamp ? `<div style="text-align:center"><img src="${co.stamp}" style="width:90px;height:90px;object-fit:contain"/><div style="font-size:7pt;color:#888;margin-top:4px">Company Stamp</div></div>` : ""}
  </div>`;
}

const BASE_CSS = (padTop: string, padBot: string) => `
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  body{font-family:Cairo,Arial,sans-serif;font-size:9pt;color:#1a1a1a;background:#fff;padding:${padTop} 12mm ${padBot}}
  table{border-collapse:collapse;width:100%}
  @media print{@page{size:A4;margin:0}body{padding:${padTop} 8mm ${padBot}}}
`;

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — CLASSIC (current layout, bilingual, dark header table)
// ─────────────────────────────────────────────────────────────────────────────
export function renderClassic(o: TemplateOptions): string {
  const { inv, co, qrUrl, headerHTML, footerHTML, padTop, padBot, sigHTML, titleEN, titleAR } = o;
  const invNum = inv.invoiceNumber || "Invoice";

  const IR = (le: string, ve: string, la: string, va: string): string =>
    (!ve && !va) ? "" : `<tr>
      <td style="font-weight:700;padding:5px 8px;width:95px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt">${le}</td>
      <td style="padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;min-width:110px">${ve || ""}</td>
      <td style="font-family:Cairo,Arial,sans-serif;font-weight:700;padding:5px 8px;width:110px;background:#f8fafc;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl">${la}</td>
      <td style="font-family:Cairo,Arial,sans-serif;padding:5px 8px;border:0.5px solid #c8cdd5;font-size:8pt;text-align:right;direction:rtl;min-width:110px">${va || ""}</td>
    </tr>`;

  const lineRows = buildLineRows(inv.lineItems || [], "classic");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${invNum}</title>
<style>${BASE_CSS(padTop, padBot)}</style>
</head><body translate="no">
${headerHTML}
<div style="text-align:center;margin:8px 0 4px">
  <span style="font-size:18pt;font-weight:800;margin-right:24px">${titleEN}</span>
  <span style="font-family:Cairo,Arial,sans-serif;font-size:18pt;font-weight:800;direction:rtl">${titleAR}</span>
</div>
<div style="border-top:2px solid #e2e8f0;margin-bottom:8px"></div>
<table style="margin-bottom:10px">
  ${IR("Customer", inv.customerName || "", "العميل", inv.customerNameAr || inv.customerName || "")}
  ${inv.customerAddress ? IR("Address", inv.customerAddress, "العنوان", inv.customerAddress) : ""}
  ${inv.customerVatNumber ? IR("VAT number", inv.customerVatNumber, "رقم التسجيل الضريبي", inv.customerVatNumber) : ""}
  ${IR("Invoice number", invNum, "رقم الفاتورة", invNum)}
  ${IR("Date", inv.issueDate || "", "التاريخ", inv.issueDate || "")}
  ${(inv as any).projectName ? IR("Project", (inv as any).projectName, "المشروع", (inv as any).projectName) : ""}
  ${inv.dueDate ? IR("Due date", inv.dueDate, "تاريخ الاستحقاق", inv.dueDate) : ""}
</table>
<table style="margin-bottom:10px">
  <thead><tr style="background:#2d3748;color:#fff">
    <th style="padding:6px 5px;text-align:center;border:0.5px solid #4a5568;font-size:7.5pt;width:22px">#</th>
    <th style="padding:6px 7px;text-align:left;border:0.5px solid #4a5568;font-size:7.5pt">Description<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0;direction:rtl">الوصف</span></th>
    <th style="padding:6px 5px;text-align:center;border:0.5px solid #4a5568;font-size:7.5pt;width:44px">Qty<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0">الكمية</span></th>
    <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:58px">Price<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0">السعر</span></th>
    <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:70px">Taxable amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0">المبلغ الخاضع</span></th>
    <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:62px">VAT amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0">القيمة المضافة</span></th>
    <th style="padding:6px 5px;text-align:right;border:0.5px solid #4a5568;font-size:7.5pt;width:68px">Line amount<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7pt;color:#e2e8f0">المجموع</span></th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>
<table style="margin-bottom:12px"><tr>
  <td style="width:50%;vertical-align:top;padding-right:12px">
    ${qrUrl ? `<img src="${qrUrl}" style="width:88px;height:88px;border:0.5px solid #dde;display:block"/>` : ""}
    <div style="font-size:6.5pt;color:#555;margin-top:5px;max-width:200px;line-height:1.5">This QR code is encoded as per ZATCA e-invoicing requirements<br><span style="font-family:Cairo,Arial,sans-serif;direction:rtl;display:block;margin-top:3px">تم ترميز هذا الرمز وفقاً لمتطلبات هيئة الزكاة</span></div>
  </td>
  <td style="width:50%;vertical-align:top">
    <table style="border:0.5px solid #c8cdd5">
      <tr><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600">Subtotal<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#555;direction:rtl;display:block">المجموع الفرعي</span></td><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600;text-align:right">${SAR(inv.subtotal)}</td></tr>
      <tr><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600">Total VAT<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#555;direction:rtl;display:block">إجمالي ضريبة القيمة المضافة</span></td><td style="padding:6px 10px;border:0.5px solid #c8cdd5;font-size:8pt;font-weight:600;text-align:right">${SAR(inv.totalVat)}</td></tr>
      <tr style="background:#1e2d3d"><td style="padding:6px 10px;border:0.5px solid #2d3e4f;font-size:8pt;font-weight:700;color:#fff">Total<br><span style="font-family:Cairo,Arial,sans-serif;font-size:7.5pt;color:#ccc;direction:rtl;display:block">المجموع شامل القيمة المضافة</span></td><td style="padding:6px 10px;border:0.5px solid #2d3e4f;font-size:8pt;font-weight:700;color:#fff;text-align:right">${SAR(inv.grandTotal)}</td></tr>
    </table>
  </td>
</tr></table>
${sigHTML}
${footerHTML}
<script>document.title="${invNum}";window.onload=function(){setTimeout(function(){window.print()},1200)};</script>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — MODERN (accent color, logo centered, clean card layout)
// ─────────────────────────────────────────────────────────────────────────────
export function renderModern(o: TemplateOptions): string {
  const { inv, co, qrUrl, headerHTML, footerHTML, padTop, padBot, sigHTML, titleEN, titleAR } = o;
  const invNum = inv.invoiceNumber || "Invoice";
  const accent = "#1D4ED8"; // blue accent
  const lineRows = buildLineRows(inv.lineItems || [], "modern");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${invNum}</title>
<style>
${BASE_CSS(padTop, padBot)}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-bottom:14px;border:0.5px solid #e2e8f0;border-radius:4px;overflow:hidden}
.info-cell{padding:7px 12px;border-bottom:0.5px solid #e2e8f0}
.info-cell:nth-child(odd){background:#f8fafc}
.info-label{font-size:7pt;color:#64748b;font-weight:600;margin-bottom:2px}
.info-value{font-size:8.5pt;color:#1e293b;font-weight:500}
</style>
</head><body translate="no">
${headerHTML}

<!-- Title bar -->
<div style="background:${accent};margin:0 -12mm 14px;padding:10px 12mm;display:flex;justify-content:space-between;align-items:center">
  <div>
    <div style="font-size:20pt;font-weight:800;color:#fff;letter-spacing:-0.5px">${titleEN}</div>
    <div style="font-family:Cairo,Arial,sans-serif;font-size:13pt;font-weight:700;color:#bfdbfe;direction:rtl;margin-top:1px">${titleAR}</div>
  </div>
  <div style="text-align:right;color:#bfdbfe">
    <div style="font-size:11pt;font-weight:700;color:#fff;font-family:monospace">${invNum}</div>
    <div style="font-size:8pt;margin-top:2px">${inv.issueDate || ""}</div>
  </div>
</div>

<!-- Customer + Invoice info grid -->
<div class="info-grid">
  <div class="info-cell"><div class="info-label">Bill To / العميل</div><div class="info-value">${inv.customerName || ""}</div>${inv.customerNameAr ? `<div style="font-family:Cairo,Arial,sans-serif;font-size:8pt;color:#555;direction:rtl;margin-top:1px">${inv.customerNameAr}</div>` : ""}</div>
  <div class="info-cell"><div class="info-label">Invoice No. / رقم الفاتورة</div><div class="info-value" style="font-family:monospace;color:${accent}">${invNum}</div></div>
  ${inv.customerVatNumber ? `<div class="info-cell"><div class="info-label">Customer VAT / الرقم الضريبي</div><div class="info-value" style="font-family:monospace">${inv.customerVatNumber}</div></div>` : "<div class='info-cell'></div>"}
  <div class="info-cell"><div class="info-label">Issue Date / التاريخ</div><div class="info-value">${inv.issueDate || ""}</div></div>
  ${inv.customerAddress ? `<div class="info-cell"><div class="info-label">Address / العنوان</div><div class="info-value">${inv.customerAddress}</div></div>` : "<div class='info-cell'></div>"}
  ${inv.dueDate ? `<div class="info-cell"><div class="info-label">Due Date / الاستحقاق</div><div class="info-value">${inv.dueDate}</div></div>` : "<div class='info-cell'></div>"}
</div>

<!-- Items table -->
<table style="margin-bottom:14px">
  <thead><tr style="background:${accent};color:#fff">
    <th style="padding:7px 5px;text-align:center;border:0.5px solid #3b5ec4;font-size:7.5pt;width:22px">#</th>
    <th style="padding:7px 8px;text-align:left;border:0.5px solid #3b5ec4;font-size:7.5pt">Description / الوصف</th>
    <th style="padding:7px 5px;text-align:center;border:0.5px solid #3b5ec4;font-size:7.5pt;width:44px">Qty</th>
    <th style="padding:7px 5px;text-align:right;border:0.5px solid #3b5ec4;font-size:7.5pt;width:60px">Price</th>
    <th style="padding:7px 5px;text-align:right;border:0.5px solid #3b5ec4;font-size:7.5pt;width:72px">Taxable</th>
    <th style="padding:7px 5px;text-align:right;border:0.5px solid #3b5ec4;font-size:7.5pt;width:62px">VAT</th>
    <th style="padding:7px 5px;text-align:right;border:0.5px solid #3b5ec4;font-size:7.5pt;width:70px">Amount</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>

<!-- QR + Totals -->
<table style="margin-bottom:14px"><tr>
  <td style="width:45%;vertical-align:top;padding-right:16px">
    ${qrUrl ? `<img src="${qrUrl}" style="width:80px;height:80px;border:0.5px solid #dde;display:block;border-radius:4px"/>` : ""}
    <div style="font-size:6.5pt;color:#888;margin-top:6px;max-width:180px;line-height:1.5">ZATCA e-invoicing QR code<br><span style="font-family:Cairo,Arial,sans-serif;direction:rtl;display:block">رمز الاستجابة السريعة لهيئة الزكاة</span></div>
  </td>
  <td style="width:55%;vertical-align:top">
    <table style="border-radius:6px;overflow:hidden;border:0.5px solid #e2e8f0">
      <tr><td style="padding:7px 12px;font-size:8pt;background:#f8fafc;border-bottom:0.5px solid #e2e8f0">Subtotal / المجموع الفرعي</td><td style="padding:7px 12px;font-size:8pt;text-align:right;background:#f8fafc;border-bottom:0.5px solid #e2e8f0">${SAR(inv.subtotal)}</td></tr>
      <tr><td style="padding:7px 12px;font-size:8pt;background:#fff;border-bottom:0.5px solid #e2e8f0">VAT (15%) / ضريبة القيمة المضافة</td><td style="padding:7px 12px;font-size:8pt;text-align:right;background:#fff;border-bottom:0.5px solid #e2e8f0">${SAR(inv.totalVat)}</td></tr>
      <tr style="background:${accent}"><td style="padding:8px 12px;font-size:9pt;font-weight:700;color:#fff">Total / الإجمالي</td><td style="padding:8px 12px;font-size:9pt;font-weight:700;color:#fff;text-align:right">${SAR(inv.grandTotal)}</td></tr>
    </table>
  </td>
</tr></table>

${sigHTML}
${footerHTML}
<script>document.title="${invNum}";window.onload=function(){setTimeout(function(){window.print()},1200)};</script>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — COMPACT (tight layout, English-primary, good for simple receipts)
// ─────────────────────────────────────────────────────────────────────────────
export function renderCompact(o: TemplateOptions): string {
  const { inv, co, qrUrl, headerHTML, footerHTML, padTop, padBot, sigHTML, titleEN, titleAR } = o;
  const invNum = inv.invoiceNumber || "Invoice";
  const lineRows = buildLineRows(inv.lineItems || [], "compact");
  const accent = "#0F766E"; // teal

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${invNum}</title>
<style>
${BASE_CSS(padTop, padBot)}
body{font-size:8.5pt}
</style>
</head><body translate="no">
${headerHTML}

<!-- Header strip -->
<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${accent};padding-bottom:8px;margin-bottom:10px">
  <div>
    <div style="font-size:16pt;font-weight:800;color:${accent}">${titleEN}</div>
    <div style="font-family:Cairo,Arial,sans-serif;font-size:10pt;font-weight:600;color:#888;direction:rtl">${titleAR}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:10pt;font-weight:700;font-family:monospace;color:#1e293b">${invNum}</div>
    <div style="font-size:7.5pt;color:#666;margin-top:2px">Date: ${inv.issueDate || ""}</div>
    ${inv.dueDate ? `<div style="font-size:7.5pt;color:#666">Due: ${inv.dueDate}</div>` : ""}
  </div>
</div>

<!-- Customer info — compact 2-col -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;font-size:8pt">
  <div style="border-left:3px solid ${accent};padding-left:8px">
    <div style="font-weight:700;color:#1e293b;margin-bottom:2px">Bill To</div>
    <div>${inv.customerName || ""}</div>
    ${inv.customerNameAr ? `<div style="font-family:Cairo,Arial,sans-serif;color:#666;direction:rtl;font-size:7.5pt">${inv.customerNameAr}</div>` : ""}
    ${inv.customerVatNumber ? `<div style="color:#666;font-family:monospace;font-size:7.5pt">VAT: ${inv.customerVatNumber}</div>` : ""}
    ${inv.customerAddress ? `<div style="color:#666;font-size:7.5pt">${inv.customerAddress}</div>` : ""}
  </div>
  <div style="border-left:3px solid #e2e8f0;padding-left:8px">
    <div style="font-weight:700;color:#1e293b;margin-bottom:2px">From</div>
    <div>${co?.name || ""}</div>
    ${co?.nameAr ? `<div style="font-family:Cairo,Arial,sans-serif;color:#666;direction:rtl;font-size:7.5pt">${co.nameAr}</div>` : ""}
    ${co?.vatNumber ? `<div style="color:#666;font-family:monospace;font-size:7.5pt">VAT: ${co.vatNumber}</div>` : ""}
    ${co?.phone ? `<div style="color:#666;font-size:7.5pt">${co.phone}</div>` : ""}
  </div>
</div>

<!-- Items table — tighter -->
<table style="margin-bottom:10px;font-size:8pt">
  <thead><tr style="background:${accent};color:#fff">
    <th style="padding:5px 4px;text-align:center;border:0.5px solid #0d9488;width:20px">#</th>
    <th style="padding:5px 7px;text-align:left;border:0.5px solid #0d9488">Description</th>
    <th style="padding:5px 4px;text-align:center;border:0.5px solid #0d9488;width:40px">Qty</th>
    <th style="padding:5px 4px;text-align:right;border:0.5px solid #0d9488;width:56px">Price</th>
    <th style="padding:5px 4px;text-align:right;border:0.5px solid #0d9488;width:66px">Taxable</th>
    <th style="padding:5px 4px;text-align:right;border:0.5px solid #0d9488;width:58px">VAT</th>
    <th style="padding:5px 4px;text-align:right;border:0.5px solid #0d9488;width:64px">Total</th>
  </tr></thead>
  <tbody>${lineRows}</tbody>
</table>

<!-- QR + Totals side by side — very compact -->
<div style="display:flex;gap:16px;margin-bottom:12px;align-items:flex-start">
  <div>
    ${qrUrl ? `<img src="${qrUrl}" style="width:72px;height:72px;border:0.5px solid #dde;display:block"/>` : ""}
    <div style="font-size:6pt;color:#aaa;margin-top:4px;width:76px;line-height:1.4">ZATCA QR Code</div>
  </div>
  <div style="flex:1"></div>
  <table style="width:220px;font-size:8pt">
    <tr><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;color:#555">Subtotal</td><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;text-align:right">${SAR(inv.subtotal)}</td></tr>
    <tr><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;color:#555">VAT (15%)</td><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;text-align:right">${SAR(inv.totalVat)}</td></tr>
    ${inv.amountPaid ? `<tr><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;color:#059669">Paid</td><td style="padding:4px 8px;border-bottom:0.5px solid #e2e8f0;text-align:right;color:#059669">-${SAR(inv.amountPaid)}</td></tr>` : ""}
    <tr style="background:${accent}"><td style="padding:5px 8px;font-weight:700;color:#fff">Total</td><td style="padding:5px 8px;font-weight:700;color:#fff;text-align:right">${SAR(inv.grandTotal)}</td></tr>
  </table>
</div>

${sigHTML}
${footerHTML}
<script>document.title="${invNum}";window.onload=function(){setTimeout(function(){window.print()},1200)};</script>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatch function
// ─────────────────────────────────────────────────────────────────────────────
export function renderInvoiceTemplate(templateId: TemplateId, o: TemplateOptions): string {
  switch (templateId) {
    case "modern":  return renderModern(o);
    case "compact": return renderCompact(o);
    default:        return renderClassic(o);
  }
}

export const INVOICE_TEMPLATES: { id: TemplateId; label: string; description: string; accent: string }[] = [
  { id: "classic", label: "Classic",  description: "Bilingual table, dark header",  accent: "#2d3748" },
  { id: "modern",  label: "Modern",   description: "Blue accent, clean card layout", accent: "#1D4ED8" },
  { id: "compact", label: "Compact",  description: "Teal, tight spacing, simple",   accent: "#0F766E" },
];
