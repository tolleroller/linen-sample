import type { RawTxn } from "./types.ts";

/** One part of a split charge. `amount` is positive dollars. */
export type SplitPart = { category: string; amount: number };

/**
 * A split stored on the phone, keyed by transaction id. `total` and the
 * fingerprint fields are copied from the charge when saved, so a later amount
 * change can be spotted and an orphaned split can be matched to a new id.
 */
export type SplitEntry = {
  parts: SplitPart[];
  total: number;
  accountId: string;
  date: string;
  rawName: string;
};

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function partsCents(parts: SplitPart[]): number {
  return parts.reduce((sum, part) => sum + toCents(part.amount), 0);
}

/** True when a split has 2+ positive parts that add up to the charge, in cents. */
export function splitBalances(parts: SplitPart[], txnAmount: number): boolean {
  if (parts.length < 2) return false;
  if (parts.some((part) => !part.category || !(toCents(part.amount) > 0))) return false;
  return partsCents(parts) === toCents(Math.abs(txnAmount));
}

/** Cents still to assign (positive) or over-assigned (negative). */
export function splitRemainder(parts: SplitPart[], txnAmount: number): number {
  return toCents(Math.abs(txnAmount)) - partsCents(parts);
}

export function makeSplitEntry(txn: RawTxn, parts: SplitPart[]): SplitEntry {
  return {
    parts: parts.map((part) => ({ category: part.category, amount: toCents(part.amount) / 100 })),
    total: toCents(Math.abs(txn.amount)) / 100,
    accountId: txn.accountId,
    date: txn.date,
    rawName: txn.rawName,
  };
}

export type SplitOrphan = { id: string; entry: SplitEntry; match: RawTxn | null };

/**
 * Splits whose charge id is no longer in the snapshot (for example a pending
 * charge that posted under a new id). Offers a match on account, date, amount
 * and statement name when exactly one unsplit charge fits.
 */
export function findSplitOrphans(
  splits: Record<string, SplitEntry>,
  txns: RawTxn[],
): SplitOrphan[] {
  const ids = new Set(txns.map((txn) => txn.id));
  const orphans: SplitOrphan[] = [];
  for (const [id, entry] of Object.entries(splits)) {
    if (ids.has(id)) continue;
    const fits = txns.filter(
      (txn) =>
        !splits[txn.id] &&
        txn.accountId === entry.accountId &&
        txn.date === entry.date &&
        toCents(Math.abs(txn.amount)) === toCents(entry.total) &&
        txn.rawName.trim().toLowerCase() === entry.rawName.trim().toLowerCase(),
    );
    orphans.push({ id, entry, match: fits.length === 1 ? (fits[0] ?? null) : null });
  }
  return orphans;
}
