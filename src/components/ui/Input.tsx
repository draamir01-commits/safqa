import * as React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = "", ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-semibold text-slate-700 select-none">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-white border rounded-md text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-slate-400 ${
            error
              ? "border-brand-danger focus:border-brand-danger focus:ring-red-200"
              : "border-slate-300 focus:border-brand-primary focus:ring-blue-100"
          } ${className}`}
          {...props}
        />
        {error && <span className="text-xs font-medium text-brand-danger">{error}</span>}
        {!error && helperText && <span className="text-xs text-slate-400">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
