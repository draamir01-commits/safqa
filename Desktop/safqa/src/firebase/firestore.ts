import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db, auth } from "./config";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Audit Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// GENERIC REUSABLE WRAPPERS
export async function getDocument(path: string, id: string) {
  try {
    const docRef = doc(db, path, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
  }
}

export async function createDocumentWithId(path: string, id: string, data: any) {
  try {
    const docRef = doc(db, path, id);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id, ...data };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${id}`);
  }
}

export async function addDocument(path: string, data: any) {
  try {
    const colRef = collection(db, path);
    const docRef = await addDoc(colRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...data };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateDocument(path: string, id: string, data: any) {
  try {
    const docRef = doc(db, path, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
  }
}

export async function deleteDocument(path: string, id: string) {
  try {
    const docRef = doc(db, path, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
  }
}

// COMPANY SCOPED ACTIONS - To enforce high-security isolation
export function listenCompanyCollection(companyId: string, subPath: string, callback: (docs: any[]) => void, onError?: (err: any) => void) {
  const path = `companies/${companyId}/${subPath}`;
  const colRef = collection(db, "companies", companyId, subPath);
  
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (error) => {
    if (onError) onError(error);
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// SPECIFIC MODULE HELPERS
export async function getCompanyData(companyId: string) {
  return getDocument("companies", companyId);
}

// INVOICES
export async function getNextInvoiceNumber(companyId: string, prefix: string = "INV"): Promise<string> {
  try {
    const compRef = doc(db, "companies", companyId);
    const compDoc = await getDoc(compRef);
    const counter = compDoc.exists() ? (compDoc.data().invoiceCounter || 0) + 1 : 1;
    
    // Update company's counter atomically
    await updateDoc(compRef, { invoiceCounter: increment(1) });
    
    const year = new Date().getFullYear();
    const formattedCounter = String(counter).padStart(5, "0");
    return `${prefix}-${year}-${formattedCounter}`;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `companies/${companyId}`);
    return `INV-${Date.now()}`;
  }
}

export async function saveInvoice(companyId: string, invoiceId: string, invoiceData: any) {
  const path = `companies/${companyId}/invoices`;
  return createDocumentWithId(path, invoiceId, invoiceData);
}

// CUSTOMERS
export async function saveCustomer(companyId: string, customerId: string, customerData: any) {
  const path = `companies/${companyId}/customers`;
  return createDocumentWithId(path, customerId, customerData);
}

// SUPPLIERS
export async function saveSupplier(companyId: string, supplierId: string, supplierData: any) {
  const path = `companies/${companyId}/suppliers`;
  return createDocumentWithId(path, supplierId, supplierData);
}

// PRODUCTS
export async function saveProduct(companyId: string, productId: string, productData: any) {
  const path = `companies/${companyId}/products`;
  return createDocumentWithId(path, productId, productData);
}

// EXPENSES
export async function saveExpense(companyId: string, expenseId: string, expenseData: any) {
  const path = `companies/${companyId}/expenses`;
  return createDocumentWithId(path, expenseId, expenseData);
}

// BILLS
export async function saveBill(companyId: string, billId: string, billData: any) {
  const path = `companies/${companyId}/bills`;
  return createDocumentWithId(path, billId, billData);
}

// EMPLOYEES
export async function saveEmployee(companyId: string, employeeId: string, employeeData: any) {
  const path = `companies/${companyId}/employees`;
  return createDocumentWithId(path, employeeId, employeeData);
}

// PAYROLL RUNS
export async function savePayrollRun(companyId: string, payrollId: string, payrollData: any) {
  const path = `companies/${companyId}/payrollRuns`;
  return createDocumentWithId(path, payrollId, payrollData);
}

// JOURNAL ENTRIES
export async function saveJournalEntry(companyId: string, entryId: string, entryData: any) {
  const path = `companies/${companyId}/journalEntries`;
  return createDocumentWithId(path, entryId, entryData);
}

// VAT RETURNS
export async function saveVatReturn(companyId: string, returnId: string, vatReturnData: any) {
  const path = `companies/${companyId}/vatReturns`;
  return createDocumentWithId(path, returnId, vatReturnData);
}

// BRANCHES
export async function saveBranch(companyId: string, branchId: string, branchData: any) {
  const path = `companies/${companyId}/branches`;
  return createDocumentWithId(path, branchId, branchData);
}

export async function saveAccountNode(companyId: string, accountId: string, data: any) {
  return updateDocument(`companies/${companyId}/accounts`, accountId, data);
}

// Alias used by JournalEntriesPage
export async function saveJournal(companyId: string, entryId: string, data: any) {
  return saveJournalEntry(companyId, entryId, data);
}

// MEMBER STATUS MANAGEMENT (Pending Approval Flow)
export async function getMemberStatus(companyId: string, userId: string): Promise<"active" | "pending" | "rejected" | null> {
  try {
    const memberRef = doc(db, "companies", companyId, "members", userId);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) return null;
    return snap.data().status || "active";
  } catch (error) {
    return null;
  }
}

export async function approveMember(companyId: string, memberId: string, approvedByUid: string) {
  try {
    await updateDoc(doc(db, "companies", companyId, "members", memberId), {
      status: "active",
      approvedAt: serverTimestamp(),
      approvedBy: approvedByUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/members/${memberId}`);
  }
}

export async function rejectMember(companyId: string, memberId: string, rejectedByUid: string) {
  try {
    await updateDoc(doc(db, "companies", companyId, "members", memberId), {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedBy: rejectedByUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/members/${memberId}`);
  }
}

export async function reRequestAccess(companyId: string, memberId: string) {
  try {
    await updateDoc(doc(db, "companies", companyId, "members", memberId), {
      status: "pending",
      reRequestedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `companies/${companyId}/members/${memberId}`);
  }
}

export function listenPendingMembers(companyId: string, callback: (members: any[]) => void) {
  const q = query(
    collection(db, "companies", companyId, "members"),
    where("status", "==", "pending")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
}
