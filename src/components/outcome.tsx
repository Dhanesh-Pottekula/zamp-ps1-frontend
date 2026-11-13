import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import type { Outcome } from "@/lib/api";
import { OUTCOME_LABEL } from "@/lib/format";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  approved: "green",
  needs_attention: "amber",
  rejected: "red",
};

export const OUTCOME_ICON = {
  approved: CircleCheck,
  needs_attention: TriangleAlert,
  rejected: CircleX,
} as const;

export function OutcomeBadge({ outcome, className }: { outcome: Outcome | null | undefined; className?: string }) {
  if (!outcome) return <Badge tone="outline" className={className}>Pending</Badge>;
  const Icon = OUTCOME_ICON[outcome];
  return (
    <Badge tone={OUTCOME_TONE[outcome]} className={cn(className)}>
      <Icon className="h-3 w-3" />
      {OUTCOME_LABEL[outcome]}
    </Badge>
  );
}
