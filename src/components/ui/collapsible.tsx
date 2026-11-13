import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleProps {
  label: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function Collapsible({ label, defaultOpen = false, className, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {label}
      </button>
      {open && (
        <div id={panelId} className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
