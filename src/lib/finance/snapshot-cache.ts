import type { FinanceResponse } from "./types.ts";

/** Last snapshot the phone showed. Separate from linen-prefs-v1. */
const KEY = "linen-snapshot-v1";

export function readSnapshotCache(): FinanceResponse | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FinanceResponse;
    if (!data || data.ok !== true || !Array.isArray(data.accounts) || !Array.isArray(data.transactions)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeSnapshotCache(data: FinanceResponse): void {
  if (!data.ok || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // A full snapshot can exceed a private-mode quota. The screen still updates.
  }
}

export function navigationIsReload(): boolean {
  if (typeof performance === "undefined") return false;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}
