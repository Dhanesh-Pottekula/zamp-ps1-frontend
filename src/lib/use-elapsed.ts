import { useEffect, useState } from "react";

const SANE_MS = 24 * 60 * 60 * 1000;

/**
 * Milliseconds since `iso`, re-rendered on a timer while `active`.
 *
 * The run's own start time is used rather than the moment this tab first saw it, so the figure survives a reload
 * and the polling fallback. A browser clock far from the server's would make that nonsense, so an impossible
 * reading falls back to counting from when this hook started.
 */
export function useElapsed(iso: string | null | undefined, active: boolean, every = 200): number | null {
  const [now, setNow] = useState(() => Date.now());
  const [mounted] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(timer);
  }, [active, every, iso]);

  if (!iso) return null;
  const started = new Date(iso).getTime();
  if (Number.isNaN(started)) return null;
  const since = now - started;
  return since < 0 || since > SANE_MS ? now - mounted : since;
}
