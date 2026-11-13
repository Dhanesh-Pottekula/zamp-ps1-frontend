import { CircleAlert, Info, OctagonX } from "lucide-react";
import type { FindingRow, Level } from "@/lib/api";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<Level, { row: string; icon: string; label: string }> = {
  block: { row: "border-red-200 bg-red-50 text-red-900", icon: "text-red-600", label: "Block" },
  warn: { row: "border-amber-200 bg-amber-50 text-amber-900", icon: "text-amber-600", label: "Warning" },
  info: { row: "border-slate-200 bg-slate-50 text-slate-700", icon: "text-slate-500", label: "Info" },
};

const LEVEL_ICON = { block: OctagonX, warn: CircleAlert, info: Info } as const;

export function FindingItem({ finding }: { finding: FindingRow }) {
  const style = LEVEL_STYLE[finding.level] ?? LEVEL_STYLE.info;
  const Icon = LEVEL_ICON[finding.level] ?? Info;

  return (
    <li className={cn("flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[13px] leading-snug", style.row)}>
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", style.icon)} aria-label={style.label} />
      <span className="min-w-0 flex-1">{finding.text || finding.code}</span>
      <code className="shrink-0 rounded bg-white/70 px-1 py-px font-mono text-[10px] text-slate-600 ring-1 ring-black/5">
        {finding.code}
      </code>
    </li>
  );
}

export function FindingList({ findings, className }: { findings: FindingRow[]; className?: string }) {
  if (findings.length === 0) return null;
  return (
    <ul className={cn("space-y-1", className)}>
      {findings.map((finding, index) => (
        <FindingItem key={`${finding.code}-${index}`} finding={finding} />
      ))}
    </ul>
  );
}
