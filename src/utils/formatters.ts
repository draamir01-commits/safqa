/**
 * Formats values into Saudi Riyal (SAR) currency representations.
 */
export function formatCurrency(amount: number, language: "ar" | "en" = "ar"): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat(language === "ar" ? "ar-SA" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);

  return language === "ar" ? `${formatted} ر.س` : `SAR ${formatted}`;
}

/**
 * Formats a 15-digit Saudi VAT Number for readability:
 * e.g., 300xxxxxxxxxx3 -> 300-xxxxxxxxx-3
 */
export function formatVatNumber(vat: string): string {
  if (!vat || vat.length !== 15) return vat;
  return `${vat.substring(0, 3)}-${vat.substring(3, 14)}-${vat.substring(14)}`;
}

/**
 * Basic Date formatter compatible with RTL Cairo display needs.
 */
export function formatDateString(dateStr: string, language: "ar" | "en" = "ar"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Alias for formatDateString — used by InvoicesPage.
 */
export function formatDate(dateStr: string, language: "ar" | "en" = "ar"): string {
  return formatDateString(dateStr, language);
}
