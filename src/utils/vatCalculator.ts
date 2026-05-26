import { LineItem, VatBreakdown } from "../types";

export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLineItem(
  qty: number,
  unitPrice: number,
  discountPercent: number = 0,
  vatRate: 0 | 5 | 15 = 15
) {
  const rawSubtotal = qty * unitPrice;
  const discountAmount = roundAmount(rawSubtotal * (discountPercent / 100));
  const baseAmount = roundAmount(rawSubtotal - discountAmount);
  const vatAmount = roundAmount(baseAmount * (vatRate / 100));
  const lineTotal = roundAmount(baseAmount + vatAmount);

  return {
    qty,
    unitPrice,
    discountPercent,
    discountAmount,
    baseAmount,
    vatRate,
    vatAmount,
    lineTotal
  };
}

export function calculateTotals(lineItems: LineItem[]) {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalVat = 0;

  const rawBreakdowns: { [rate: number]: number } = { 0: 0, 5: 0, 15: 0 };

  for (const line of lineItems) {
    const lineRawSubtotal = line.qty * line.unitPrice;
    subtotal += lineRawSubtotal;
    totalDiscount += line.discountAmount;
    totalVat += line.vatAmount;

    const baseForLine = lineRawSubtotal - line.discountAmount;
    rawBreakdowns[line.vatRate] = (rawBreakdowns[line.vatRate] || 0) + baseForLine;
  }

  const vatBreakdown: VatBreakdown[] = Object.entries(rawBreakdowns)
    .filter(([_, base]) => base > 0)
    .map(([rateStr, base]) => {
      const rate = Number(rateStr);
      return {
        rate,
        base: roundAmount(base),
        amount: roundAmount(base * (rate / 100))
      };
    });

  subtotal = roundAmount(subtotal);
  totalDiscount = roundAmount(totalDiscount);
  totalVat = roundAmount(totalVat);
  const grandTotal = roundAmount(subtotal - totalDiscount + totalVat);

  return {
    subtotal,
    totalDiscount,
    vatBreakdown,
    totalVat,
    grandTotal
  };
}
