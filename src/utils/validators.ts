/**
 * Validates a Saudi KSA VAT configuration.
 * Must be exactly 15 digits, start with the digit "3", and end with the digit "3".
 */
export function isValidSaudiVat(vat: string): boolean {
  const cleanVat = vat.replace(/\s|-/g, "");
  const saudiVatRegex = /^3[0-9]{13}3$/;
  return saudiVatRegex.test(cleanVat);
}

/**
 * Validates a Saudi Commercial Registration Number (CRN).
 * Must be exactly 10 digits.
 */
export function isValidSaudiCrn(crn: string): boolean {
  const cleanCrn = crn.trim();
  const crnRegex = /^[0-9]{10}$/;
  return crnRegex.test(cleanCrn);
}

/**
 * Validates Saudi phone numbers:
 * Starts with +9665xxxxxxxx or 05xxxxxxxx
 */
export function isValidSaudiPhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\s|-/g, "");
  const phoneRegex = /^(05|009665|\+9665)[0-9]{8}$/;
  return phoneRegex.test(cleanPhone);
}

/**
 * Validates Saudi Bank IBAN numbers.
 * Must start with "SA" followed by exactly 22 digits (24 characters total).
 */
export function isValidSaudiIban(iban: string): boolean {
  const cleanIban = iban.trim().toUpperCase().replace(/\s/g, "");
  const ibanRegex = /^SA[0-9]{22}$/;
  return ibanRegex.test(cleanIban);
}
