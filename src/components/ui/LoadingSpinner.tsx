import * as React from "react";
import { useTranslation } from "react-i18next";

interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, size = "md" }) => {
  const { t } = useTranslation();
  
  const sizes = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-3",
    lg: "h-16 w-16 border-4"
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className={`animate-spin rounded-full border-t-brand-primary border-slate-200 ${sizes[size]}`} />
      <span className="text-sm font-medium text-slate-500">
        {message || t("common.loading", "Processing...")}
      </span>
    </div>
  );
};
export default LoadingSpinner;
