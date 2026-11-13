import { Badge, type Tone } from "@/components/ui/badge";

const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "blue" },
  partially_invoiced: { label: "Partially invoiced", tone: "amber" },
  fully_invoiced: { label: "Fully invoiced", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "red" },
};

export function OrderStatusBadge({ status }: { status: string }) {
  const known = ORDER_STATUS[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={known.tone}>{known.label}</Badge>;
}
