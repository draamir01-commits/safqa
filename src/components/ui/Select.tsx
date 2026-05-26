import * as React from "react";

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5 font-sans">
        {label && (
          <label className="text-xs font-semibold text-slate-700 select-none">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full px-3 py-2 bg-white border rounded-md text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary ${
            error
              ? "border-brand-danger focus:border-brand-danger focus:ring-red-200"
              : "border-slate-300 focus:border-brand-primary focus:ring-blue-100"
          } ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="text-xs font-medium text-brand-danger">{error}</span>}
      </div>
    );
  }
);

Select.displayName = "Select";
export default Select;
