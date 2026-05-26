import * as React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { useCompanyStore } from "../../stores/companyStore";
import LoadingSpinner from "../ui/LoadingSpinner";

interface PrivateRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuthStore();
  const { companies, loading: companyLoading } = useCompanyStore();

  // Still loading — wait before deciding
  if (authLoading || companyLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  // Not logged in — go to landing page
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // Logged in but no company — go to onboarding
  if (companies.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
