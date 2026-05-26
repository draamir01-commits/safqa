import * as React from "react";
import { useTranslation } from "react-i18next";

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { t } = useTranslation();
  const s = status.toLowerCase();

  const styles: { [key: string]: string } = {
    draft: "bg-slate-100 text-slate-700 border-slate-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-blue-50 text-blue-700 border-blue-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    unpaid: "bg-red-50 text-red-700 border-red-200",
    partial: "bg-indigo-50 text-indigo-700 border-indigo-200",
    cancelled: "bg-slate-100 text-slate-500 line-through border-slate-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    cleared: "bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold",
    reported: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200 font-bold"
  };

  const styleClass = styles[s] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styleClass}`}>
      {t(`status.${s}`, s)}
    </span>
  );
};
export default StatusBadge;
