import { Cpu, Disc3, Keyboard } from "lucide-react";
import type { RunMode } from "@/lib/api";
import { Badge, type Tone } from "@/components/ui/badge";

const MODES: Record<RunMode, { label: string; title: string; tone: Tone; icon: typeof Cpu }> = {
  live: { label: "Live model", title: "Documents are read by the model on every run", tone: "blue", icon: Cpu },
  recorded: { label: "Recorded extraction", title: "Extraction replays recorded model output for the sample files", tone: "outline", icon: Disc3 },
  manual: { label: "Manual entry", title: "The invoice fields were typed in by hand; no model was used", tone: "neutral", icon: Keyboard },
};

export function ModeBadge({ mode, model }: { mode: RunMode; model?: string | null }) {
  const { label, title, tone, icon: Icon } = MODES[mode] ?? MODES.live;
  return (
    <Badge tone={tone} title={title}>
      <Icon className="h-3 w-3" />
      {label}
      {model && <span className="font-mono text-[10px] font-normal opacity-80">{model}</span>}
    </Badge>
  );
}
