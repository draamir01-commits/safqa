import { create } from "zustand";
import { doc, getDoc, updateDoc, setDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { Company } from "../types";

interface CompanyState {
  currentCompany: Company | null;
  companies: Company[];
  userRole: "owner" | "admin" | "accountant" | "viewer" | null;
  loading: boolean;
  setCurrentCompany: (company: Company | null) => void;
  setCompanies: (companies: Company[]) => void;
  setLoading: (loading: boolean) => void;
  loadUserCompanies: (userId: string) => Promise<void>;
  switchCompany: (companyId: string) => Promise<void>;
  updateCompany: (companyId: string, data: Partial<Company>) => Promise<void>;
  createCompany: (companyData: Omit<Company, "id" | "createdAt" | "updatedAt">, userId: string, userEmail: string, userName: string) => Promise<Company>;
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
  currentCompany: null,
  companies: [],
  userRole: null,
  loading: false,

  setCurrentCompany: (company) => set({ currentCompany: company }),
  setCompanies: (companies) => set({ companies }),
  setLoading: (loading) => set({ loading }),

  loadUserCompanies: async (userId) => {
    set({ loading: true });
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      const loadedCompanies: Company[] = [];

      // Method 1: Load from user's companiesAccess list
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const access = userData.companiesAccess || [];

        for (const item of access) {
          const compRef = doc(db, "companies", item.companyId);
          const compDoc = await getDoc(compRef);
          if (compDoc.exists()) {
            loadedCompanies.push({ id: compDoc.id, ...compDoc.data() } as Company);
          }
        }
      }

      // Method 2: If no companies found, search companies where owner matches
      if (loadedCompanies.length === 0) {
        const { getDocs, collection: col, query: q, where } = await import("firebase/firestore");
        const companiesSnap = await getDocs(
          q(col(db, "companies"), where("ownerId", "==", userId))
        );
        for (const compDoc of companiesSnap.docs) {
          loadedCompanies.push({ id: compDoc.id, ...compDoc.data() } as Company);
        }
      }

      // Method 3: Check members subcollection across all companies
      if (loadedCompanies.length === 0) {
        const { getDocs, collection: col } = await import("firebase/firestore");
        const allCompaniesSnap = await getDocs(col(db, "companies"));
        for (const compDoc of allCompaniesSnap.docs) {
          const memberDoc = await getDoc(doc(db, "companies", compDoc.id, "members", userId));
          if (memberDoc.exists()) {
            loadedCompanies.push({ id: compDoc.id, ...compDoc.data() } as Company);
          }
        }
      }

      set({ companies: loadedCompanies });

      if (loadedCompanies.length > 0) {
        const userData = userDoc.exists() ? userDoc.data() : {};
        const access = userData?.companiesAccess || [];
        const defaultId = userData?.defaultCompanyId;
        const current = (defaultId && loadedCompanies.find(c => c.id === defaultId)) || loadedCompanies[0];
        const roleItem = access.find((a: any) => a.companyId === current?.id);
        set({ currentCompany: current, userRole: roleItem?.role || "owner" });
      } else {
        set({ currentCompany: null, userRole: null });
      }
    } catch (e) {
      console.error("Error loading user companies:", e);
    } finally {
      set({ loading: false });
    }
  },

  switchCompany: async (companyId) => {
    const comp = get().companies.find(c => c.id === companyId);
    if (comp) {
      set({ currentCompany: comp });
      // Get role
      const authStoreUser = doc(db, "users", comp.email); // standard check
      // For now, switch immediately
    }
  },

  updateCompany: async (companyId, data) => {
    try {
      const compRef = doc(db, "companies", companyId);
      await updateDoc(compRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      // Re-update local state
      const updatedCompanies = get().companies.map(c => c.id === companyId ? { ...c, ...data } : c);
      set({
        companies: updatedCompanies,
        currentCompany: get().currentCompany?.id === companyId ? { ...get().currentCompany!, ...data } : get().currentCompany
      });
    } catch (error) {
      console.error("Failed to update company in Firestore:", error);
      throw error;
    }
  },

  createCompany: async (companyData, userId, userEmail, userName) => {
    set({ loading: true });
    try {
      const companyId = "comp_" + Math.random().toString(36).substr(2, 9);
      const companyRef = doc(db, "companies", companyId);

      const finalCompany: Company = {
        ...companyData,
        id: companyId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 1. Create company doc
      // Convert dates to server compatible
      await setDoc(companyRef, {
        name: companyData.name,
        nameAr: companyData.nameAr,
        vatNumber: companyData.vatNumber,
        crNumber: companyData.crNumber,
        address: companyData.address,
        addressAr: companyData.addressAr,
        city: companyData.city,
        country: "SA",
        phone: companyData.phone,
        email: companyData.email,
        logo: companyData.logo || "",
        zatcaPhase: companyData.zatcaPhase,
        invoiceCounter: companyData.invoiceCounter || 0,
        currency: "SAR",
        defaultVatRate: 15,
        language: companyData.language || "ar",
        fiscalYearStart: "01-01",
        plan: "standard",
        lastInvoiceHash: "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NWVhNGRiNDJlYzc3OA==" // default ZATCA hash
      });

      // 2. Add as member
      const memberRef = doc(db, "companies", companyId, "members", userId);
      await setDoc(memberRef, {
        uid: userId,
        email: userEmail,
        name: userName,
        role: "owner",
        addedAt: new Date()
      });

      // 3. Preseed Standard Chart of Accounts for KSA
      const initialCOA = [
        { code: "1000", name: "Current Assets", nameAr: "الأصول المتداولة", type: "asset", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "1100", name: "Cash & Bank Accounts", nameAr: "النقدية والحسابات البنكية", type: "asset", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "1200", name: "Accounts Receivable", nameAr: "العملاء / ذمم مدينة", type: "asset", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "1300", name: "Inventory", nameAr: "المخزون", type: "asset", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "2000", name: "Current Liabilities", nameAr: "الالتزامات المتداولة", type: "liability", normalBalance: "credit", isSystemAccount: true, isActive: true },
        { code: "2100", name: "Accounts Payable", nameAr: "الموردين / ذمم دائنة", type: "liability", normalBalance: "credit", isSystemAccount: true, isActive: true },
        { code: "2200", name: "VAT Payable", nameAr: "ضريبة القيمة المضافة المستحقة", type: "liability", normalBalance: "credit", isSystemAccount: true, isActive: true },
        { code: "3000", name: "Equity", nameAr: "حقوق الملكية", type: "equity", normalBalance: "credit", isSystemAccount: true, isActive: true },
        { code: "4000", name: "Revenue", nameAr: "الإيرادات والمبيعات", type: "revenue", normalBalance: "credit", isSystemAccount: true, isActive: true },
        { code: "5000", name: "Cost of Goods Sold", nameAr: "تكلفة البضاعة المباعة", type: "cogs", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "6000", name: "Operating Expenses", nameAr: "المصاريف التشغيلية", type: "expense", normalBalance: "debit", isSystemAccount: true, isActive: true },
        { code: "6100", name: "Salaries & Wages", nameAr: "الرواتب والأجور", type: "expense", normalBalance: "debit", isSystemAccount: true, isActive: true }
      ];

      for (const acct of initialCOA) {
        const acctRef = doc(db, "companies", companyId, "chartOfAccounts", acct.code);
        await setDoc(acctRef, acct);
      }

      // 4. Update the User profile's companiesAccess & defaultCompanyId
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      const currentAccess = userDoc.exists() ? (userDoc.data().companiesAccess || []) : [];
      const updatedAccess = [...currentAccess, { companyId, role: "owner" }];

      await setDoc(userDocRef, {
        email: userEmail,
        displayName: userName,
        companiesAccess: updatedAccess,
        defaultCompanyId: companyId
      }, { merge: true });

      // Refresh stores local state
      set(state => ({
        companies: [...state.companies, finalCompany],
        currentCompany: finalCompany,
        userRole: "owner"
      }));

      return finalCompany;
    } catch (e) {
      console.error("Create company error:", e);
      throw e;
    } finally {
      set({ loading: false });
    }
  }
}));
