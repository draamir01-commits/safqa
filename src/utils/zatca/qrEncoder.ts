import QRCode from "qrcode";

/**
 * Encodes KSA ZATCA TLV (Tag-Length-Value) structure for electronic invoices
 * Tags:
 * 1. Seller Name
 * 2. Seller VAT Number (15 digits)
 * 3. UTC Timestamp (ISO 8601)
 * 4. Invoice Total (with VAT) as string
 * 5. VAT Total as string
 */
export function encodeTLV(
  sellerName: string,
  vatNumber: string,
  timestamp: string,
  totalWithVat: string,
  vatTotal: string
): string {
  const encoder = new TextEncoder();

  const createTLVBlock = (tag: number, value: string): Uint8Array => {
    const valBytes = encoder.encode(value);
    const tagBytes = new Uint8Array([tag, valBytes.length]);
    const block = new Uint8Array(tagBytes.length + valBytes.length);
    block.set(tagBytes, 0);
    block.set(valBytes, tagBytes.length);
    return block;
  };

  const blocks = [
    createTLVBlock(1, sellerName),
    createTLVBlock(2, vatNumber),
    createTLVBlock(3, timestamp),
    createTLVBlock(4, Number(totalWithVat).toFixed(2)),
    createTLVBlock(5, Number(vatTotal).toFixed(2))
  ];

  const totalLength = blocks.reduce((sum, b) => sum + b.length, 0);
  const tlvBytes = new Uint8Array(totalLength);
  
  let offset = 0;
  for (const b of blocks) {
    tlvBytes.set(b, offset);
    offset += b.length;
  }

  // Safe browser implementation of base64 binary encoding
  const binaryString = Array.from(tlvBytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binaryString);
}

/**
 * Generates a Data URL QR Code image from a TLV base64 string
 */
export async function generateQRDataURL(tlvBase64: string): Promise<string> {
  try {
    const url = await QRCode.toDataURL(tlvBase64, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 200,
      color: {
        dark: "#0F172A", // brand primary slate
        light: "#FFFFFF"
      }
    });
    return url;
  } catch (error) {
    console.error("Failed to generate QR Code:", error);
    return "";
  }
}
