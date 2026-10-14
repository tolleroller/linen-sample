import assert from "node:assert/strict";
import test from "node:test";
import { categorySpend, labelAll, monthSpend, type LabeledTxn } from "./label.ts";
import { applySplit, clearSplit, reattachSplit, undoCategoryAt, type CategoryBooks } from "./prefs.ts";
import { limitsFromSpending } from "./series.ts";
import { findSplitOrphans, makeSplitEntry, splitBalances, splitRemainder } from "./splits.ts";
import type { RawTxn } from "./types.ts";

function txn(over: Partial<RawTxn> = {}): RawTxn {
  return {
    id: "plaid-target-1",
    accountId: "acct-1",
    date: "2026-09-12",
    amount: -120,
    direction: "out",
    pending: false,
    rawName: "TARGET 00012345",
    merchantName: "Target",
    description: "",
    plaidPrimary: null,
    plaidDetailed: null,
    plaidConfidence: null,
    kind: "bank",
    investType: null,
    ticker: null,
    ...over,
  };
}
const parts = [
  { category: "groceries", amount: 80 },
  { category: "household", amount: 40 },
];
function books(): CategoryBooks {
  return { merchantCategories: { target: "shopping" }, txnCategories: {}, categoryUndos: [], txnSplits: {} };
}

test("splits must add up to the charge in cents", () => {
  assert.equal(splitBalances(parts, -120), true);
  assert.equal(splitBalances([{ category: "groceries", amount: 0.1 }, { category: "household", amount: 0.2 }], -0.3), true);
  assert.equal(splitBalances([{ category: "groceries", amount: 80 }, { category: "household", amount: 39.99 }], -120), false);
  assert.equal(splitBalances([{ category: "groceries", amount: 120 }], -120), false);
  assert.equal(splitBalances([{ category: "groceries", amount: 130 }, { category: "household", amount: -10 }], -120), false);
  assert.equal(splitRemainder([{ category: "groceries", amount: 80 }], -120), 4000);
});

test("a split beats a line edit and a merchant rule, and each part counts in its category", () => {
  const t = txn();
  const entry = makeSplitEntry(t, parts);
  const [row] = labelAll([t], { target: "shopping" }, { [t.id]: "dining" }, { [t.id]: entry }) as [LabeledTxn];
  assert.equal(row.source, "split");
  assert.deepEqual(row.splits, parts);
  assert.equal(categorySpend([row], "2026-09", "groceries"), 80);
  assert.equal(categorySpend([row], "2026-09", "household"), 40);
  assert.equal(categorySpend([row], "2026-09", "shopping"), 0);
  assert.equal(categorySpend([row], "2026-09", "dining"), 0);
  assert.equal(monthSpend([row], "2026-09"), 120);
  const { limits } = limitsFromSpending([row], "2026-10", 1);
  assert.equal(limits.groceries, 80);
  assert.equal(limits.household, 40);
  assert.equal(limits.shopping, undefined);
});

test("a line edit still beats a merchant rule when there is no split", () => {
  const t = txn();
  const [row] = labelAll([t], { target: "shopping" }, { [t.id]: "groceries" }, {});
  assert.equal(row?.source, "line");
  assert.equal(row?.category, "groceries");
});

test("a split whose charge amount changed is ignored and flagged", () => {
  const entry = makeSplitEntry(txn(), parts);
  const changed = txn({ amount: -125 });
  const [row] = labelAll([changed], { target: "shopping" }, {}, { [changed.id]: entry });
  assert.equal(row?.splitIssue, "amount-changed");
  assert.equal(row?.splits, undefined);
  assert.equal(row?.category, "shopping");
  assert.equal(categorySpend(row ? [row] : [], "2026-09", "shopping"), 125);
});

test("set, edit, clear and undo a split", () => {
  const t = txn();
  const first = applySplit(books(), t.id, makeSplitEntry(t, parts), "Target");
  assert.equal(first.txnSplits?.[t.id]?.parts.length, 2);
  const edited = applySplit(first, t.id, makeSplitEntry(t, [
    { category: "groceries", amount: 100 },
    { category: "household", amount: 20 },
  ]), "Target");
  const backToFirst = undoCategoryAt(edited, edited.categoryUndos.length - 1);
  assert.equal(backToFirst.txnSplits?.[t.id]?.parts[0]?.amount, 80);
  const cleared = clearSplit(first, t.id, "Target");
  assert.equal(cleared.txnSplits?.[t.id], undefined);
  const restored = undoCategoryAt(cleared, cleared.categoryUndos.length - 1);
  assert.equal(restored.txnSplits?.[t.id]?.total, 120);
  const none = undoCategoryAt(first, first.categoryUndos.length - 1);
  assert.equal(none.txnSplits?.[t.id], undefined);
  assert.equal(none.merchantCategories.target, "shopping");
});

test("a split survives a full snapshot replacement because it is keyed by id", () => {
  const t = txn();
  const stored = applySplit(books(), t.id, makeSplitEntry(t, parts), "Target");
  const freshSnapshot = [txn(), txn({ id: "plaid-other", rawName: "KROGER", amount: -10 })];
  const rows = labelAll(freshSnapshot, stored.merchantCategories, stored.txnCategories, stored.txnSplits);
  assert.equal(rows[0]?.source, "split");
  assert.equal(rows[1]?.splits, undefined);
});

test("orphaned splits are found and matched by account, date, amount and name", () => {
  const t = txn({ id: "plaid-pending-1", pending: true });
  const entry = makeSplitEntry(t, parts);
  const posted = txn({ id: "plaid-posted-1", rawName: "target 00012345" });
  const orphans = findSplitOrphans({ [t.id]: entry }, [posted, txn({ id: "x", amount: -50 })]);
  assert.equal(orphans.length, 1);
  assert.equal(orphans[0]?.match?.id, "plaid-posted-1");
  const ambiguous = findSplitOrphans({ [t.id]: entry }, [posted, txn({ id: "plaid-posted-2" })]);
  assert.equal(ambiguous[0]?.match, null);
  assert.deepEqual(findSplitOrphans({ [t.id]: entry }, [t]), []);
  const moved = reattachSplit(applySplit(books(), t.id, entry, "Target"), t.id, posted.id, entry);
  assert.equal(moved.txnSplits?.[t.id], undefined);
  assert.equal(moved.txnSplits?.[posted.id]?.total, 120);
});
