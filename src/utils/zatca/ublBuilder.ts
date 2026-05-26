import { Invoice, Company, CustomerOrSupplier } from "../../types";

// Browser-safe minimal XML builder (replaces xmlbuilder2 which is Node.js only)
function xmlNode(tag: string, attrs: Record<string, string> = {}, children: string = ""): string {
  const attrStr = Object.entries(attrs).map(([k, v]) => ` ${k}="${v}"`).join("");
  if (!children && children !== "0") return `<${tag}${attrStr}/>`;
  return `<${tag}${attrStr}>${children}</${tag}>`;
}

export function buildUBLXML(invoice: Invoice, company: Company, customer?: CustomerOrSupplier | null): string {
  try {
    const isSimplified = invoice.type === "simplified";
    const profileID = isSimplified ? "reporting:1.0" : "clearance:1.0";
    const invoiceTypeCode = isSimplified ? "0200000" : "0100000";

    const lines = (invoice.lineItems || []).map((item: any) => xmlNode("cac:InvoiceLine", {},
      xmlNode("cbc:ID", {}, item.id || "1") +
      xmlNode("cbc:InvoicedQuantity", { unitCode: "PCE" }, String(item.quantity || 1)) +
      xmlNode("cbc:LineExtensionAmount", { currencyID: "SAR" }, String(item.subtotal || 0)) +
      xmlNode("cac:Item", {},
        xmlNode("cbc:Name", {}, item.description || "") +
        xmlNode("cac:ClassifiedTaxCategory", {},
          xmlNode("cbc:ID", {}, "S") +
          xmlNode("cbc:Percent", {}, String(item.vatRate || 15)) +
          xmlNode("cac:TaxScheme", {}, xmlNode("cbc:ID", {}, "VAT"))
        )
      ) +
      xmlNode("cac:Price", {},
        xmlNode("cbc:PriceAmount", { currencyID: "SAR" }, String(item.unitPrice || 0))
      )
    )).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  ${xmlNode("cbc:ProfileID", {}, profileID)}
  ${xmlNode("cbc:ID", {}, invoice.invoiceNumber || "")}
  ${xmlNode("cbc:UUID", {}, (invoice as any).zatcaUUID || "00000000-0000-0000-0000-000000000000")}
  ${xmlNode("cbc:IssueDate", {}, invoice.issueDate || "")}
  ${xmlNode("cbc:IssueTime", {}, new Date().toTimeString().split(" ")[0])}
  ${xmlNode("cbc:InvoiceTypeCode", { name: invoiceTypeCode }, "388")}
  ${xmlNode("cbc:DocumentCurrencyCode", {}, "SAR")}
  ${xmlNode("cbc:TaxCurrencyCode", {}, "SAR")}
  ${xmlNode("cac:AccountingSupplierParty", {},
    xmlNode("cac:Party", {},
      xmlNode("cac:PartyName", {}, xmlNode("cbc:Name", {}, company.name || "")) +
      xmlNode("cac:PostalAddress", {},
        xmlNode("cbc:CityName", {}, company.city || "") +
        xmlNode("cbc:CountrySubentity", {}, "") +
        xmlNode("cac:Country", {}, xmlNode("cbc:IdentificationCode", {}, "SA"))
      ) +
      xmlNode("cac:PartyTaxScheme", {},
        xmlNode("cbc:CompanyID", {}, company.vatNumber || "") +
        xmlNode("cac:TaxScheme", {}, xmlNode("cbc:ID", {}, "VAT"))
      )
    )
  )}
  ${xmlNode("cac:AccountingCustomerParty", {},
    xmlNode("cac:Party", {},
      xmlNode("cac:PartyName", {}, xmlNode("cbc:Name", {}, customer?.name || ""))
    )
  )}
  ${xmlNode("cac:TaxTotal", {},
    xmlNode("cbc:TaxAmount", { currencyID: "SAR" }, String(invoice.totalVat || 0))
  )}
  ${xmlNode("cac:LegalMonetaryTotal", {},
    xmlNode("cbc:LineExtensionAmount", { currencyID: "SAR" }, String(invoice.subtotal || 0)) +
    xmlNode("cbc:TaxExclusiveAmount", { currencyID: "SAR" }, String(invoice.subtotal || 0)) +
    xmlNode("cbc:TaxInclusiveAmount", { currencyID: "SAR" }, String(invoice.total || 0)) +
    xmlNode("cbc:PayableAmount", { currencyID: "SAR" }, String(invoice.total || 0))
  )}
  ${lines}
</Invoice>`;

    return xml;
  } catch (err) {
    console.error("UBL XML build error:", err);
    return "";
  }
}
