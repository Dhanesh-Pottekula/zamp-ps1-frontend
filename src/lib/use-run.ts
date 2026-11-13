import { useEffect, useState } from "react";
import { api, ApiError, subscribeRun, type DoneEvent, type RunDetail, type StepName, type StepRow } from "./api";

type StepMap = Partial<Record<StepName, StepRow>>;

const POLL_MS = 1500;

function toMap(steps: StepRow[]): StepMap {
  return Object.fromEntries(steps.map((step) => [step.name, step])) as StepMap;
}

export interface RunView {
  detail: RunDetail | null;
  steps: StepMap;
  done: DoneEvent | null;
  error: string | null;
  degraded: boolean;
}

export function useRun(id: string): RunView {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [steps, setSteps] = useState<StepMap>({});
  const [done, setDone] = useState<DoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let missing = false;

    setDetail(null);
    setSteps({});
    setDone(null);
    setError(null);
    setDegraded(false);

    const adopt = (run: RunDetail, authoritative: boolean) => {
      if (!active) return;
      setDetail(run);
      setError(null);
      if (authoritative) {
        if (run.steps.length > 0) setSteps(toMap(run.steps));
        return;
      }
      setSteps((current) => ({ ...toMap(run.steps), ...current }));
    };

    const load = async (authoritative: boolean): Promise<RunDetail | null> => {
      try {
        const run = await api.run(id);
        adopt(run, authoritative || run.status !== "running");
        return run;
      } catch (failure) {
        if (!active) return null;
        missing = failure instanceof ApiError && failure.status === 404;
        setError(missing ? "This run does not exist." : failure instanceof Error ? failure.message : "Could not load the run.");
        return null;
      }
    };

    const poll = async () => {
      const run = await load(true);
      if (!active || missing) return;
      if (run && run.status !== "running") {
        setDone({ status: run.status, outcome: run.outcome, summary: run.summary });
        return;
      }
      timer = window.setTimeout(() => void poll(), POLL_MS);
    };

    void load(false);

    const close = subscribeRun(id, {
      onStep: (step) => {
        if (active) setSteps((current) => ({ ...current, [step.name]: step }));
      },
      onDone: (event) => {
        if (!active) return;
        setDone(event);
        void load(true);
      },
      onError: () => {
        if (!active) return;
        setDegraded(true);
        void poll();
      },
    });

    return () => {
      active = false;
      close();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [id]);

  return { detail, steps, done, error, degraded };
}
