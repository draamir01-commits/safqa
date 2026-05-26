import * as React from "react";
import { FolderOpen } from "lucide-react";
import Button from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-300 rounded-lg bg-white shadow-xs max-w-lg mx-auto text-center gap-4">
      <div className="p-4 rounded-full bg-slate-50 border border-slate-100 text-slate-400">
        <FolderOpen className="h-10 w-10 stroke-[1.5]" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-800 text-base">{title}</h4>
        <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
export default EmptyState;
