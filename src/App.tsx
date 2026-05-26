/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/config";
import { getRedirectResult, GoogleAuthProvider } from "firebase/auth";

import "./i18n";

import { useAuthStore } from "./stores/authStore";
import { useCompanyStore } from "./stores/companyStore";
import { AppLayout } from "./components/layout/AppLayout";
import LoadingSpinner from "./components/ui/LoadingSpinner";

// Pages
import { LandingPage } from "./pages/landing/LandingPage";
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
import { SuperAdminPage } from "./pages/superadmin/SuperAdminPage";

// ─── Smart Root Redirect ───────────────────────────────────────────────────────
// Decides where to send the user based on their auth + company state
const RootRedirect: React.FC<{ user: any; hasCompany: boolean }> = ({ user, hasCompany }) => {
  if (!user) return <LandingPage />;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
};

// ─── Protected Route ───────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ user: any; hasCompany: boolean; children: React.ReactNode }> = ({ user, hasCompany, children }) => {
  if (!user) return <Navigate to="/welcome" replace />;
  if (!hasCompany) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

// ─── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  const { setUser } = useAuthStore();
  const { loadUserCompanies, companies } = useCompanyStore();

  const [authUser, setAuthUser] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Step 1: Handle Google redirect result FIRST
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          // Google redirect just completed — save user and load companies
          setAuthUser(result.user);
          setUser(result.user);
          await loadUserCompanies(result.user.uid);
        }
      })
      .catch((err) => {
        console.error("Redirect result error:", err);
      })
      .finally(() => {
        // Step 2: Now start the persistent auth listener
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
          setAuthUser(user);
          setUser(user);
          if (user) {
            await loadUserCompanies(user.uid);
          }
          setLoading(false);
        });

        // Cleanup
        return unsubscribe;
      });
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading Safqa..." />
      </div>
    );
  }

  const hasCompany = companies.length > 0;

  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ── */}
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="/login" element={authUser && hasCompany ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/register" element={authUser && hasCompany ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
        <Route path="/onboarding" element={!authUser ? <Navigate to="/welcome" replace /> : <CompanySetupPage />} />
        <Route path="/superadmin" element={<SuperAdminPage />} />

        {/* ── Root smart redirect ── */}
        <Route path="/" element={<RootRedirect user={authUser} hasCompany={hasCompany} />} />

        {/* ── Protected app ── */}
        <Route element={
          <ProtectedRoute user={authUser} hasCompany={hasCompany}>
            <AppLayout />
          </ProtectedRoute>
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

        {/* ── Catch all ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: "10px", background: "#0F172A", color: "#F1F5F9", fontSize: "14px" },
        }}
      />
    </BrowserRouter>
  );
}
