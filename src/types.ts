export enum InvoiceType {
  STANDARD = "standard",
  SIMPLIFIED = "simplified",
  CREDIT = "credit",
  DEBIT = "debit"
}

export enum InvoiceStatus {
  DRAFT = "draft",
  PENDING = "pending",
  APPROVED = "approved",
  REPORTED = "reported",
  PAID = "paid",
  CANCELLED = "cancelled"
}

export enum ZatcaStatus {
  NOT_SUBMITTED = "not_submitted",
  PENDING = "pending",
  CLEARED = "cleared",
  REPORTED = "reported",
  REJECTED = "rejected"
}

export interface Company {
  id: string;
  name: string;
  nameAr: string;
  vatNumber: string; // 15-digit
  crNumber: string; // 10-digit
  address: string;
  addressAr: string;
  city: string;
  country: string; // "SA"
  phone: string;
  email: string;
  logo?: string;
  zatcaPhase: 1 | 2;
  zatcaCSID?: string;
  zatcaPCSID?: string;
  lastInvoiceHash?: string;
  invoiceCounter: number;
  currency: string; // "SAR"
  defaultVatRate: number; // 15
  language: "ar" | "en";
  fiscalYearStart: string; // "01-01"
  plan: "standard" | "professional" | "premium";
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface Member {
  uid: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "accountant" | "viewer";
  addedAt: Date | any;
}

export interface CustomerOrSupplier {
  id: string;
  name: string;
  nameAr: string;
  vatNumber?: string;
  crNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  type: "individual" | "business";
  totalInvoiced?: number;
  totalPaid?: number;
  balance?: number;
  bankName?: string;
  iban?: string;
  isActive: boolean;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  sku: string;
  barcode?: string;
  type: "product" | "service";
  category?: string;
  unit?: string;
  salePrice: number;
  costPrice?: number;
  vatRate: 0 | 5 | 15;
  vatCategory: "standard" | "zero" | "exempt";
  trackInventory: boolean;
  stockQty: number;
  lowStockThreshold?: number;
  isActive: boolean;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface LineItem {
  productId: string;
  name: string;
  nameAr: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  vatRate: 0 | 5 | 15;
  vatAmount: number;
  lineTotal: number;
}

export interface VatBreakdown {
  rate: number;
  base: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  customerId: string;
  customerName: string;
  customerNameAr: string;
  customerVatNumber?: string;
  customerAddress?: string;
  issueDate: string;
  dueDate: string;
  supplyDate: string;
  lineItems: LineItem[];
  subtotal: number;
  totalDiscount: number;
  vatBreakdown: VatBreakdown[];
  totalVat: number;
  grandTotal: number;
  currency: string; // "SAR"
  zatcaUUID?: string;
  zatcaHash?: string;
  zatcaQRCode?: string; // base64 TLV
  zatcaXML?: string;
  zatcaSignedXML?: string;
  zatcaStatus: ZatcaStatus;
  zatcaSubmissionId?: string;
  zatcaWarnings?: string[];
  zatcaErrors?: string[];
  zatcaPhase: 1 | 2;
  zatcaClearedXML?: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  amountPaid: number;
  amountDue: number;
  notes?: string;
  notesAr?: string;
  attachments?: string[];
  branchId?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface Bill {
  id: string;
  billNumber: string;
  supplierId: string;
  supplierName: string;
  supplierNameAr?: string;
  supplierVatNumber?: string;
  issueDate: string;
  dueDate: string;
  lineItems: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalVat: number;
  grandTotal: number;
  status: "draft" | "pending" | "approved" | "paid" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  amountPaid: number;
  amountDue: number;
  notes?: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface Expense {
  id: string;
  title: string;
  titleAr: string;
  description?: string;
  category: "travel" | "office" | "meals" | "it" | "marketing" | "other";
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  employeeId?: string;
  employeeName?: string;
  receiptURL?: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  paymentMethod: "cash" | "card" | "transfer";
  branchId?: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface Payment {
  id: string;
  direction: "inbound" | "outbound";
  referenceType: "invoice" | "bill" | "expense";
  referenceId: string;
  referenceNumber: string;
  amount: number;
  currency: string;
  paymentDate: string;
  method: "cash" | "bank_transfer" | "card" | "check";
  bankName?: string;
  checkNumber?: string;
  notes?: string;
  createdAt: Date | any;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";
  subtype?: string;
  parentId?: string;
  isSystemAccount: boolean;
  isActive: boolean;
  normalBalance: "debit" | "credit";
  description?: string;
  balance?: number;
}

export interface JournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  note?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  descriptionAr?: string;
  reference?: string;
  branchId?: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  status: "draft" | "posted";
  createdBy: string;
  createdAt: Date | any;
  postedAt?: Date | any;
}

export interface Employee {
  id: string;
  name: string;
  nameAr: string;
  nationalId?: string;
  iqamaNumber?: string;
  position?: string;
  department?: string;
  joinDate: string;
  baseSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  totalMonthlyGross: number;
  gosiEnrolled: boolean;
  employerGosiRate: number; // e.g. 12
  employeeGosiRate: number; // e.g. 10
  bankName?: string;
  iban?: string;
  isActive: boolean;
  createdAt: Date | any;
}

export interface PayrollRunEmployee {
  employeeId: string;
  name: string;
  nameAr: string;
  baseSalary: number;
  totalAllowances: number;
  grossSalary: number;
  employeeGosi: number;
  totalDeductions: number;
  netSalary: number;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  periodLabel: string; // e.g., "March 2024"
  status: "draft" | "approved" | "paid";
  employees: PayrollRunEmployee[];
  totalGross: number;
  totalGosiEmployer: number;
  totalGosiEmployee: number;
  totalDeductions: number;
  totalNet: number;
  processedAt: Date | any;
  approvedBy?: string;
  paidAt?: Date | any;
}

export interface VatReturn {
  id: string;
  period: string; // e.g., "Q1-2024"
  startDate: string;
  endDate: string;
  status: "draft" | "submitted" | "accepted";
  salesStandardRated: number;
  salesStandardRatedVat: number;
  salesZeroRated: number;
  salesExempt: number;
  purchasesStandardRated: number;
  purchasesStandardRatedVat: number;
  netVatDue: number;
  vatAdjustments: number;
  referenceNumber?: string;
  submittedAt?: Date | any;
}

export interface Branch {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  isHeadquarters: boolean;
  isActive: boolean;
  createdAt: Date | any;
}

// Aliases used by ChartOfAccountsPage
export type ChartOfAccount = Account;

export enum AccountType {
  ASSET = "asset",
  LIABILITY = "liability",
  EQUITY = "equity",
  REVENUE = "revenue",
  EXPENSE = "expense"
}

// ─── Phase 2 Types ────────────────────────────────────────────────────────────

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerNameAr: string;
  issueDate: string;
  expiryDate: string;
  status: QuotationStatus;
  lineItems: LineItem[];
  subtotal: number;
  totalDiscount: number;
  totalVat: number;
  grandTotal: number;
  currency: string;
  notes?: string;
  notesAr?: string;
  convertedToInvoiceId?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export type POStatus = "draft" | "sent" | "approved" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  supplierNameAr: string;
  issueDate: string;
  expectedDate: string;
  status: POStatus;
  lineItems: LineItem[];
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  currency: string;
  notes?: string;
  linkedBillId?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface DeliveryNote {
  id: string;
  dnNumber: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  customerNameAr: string;
  deliveryDate: string;
  status: "draft" | "dispatched" | "delivered" | "returned";
  items: { name: string; nameAr: string; qty: number; unit: string }[];
  deliveryAddress?: string;
  driverName?: string;
  notes?: string;
  signedAt?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

// ─── Phase 3 Types ────────────────────────────────────────────────────────────

export interface PettyCash {
  id: string;
  date: string;
  description: string;
  descriptionAr: string;
  type: "in" | "out";
  amount: number;
  category: string;
  balance: number;
  receiptUrl?: string;
  createdBy: string;
  createdAt: Date | any;
}

export interface Overhead {
  id: string;
  date: string;
  title: string;
  titleAr: string;
  category: "rent" | "utilities" | "insurance" | "subscriptions" | "maintenance" | "other";
  amount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  isRecurring: boolean;
  recurringDay?: number;
  notes?: string;
  createdBy: string;
  createdAt: Date | any;
}

export interface ProfitDistribution {
  id: string;
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  partners: { name: string; percentage: number; amount: number }[];
  status: "draft" | "approved";
  journalEntryId?: string;
  createdBy: string;
  createdAt: Date | any;
}

// ─── Phase 4 Types ────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  nameAr: string;
  clientId?: string;
  clientName?: string;
  contractValue: number;
  vatPercent: number;
  vatAmount: number;
  totalValue: number;
  status: "active" | "completed" | "on_hold" | "cancelled";
  startDate: string;
  endDate?: string;
  description?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: "present" | "absent" | "late" | "half_day" | "holiday";
  checkIn?: string;
  checkOut?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date | any;
}

// ─── Group 5-13 Types ─────────────────────────────────────────────────────────

export interface Income {
  id: string;
  date: string;
  description: string;
  descriptionAr: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  category: string;
  amount: number;
  vatPercent: number;
  vatAmount: number;
  totalAmount: number;
  vatInclusive: boolean;
  paymentMethod: string;
  receiptNo?: string;
  attachments?: string[];
  notes?: string;
  createdBy: string;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: string;
  reason?: string;
  status: "pending" | "approved" | "settled";
  settledInPayrollId?: string;
  createdBy: string;
  createdAt: Date | any;
}
