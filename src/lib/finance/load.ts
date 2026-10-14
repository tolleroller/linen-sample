import { createServerFn } from "@tanstack/react-start";
import type { FinanceResponse } from "./types.ts";

/**
 * Refresh and a full browser reload both call this server function. It
 * returns the baked snapshot in demo-snapshot.ts. To use your own data, write
 * a snapshot file in the same shape (see README) and import it here.
 */
export const loadFinance = createServerFn({ method: "POST" }).handler(
  async (): Promise<FinanceResponse> => {
    try {
      const { setResponseHeader } = await import("@tanstack/react-start/server");
      setResponseHeader("Cache-Control", "private, no-store");
    } catch {
      // Not in a request context (e.g. tests).
    }
    const { demoSnapshot } = await import("./demo-snapshot.ts");
    return { ...demoSnapshot, banksSyncedAt: demoSnapshot.syncedAt, liveSources: [] as string[] };
  },
);
