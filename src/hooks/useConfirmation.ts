import * as React from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
}

interface ConfirmState extends ConfirmOptions {
  isOpen: boolean;
  resolve: ((value: boolean) => void) | null;
}

const initialState: ConfirmState = {
  isOpen: false,
  message: "",
  resolve: null,
};

export function useConfirmation() {
  const [state, setState] = React.useState<ConfirmState>(initialState);

  const confirm = React.useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const opts = typeof options === "string" ? { message: options } : options;
    return new Promise((resolve) => {
      setState({ ...opts, isOpen: true, resolve });
    });
  }, []);

  const handleConfirm = () => {
    state.resolve?.(true);
    setState(initialState);
  };

  const handleCancel = () => {
    state.resolve?.(false);
    setState(initialState);
  };

  const ConfirmationModal = () => {
    if (!state.isOpen) return null;

    const variant = state.variant || "danger";
    const colors = {
      danger:  { btn: "bg-red-600 hover:bg-red-700",    icon: "text-red-500",  bg: "bg-red-50" },
      warning: { btn: "bg-amber-500 hover:bg-amber-600", icon: "text-amber-500", bg: "bg-amber-50" },
      info:    { btn: "bg-brand-primary hover:opacity-90", icon: "text-blue-500", bg: "bg-blue-50" },
    }[variant];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="p-6">
            {state.title && (
              <h3 className="font-bold text-slate-800 text-base mb-2">{state.title}</h3>
            )}
            <p className="text-sm text-slate-600 leading-relaxed">{state.message}</p>
          </div>
          <div className="flex gap-3 px-6 pb-5">
            <button
              onClick={handleCancel}
              className="flex-1 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {state.cancelLabel || "Cancel"}
            </button>
            <button
              onClick={handleConfirm}
              className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${colors.btn}`}
            >
              {state.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return { confirm, ConfirmationModal };
}

export default useConfirmation;
