import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { api, ApiError, type OrderRow, type Outcome, type RunRow } from "@/lib/api";
import { money, OUTCOME_LABEL, runLabel, timestamp, toNumber, tokenTotal } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OUTCOME_ICON, OutcomeBadge } from "@/components/outcome";
import { ErrorNote } from "@/components/error-note";
import { OrderStatusBadge } from "@/components/order-status";
import { cn } from "@/lib/utils";

const REFRESH_MS = 4000;
const OUTCOMES: Outcome[] = ["approved", "needs_attention", "rejected"];
type Filter = Outcome | "all";

const TILE_STYLE: Record<Outcome, string> = {
  approved: "text-emerald-700",
  needs_attention: "text-amber-700",
  rejected: "text-red-700",
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [nextRuns, nextOrders] = await Promise.all([api.runs(), api.orders()]);
        if (!active) return;
        setRuns(nextRuns);
        setOrders(nextOrders);
        setError(null);
      } catch (failure) {
        if (active) setError(failure instanceof ApiError ? failure.message : "Could not load the dashboard.");
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const counts = useMemo(() => {
    const tally: Record<Outcome | "running", number> = { approved: 0, needs_attention: 0, rejected: 0, running: 0 };
    for (const run of runs ?? []) {
      if (run.outcome) tally[run.outcome] += 1;
      else if (run.status === "running") tally.running += 1;
    }
    return tally;
  }, [runs]);

  const visible = useMemo(() => {
    const sorted = [...(runs ?? [])].sort((left, right) => right.at.localeCompare(left.at));
    return filter === "all" ? sorted : sorted.filter((run) => run.outcome === filter);
  }, [runs, filter]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-600">Every processed invoice and the balance left on each purchase order. Refreshes automatically.</p>
      </div>

      <ErrorNote message={error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Total runs" value={runs?.length ?? null} active={filter === "all"} onClick={() => setFilter("all")} />
        {OUTCOMES.map((outcome) => {
          const Icon = OUTCOME_ICON[outcome];
          return (
            <Tile
              key={outcome}
              label={OUTCOME_LABEL[outcome]}
              value={runs ? counts[outcome] : null}
              icon={<Icon className={cn("h-4 w-4", TILE_STYLE[outcome])} />}
              valueClass={TILE_STYLE[outcome]}
              active={filter === outcome}
              onClick={() => setFilter(filter === outcome ? "all" : outcome)}
            />
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            {counts.running > 0 && (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <Loader2 className="h-3 w-3 animate-spin" />
                {counts.running} in progress
              </span>
            )}
            <label htmlFor="outcome-filter">Outcome</label>
            <select
              id="outcome-filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
              className="h-7 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-800"
            >
              <option value="all">All</option>
              {OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {OUTCOME_LABEL[outcome]}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        {runs === null && !error && <CardContent className="text-sm text-slate-500">Loading runs…</CardContent>}
        {runs !== null && visible.length === 0 && (
          <CardContent className="text-sm text-slate-500">
            {runs.length === 0 ? "No invoices processed yet. Start one from the Process page." : "No runs with this outcome."}
          </CardContent>
        )}
        {visible.length > 0 && (
          <Table className="text-[13px] min-[1200px]:table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="min-[1200px]:w-[150px]">Time</TableHead>
                <TableHead className="min-[1200px]:w-[110px]">File</TableHead>
                <TableHead className="min-[1200px]:w-[150px]">Vendor</TableHead>
                <TableHead className="min-[1200px]:w-[112px]">PO</TableHead>
                <TableHead className="min-[1200px]:w-[128px]">Invoice no.</TableHead>
                <TableHead className="text-right min-[1200px]:w-[104px]">Amount</TableHead>
                <TableHead className="min-[1200px]:w-[140px]">Outcome</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead className="text-right min-[1200px]:w-[68px]">Tokens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((run) => (
                <TableRow
                  key={run.id}
                  tabIndex={0}
                  onClick={() => navigate(`/runs/${run.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") navigate(`/runs/${run.id}`);
                  }}
                  className="cursor-pointer hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <TableCell className="num whitespace-nowrap text-slate-600">{timestamp(run.at)}</TableCell>
                  <TableCell className="max-w-40 truncate font-medium min-[1200px]:max-w-none" title={runLabel(run)}>
                    {runLabel(run)}
                  </TableCell>
                  <TableCell className="max-w-44 truncate min-[1200px]:max-w-none" title={run.vendor ?? undefined}>
                    {run.vendor ?? <Dash />}
                  </TableCell>
                  <TableCell className="truncate whitespace-nowrap font-mono text-[12px]">{run.po ?? <Dash />}</TableCell>
                  <TableCell className="truncate whitespace-nowrap font-mono text-[12px]" title={run.number ?? undefined}>{run.number ?? <Dash />}</TableCell>
                  <TableCell className="num whitespace-nowrap text-right">{money(run.amount, run.currency)}</TableCell>
                  <TableCell>
                    {run.status === "running" ? (
                      <Badge tone="blue">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Running
                      </Badge>
                    ) : run.status === "error" && !run.outcome ? (
                      <Badge tone="red">Error</Badge>
                    ) : (
                      <OutcomeBadge outcome={run.outcome} />
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    <div className="w-72 truncate min-[1200px]:w-auto" title={run.summary ?? undefined}>
                      {run.summary ?? <Dash />}
                    </div>
                  </TableCell>
                  <TableCell className="num whitespace-nowrap text-right text-slate-600">{tokenTotal(run.tokens)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PO balances</CardTitle>
          <span className="text-xs text-slate-500">Amounts before tax</span>
        </CardHeader>
        {orders === null && !error && <CardContent className="text-sm text-slate-500">Loading purchase orders…</CardContent>}
        {orders !== null && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Left</TableHead>
                <TableHead className="w-48">Consumed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <OrderItem key={order.po} order={order} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Dash() {
  return <span className="text-slate-400">—</span>;
}

interface TileProps {
  label: string;
  value: number | null;
  icon?: ReactNode;
  valueClass?: string;
  active: boolean;
  onClick: () => void;
}

function Tile({ label, value, icon, valueClass, active, onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg border bg-white px-4 py-3 text-left shadow-xs transition-colors hover:border-slate-400",
        active ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200",
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        {label}
        {icon}
      </div>
      <div className={cn("num mt-1 text-2xl font-semibold text-slate-900", valueClass)}>{value ?? "—"}</div>
    </button>
  );
}

function OrderItem({ order }: { order: OrderRow }) {
  const total = toNumber(order.total) ?? 0;
  const used = toNumber(order.used) ?? 0;
  const share = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const cancelled = order.status === "cancelled";

  return (
    <TableRow className={cn(cancelled && "text-slate-400")}>
      <TableCell className="whitespace-nowrap font-mono text-[12px]">{order.po}</TableCell>
      <TableCell className="max-w-56 truncate" title={order.vendor}>
        {order.vendor}
      </TableCell>
      <TableCell className="num whitespace-nowrap text-right">{money(order.total, order.currency)}</TableCell>
      <TableCell className="num whitespace-nowrap text-right">{money(order.used, order.currency)}</TableCell>
      <TableCell className={cn("num whitespace-nowrap text-right font-medium", (toNumber(order.left) ?? 0) < 0 && "text-red-700")}>
        {money(order.left, order.currency)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn("h-full rounded-full", cancelled ? "bg-slate-300" : share >= 100 ? "bg-slate-500" : share > 0 ? "bg-amber-500" : "bg-sky-500")}
              style={{ width: `${share}%` }}
            />
          </div>
          <span className="num w-9 text-right text-xs text-slate-500">{Math.round(share)}%</span>
        </div>
      </TableCell>
      <TableCell>
        <OrderStatusBadge status={order.status} />
      </TableCell>
    </TableRow>
  );
}
