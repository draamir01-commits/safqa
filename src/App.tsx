import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { auth } from "./firebase/config";

import "./i18n";

import { useAuthStore } from "./stores/authStore";
import { useCompanyStore } from "./stores/companyStore";
import { AppLayout } from "./components/layout/AppLayout";
import LoadingSpinner from "./components/ui/LoadingSpinner";

import { LandingPage } from "./LandingPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { CompanySetupPage } from "./pages/onboarding/CompanySetupPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { CustomersPage } from "./pages/customers/CustomersPage";
import { SuppliersPage } from "./pages/suppliers/SuppliersPage";
import { ProductsPage } from "./pages/products/ProductsPage";
import { InvoicesPage } from "./pages/invoices/InvoicesPage";
import { NewInvoicePage } from "./pages/invoices/NewInvoicePage";
import { BillsPage } from "./pages/bills/BillsPage";
import { ExpensesPage } from "./pages/expenses/ExpensesPage";
import { ChartOfAccountsPage } from "./pages/coa/ChartOfAccountsPage";
import { JournalEntriesPage } from "./pages/journal/JournalEntriesPage";
import { PayrollPage } from "./pages/payroll/PayrollPage";
import { ReportsPage } from "./pages/reports/ReportsPage";
import { QuotationsPage } from "./pages/quotations/QuotationsPage";
import { PurchaseOrdersPage } from "./pages/purchaseorders/PurchaseOrdersPage";
import { DeliveryNotesPage } from "./pages/deliverynotes/DeliveryNotesPage";
import { IncomePage } from "./pages/income/IncomePage";
import { ProjectsPage } from "./pages/projects/ProjectsPage";
import { AttendancePage } from "./pages/attendance/AttendancePage";
import { VatReturnPage } from "./pages/vatreturns/VatReturnPage";
import { PartnerLedgerPage } from "./pages/partnerledger/PartnerLedgerPage";
import { PettyCashPage } from "./pages/pettycash/PettyCashPage";
import { OverheadsPage } from "./pages/overheads/OverheadsPage";
import { ProfitDistributionPage } from "./pages/profitdistribution/ProfitDistributionPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { UserManagementPage } from "./pages/users/UserManagementPage";
import { SuperAdminPage } from "./SuperAdminPage";

export default function App() {
  const { setUser } = useAuthStore();
  const { loadUserCompanies, companies } = useCompanyStore();

  // Three states: "loading" | "authenticated" | "unauthenticated"
  const [status, setStatus] = React.useState<"loading" | "authenticated" | "unauthenticated">("loading");

  React.useEffect(() => {
    const init = async () => {
      // Step 1: Check for Google redirect result
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(result.user);
          await loadUserCompanies(result.user.uid);
          setStatus("authenticated");
          return;
        }
      } catch (err) {
        console.error("Redirect error:", err);
      }

      // Step 2: Listen for auth state
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUser(user);
          await loadUserCompanies(user.uid);
          setStatus("authenticated");
        } else {
          setUser(null);
          setStatus("unauthenticated");
        }
      });

      return unsubscribe;
    };

    init();
  }, []);

  // Show loading spinner until auth + companies are fully resolved
  if (status === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading Safqa..." />
      </div>
    );
  }

  const isLoggedIn = status === "authenticated";
  const hasCompany = companies.length > 0;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/superadmin" element={<SuperAdminPage />} />
        <Route path="/login" element={
          isLoggedIn && hasCompany ? <Navigate to="/dashboard" replace /> :
          isLoggedIn && !hasCompany ? <Navigate to="/onboarding" replace /> :
          <LoginPage />
        } />
        <Route path="/register" element={
          isLoggedIn && hasCompany ? <Navigate to="/dashboard" replace /> :
          isLoggedIn && !hasCompany ? <Navigate to="/onboarding" replace /> :
          <RegisterPage />
        } />
        <Route path="/onboarding" element={
          !isLoggedIn ? <Navigate to="/" replace /> : <CompanySetupPage />
        } />

        {/* Root — smart redirect */}
        <Route path="/" element={
          !isLoggedIn ? <LandingPage /> :
          !hasCompany ? <Navigate to="/onboarding" replace /> :
          <Navigate to="/dashboard" replace />
        } />

        {/* Protected routes */}
        <Route element={
          !isLoggedIn ? <Navigate to="/" replace /> :
          !hasCompany ? <Navigate to="/onboarding" replace /> :
          <AppLayout />
        }>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="income" element={<IncomePage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<NewInvoicePage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="delivery-notes" element={<DeliveryNotesPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="bills" element={<BillsPage />} />
          <Route path="expenses" element={<ExpensesPage />} />
          <Route path="overheads" element={<OverheadsPage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="chart-of-accounts" element={<ChartOfAccountsPage />} />
          <Route path="journal-entries" element={<JournalEntriesPage />} />
          <Route path="petty-cash" element={<PettyCashPage />} />
          <Route path="partner-ledger" element={<PartnerLedgerPage />} />
          <Route path="profit-distribution" element={<ProfitDistributionPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="vat-returns" element={<VatReturnPage />} />
          <Route path="users" element={<UserManagementPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster position="top-center" toastOptions={{
        duration: 4000,
        style: { borderRadius: "10px", background: "#0F172A", color: "#F1F5F9", fontSize: "14px" },
      }} />
    </BrowserRouter>
  );
}
