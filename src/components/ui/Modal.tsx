import * as React from "react";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md"
}) => {
  // Lock body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl"
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 overflow-y-auto"
      style={{ backgroundColor: "rgba(15,23,42,0.45)" }}
    >
      {/* Backdrop click to close */}
      <div className="fixed inset-0 z-0" onClick={onClose} />

      {/* Modal Card */}
      <div
        className={`relative w-full ${sizes[size]} bg-white rounded-xl shadow-2xl border border-slate-100 z-10 my-auto`}
        style={{ maxHeight: "calc(100vh - 5rem)" }}
      >
        {/* Header — fixed inside modal */}
        <div className="sticky top-0 px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-xl z-10">
          <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          className="px-5 py-5 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 10rem)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
export default Modal;
