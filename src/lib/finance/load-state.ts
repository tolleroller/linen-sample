import { useEffect, useState } from "react";
import type { FinanceFailure } from "./types";

export type LoadErrorState = { kind: "pending" | "error"; message: string; detail?: string };

/** Turn a failed load into a short message for the error card. */
export function classifyLoadError(result: FinanceFailure): LoadErrorState {
  if (result.pending) return { kind: "pending", message: "Loading your snapshot…" };
  return { kind: "error", message: result.errorMessage ?? "Something went wrong. Try again.", detail: result.errorMessage };
}

/**
 * While a load is pending, retry every few seconds and report "timed_out"
 * after about 30 seconds. With a baked snapshot this rarely triggers.
 */
export function useRefetchWhenReady(waiting: boolean, refetch: () => void): "waiting" | "timed_out" | "idle" {
  const [state, setState] = useState<"waiting" | "timed_out" | "idle">("idle");
  useEffect(() => {
    if (!waiting) {
      setState("idle");
      return;
    }
    setState("waiting");
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > 30_000) {
        setState("timed_out");
        clearInterval(timer);
        return;
      }
      refetch();
    }, 3000);
    return () => clearInterval(timer);
  }, [waiting, refetch]);
  return state;
}
