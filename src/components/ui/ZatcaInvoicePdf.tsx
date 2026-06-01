import * as React from "react";
import { InvoicePrintOptions } from "./InvoicePrintDialog";
import { Invoice } from "../../types";

interface ZatcaInvoicePdfProps {
  invoice: Invoice;
  companyProfile: any;
  qrDataUrl?: string;
  printOptions?: InvoicePrintOptions;
  language?: string;
}

const fmt = (n: number) => Number(n || 0).toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ZatcaInvoicePdf: React.FC<ZatcaInvoicePdfProps> = ({
  invoice, companyProfile, qrDataUrl, printOptions, language = "en"
}) => {
  const cp = companyProfile as any;
  const opts: InvoicePrintOptions = printOptions || {
    showLetterhead: true, showStamp: false, showSignatory: false,
    selectedSignatoryId: null, showNotes: true, showZatcaQr: true,
  };

  const [signatory, setSignatory] = React.useState<any>(null);

  React.useEffect(() => {
    // Signatory is resolved by parent and passed via printOptions
    // Nothing to load here — parent passes qrDataUrl already resolved
  }, []);

  const typeLabels: Record<string, { en: string; ar: string }> = {
    standard:    { en: "Tax Invoice",         ar: "فاتورة ضريبية" },
    simplified:  { en: "Simplified Tax Invoice", ar: "فاتورة ضريبية مبسطة" },
    credit_note: { en: "Credit Note",         ar: "إشعار دائن" },
    debit_note:  { en: "Debit Note",          ar: "إشعار مدين" },
  };
  const typeLabel = typeLabels[invoice.type || "standard"] || typeLabels["standard"];

  const border = "1px solid #ccc";
  const cellPad = "6px 10px";
  const labelStyle: React.CSSProperties = { fontWeight: 700, color: "#111", fontSize: 10 };
  const valueStyle: React.CSSProperties = { color: "#333", fontSize: 10 };
  const arStyle: React.CSSProperties = { direction: "rtl", textAlign: "right" };

  const lineItems = invoice.lineItems || [];
  const totalNet  = invoice.subtotal || 0;
  const totalVat  = invoice.totalVat || 0;
  const totalAmt  = invoice.grandTotal || 0;
  const totalDisc = invoice.totalDiscount || 0;

  return (
    <div id="zatca-invoice-pdf" style={{
      fontFamily: "'Segoe UI','Cairo','Arial',sans-serif",
      background: "#fff", color: "#111",
      maxWidth: 794, margin: "0 auto",
      fontSize: 10, lineHeight: 1.5,
    }}>

      {/* LETTERHEAD HEADER IMAGE */}
      {opts.showLetterhead && (cp?.letterheadHeader || cp?.fullLetterhead) && (
        <img
          src={cp.letterheadHeader || cp.fullLetterhead}
          alt="Letterhead"
          style={{ width: "100%", display: "block", maxHeight: cp?.fullLetterhead && !cp?.letterheadHeader ? "none" : 80, objectFit: "cover" }}
        />
      )}

      <div style={{ padding: "20px 30px" }}>

        {/* HEADER: Company info + Logo */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
          <tbody>
            <tr>
              {/* EN Left */}
              <td style={{ verticalAlign: "top", width: "40%" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{cp?.name || ""}</div>
                <div style={{ fontSize: 9.5, color: "#444", lineHeight: 1.6 }}>
                  {cp?.address && <div>{cp.address}{cp?.city ? `, ${cp.city}` : ""}, Kingdom of Saudi Arabia</div>}
                  {cp?.email && <div>{cp.email}</div>}
                  {cp?.phone && <div>{cp.phone}</div>}
                  {cp?.vatNumber && <div>VAT number {cp.vatNumber}</div>}
                  {cp?.crNumber && <div>CR Number {cp.crNumber}</div>}
                </div>
              </td>

              {/* Logo Center */}
              <td style={{ textAlign: "center", verticalAlign: "middle", width: "20%" }}>
                {!(cp?.letterheadHeader) && cp?.logo && (
                  <img src={cp.logo} alt="Logo" style={{ maxHeight: 70, maxWidth: 120, objectFit: "contain" }} />
                )}
              </td>

              {/* AR Right */}
              <td style={{ verticalAlign: "top", textAlign: "right", direction: "rtl", width: "40%" }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>{cp?.nameAr || cp?.name || ""}</div>
                <div style={{ fontSize: 9.5, color: "#444", lineHeight: 1.6 }}>
                  {cp?.addressAr && <div>{cp.addressAr}</div>}
                  {cp?.vatNumber && <div>رقم التسجيل الضريبي {cp.vatNumber}</div>}
                  {cp?.crNumber && <div>رقم السجل التجاري {cp.crNumber}</div>}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* TITLE */}
        <div style={{ textAlign: "center", margin: "16px 0", borderTop: "2px solid #111", borderBottom: "2px solid #111", padding: "10px 0" }}>
          <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>
            {typeLabel.ar} &nbsp; {typeLabel.en}
          </span>
        </div>

        {/* CUSTOMER INFO */}
        <table style={{ width: "100%", borderCollapse: "collapse", border, marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ ...labelStyle, padding: cellPad, border, width: "15%" }}>Customer</td>
              <td style={{ ...valueStyle, padding: cellPad, border, width: "35%", fontWeight: 700 }}>{invoice.customerName || "—"}</td>
              <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border, width: "15%", ...labelStyle }}>العميل</td>
              <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border, width: "35%", fontWeight: 700 }}>{invoice.customerNameAr || invoice.customerName || "—"}</td>
            </tr>
            {invoice.customerAddress && (
              <tr>
                <td style={{ ...labelStyle, padding: cellPad, border }}>Address</td>
                <td style={{ ...valueStyle, padding: cellPad, border }}>{invoice.customerAddress}</td>
                <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>العنوان</td>
                <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border }}>{invoice.customerAddress}</td>
              </tr>
            )}
            {invoice.customerVatNumber && (
              <tr>
                <td style={{ ...labelStyle, padding: cellPad, border }}>VAT number</td>
                <td style={{ ...valueStyle, padding: cellPad, border, fontFamily: "monospace" }}>{invoice.customerVatNumber}</td>
                <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>رقم التسجيل الضريبي</td>
                <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border, fontFamily: "monospace" }}>{invoice.customerVatNumber}</td>
              </tr>
            )}
            <tr>
              <td style={{ ...labelStyle, padding: cellPad, border }}>Invoice number</td>
              <td style={{ ...valueStyle, padding: cellPad, border, fontFamily: "monospace", fontWeight: 700 }}>{invoice.invoiceNumber}</td>
              <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>رقم الفاتورة</td>
              <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border, fontFamily: "monospace" }}>{invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td style={{ ...labelStyle, padding: cellPad, border }}>Date</td>
              <td style={{ ...valueStyle, padding: cellPad, border }}>{invoice.issueDate}</td>
              <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>التاريخ</td>
              <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border }}>{invoice.issueDate}</td>
            </tr>
            {(invoice as any).projectName && (
              <tr>
                <td style={{ ...labelStyle, padding: cellPad, border }}>Project</td>
                <td style={{ ...valueStyle, padding: cellPad, border }}>{(invoice as any).projectName}</td>
                <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>المشروع</td>
                <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border }}>{(invoice as any).projectName}</td>
              </tr>
            )}
            {invoice.dueDate && (
              <tr>
                <td style={{ ...labelStyle, padding: cellPad, border }}>Due date</td>
                <td style={{ ...valueStyle, padding: cellPad, border }}>{invoice.dueDate}</td>
                <td style={{ ...labelStyle, ...arStyle, padding: cellPad, border }}>تاريخ الاستحقاق</td>
                <td style={{ ...valueStyle, ...arStyle, padding: cellPad, border }}>{invoice.dueDate}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* LINE ITEMS */}
        <table style={{ width: "100%", borderCollapse: "collapse", border, marginBottom: 12 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              {["#", "Description / الوصف", "Qty / الكمية", "Price / السعر", "Taxable Amount / المبلغ الخاضع", "VAT / القيمة المضافة", "Line Amount / المجموع"].map((h, i) => (
                <th key={i} style={{ padding: cellPad, border, textAlign: i > 1 ? "right" : i === 1 ? "left" : "center", fontWeight: 700, fontSize: 9.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: cellPad, border, textAlign: "center", fontSize: 9.5 }}>{idx + 1}</td>
                <td style={{ padding: cellPad, border, fontSize: 9.5 }}>
                  <div style={{ fontWeight: 600 }}>{language === "ar" ? item.nameAr || item.name : item.name}</div>
                  {item.nameAr && language !== "ar" && <div style={{ direction: "rtl", color: "#555", fontSize: 9, marginTop: 2 }}>{item.nameAr}</div>}
                </td>
                <td style={{ padding: cellPad, border, textAlign: "center", fontSize: 9.5 }}>{item.qty} <span style={{ color: "#666", fontSize: 8.5 }}>{item.unit}</span></td>
                <td style={{ padding: cellPad, border, textAlign: "right", fontFamily: "monospace", fontSize: 9.5 }}>{fmt(item.unitPrice)}</td>
                <td style={{ padding: cellPad, border, textAlign: "right", fontFamily: "monospace", fontSize: 9.5 }}>{fmt(item.lineTotal - item.vatAmount)}</td>
                <td style={{ padding: cellPad, border, textAlign: "right", fontFamily: "monospace", fontSize: 9.5 }}>{fmt(item.vatAmount)}<br /><span style={{ color: "#666", fontSize: 8.5 }}>{item.vatRate}%</span></td>
                <td style={{ padding: cellPad, border, textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 9.5 }}>{fmt(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* QR + TOTALS */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "bottom", width: "30%", paddingRight: 20 }}>
                {opts.showZatcaQr && qrDataUrl && (
                  <div>
                    <img src={qrDataUrl} alt="ZATCA QR Code" style={{ width: 100, height: 100, display: "block" }} />
                    <div style={{ fontSize: 7.5, color: "#555", marginTop: 4, maxWidth: 160 }}>
                      This QR code is encoded as per ZATCA e-invoicing requirements
                      <br />
                      <span style={{ direction: "rtl", display: "block", textAlign: "right" }}>
                        تم ترميز هذا الرمز وفقاً لمتطلبات هيئة الزكاة والضريبة والجمارك للفوترة الإلكترونية
                      </span>
                    </div>
                  </div>
                )}
              </td>
              <td style={{ width: "30%" }} />
              <td style={{ verticalAlign: "top", width: "40%" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {totalDisc > 0 && (
                      <tr>
                        <td style={{ padding: "5px 10px", border, fontWeight: 600, fontSize: 10 }}>Discount / الخصم</td>
                        <td style={{ padding: "5px 10px", border, textAlign: "right", fontFamily: "monospace", color: "#059669", fontWeight: 700 }}>- {fmt(totalDisc)} ﷼</td>
                      </tr>
                    )}
                    <tr>
                      <td style={{ padding: "5px 10px", border, fontWeight: 600, fontSize: 10 }}>Subtotal / المجموع الفرعي</td>
                      <td style={{ padding: "5px 10px", border, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalNet)} ﷼</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "5px 10px", border, fontWeight: 600, fontSize: 10 }}>VAT Total / إجمالي ضريبة القيمة المضافة</td>
                      <td style={{ padding: "5px 10px", border, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(totalVat)} ﷼</td>
                    </tr>
                    <tr style={{ background: "#f0f0f0" }}>
                      <td style={{ padding: "6px 10px", border, fontWeight: 800, fontSize: 11 }}>Total / المجموع شامل القيمة المضافة</td>
                      <td style={{ padding: "6px 10px", border, textAlign: "right", fontFamily: "monospace", fontWeight: 900, fontSize: 12 }}>{fmt(totalAmt)} ﷼</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>

        {/* NOTES */}
        {opts.showNotes && invoice.notes && (
          <div style={{ border, borderRadius: 4, padding: "8px 12px", marginBottom: 12, background: "#fffbeb" }}>
            <div style={{ fontWeight: 700, fontSize: 9.5, marginBottom: 3 }}>Notes / ملاحظات</div>
            <div style={{ fontSize: 9.5 }}>{invoice.notes}</div>
          </div>
        )}

        {/* SIGNATORY + STAMP */}
        {(opts.showSignatory || opts.showStamp) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 24, paddingTop: 16, borderTop: "1px dashed #e2e8f0", pageBreakInside: "avoid" }}>
            {opts.showSignatory && opts.selectedSignatoryId ? (
              <div id={`sig-block-${opts.selectedSignatoryId}`} style={{ textAlign: "center", minWidth: 160 }}>
                <div style={{ borderTop: "1px solid #111", paddingTop: 4, marginTop: 48 }}>
                  <div style={{ fontWeight: 700, fontSize: 10 }}>{language === "ar" ? "المفوض بالتوقيع" : "Authorized Signatory"}</div>
                  <div style={{ fontSize: 9.5, color: "#555" }}>{opts.selectedSignatoryId}</div>
                </div>
              </div>
            ) : <div />}
            {opts.showStamp && cp?.stamp && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <img src={cp.stamp} alt="Stamp" style={{ width: 120, height: 120, objectFit: "contain", opacity: 0.88 }} />
                <div style={{ fontSize: 8, color: "#888" }}>Company Stamp / ختم الشركة</div>
              </div>
            )}
          </div>
        )}

        {/* PAGE FOOTER */}
        <div style={{ borderTop: "1px solid #ccc", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div style={{ fontSize: 9, color: "#555" }}>{cp?.name}</div>
          <div style={{ fontSize: 9, color: "#555", textAlign: "center" }}>Page 1 of 1 - {invoice.invoiceNumber}</div>
          <div style={{ fontSize: 9, color: "#555", textAlign: "right" }}>{invoice.invoiceNumber}</div>
        </div>

      </div>

      {/* LETTERHEAD FOOTER IMAGE */}
      {opts.showLetterhead && cp?.letterheadFooter && (
        <img src={cp.letterheadFooter} alt="Footer" style={{ width: "100%", display: "block", marginTop: 4 }} />
      )}
    </div>
  );
};

export default ZatcaInvoicePdf;
