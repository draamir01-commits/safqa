import { GoogleGenAI } from "@google/genai";

export interface ExtractedExpense {
  date: string | null;
  description: string | null;
  supplierName: string | null;
  vatNumber: string | null;
  amount: number | null;
  vatPercent: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  category: string | null;
}

export async function extractExpenseFromReceipt(base64: string, mimeType: string): Promise<ExtractedExpense | null> {
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const ai = new GoogleGenAI({ apiKey });
  const clean = base64.replace(/^data:.*?;base64,/, "");

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{
      role: "user",
      parts: [
        { inlineData: { data: clean, mimeType } },
        { text: `You are a Saudi Arabian accounting expert. Extract financial data from this receipt/invoice.
Return ONLY valid JSON with these fields (null if not found):
{"date":"YYYY-MM-DD","description":"string","supplierName":"string","vatNumber":"string","amount":number,"vatPercent":number,"vatAmount":number,"totalAmount":number,"category":"office|travel|meals|utilities|maintenance|it|marketing|other"}` }
      ]
    }]
  });

  const text = (response.text || "").replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(text);
  const toNum = (v: any) => {
    if (v == null) return null;
    const n = parseFloat(String(v).replace(/,/g, "").replace(/[^\d.-]/g, ""));
    return isNaN(n) ? null : n;
  };
  return {
    date: parsed.date || null, description: parsed.description || null,
    supplierName: parsed.supplierName || null, vatNumber: parsed.vatNumber || null,
    amount: toNum(parsed.amount), vatPercent: toNum(parsed.vatPercent),
    vatAmount: toNum(parsed.vatAmount), totalAmount: toNum(parsed.totalAmount),
    category: parsed.category || null,
  };
}
