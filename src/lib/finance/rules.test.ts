import assert from "node:assert/strict";
import test from "node:test";
import { labelAll, setByText } from "./label.ts";
import {
  applyLineCategory,
  applyMerchantRule,
  clearLineEdits,
  clearMerchantRule,
  ruleOf,
  undoCategoryAt,
  type CategoryBooks,
} from "./prefs.ts";
import { makeSplitEntry } from "./splits.ts";
import type { RawTxn } from "./types.ts";

function txn(id: string, date: string, amount = -50): RawTxn {
  return {
    id, accountId: "a", date, amount, direction: "out", pending: false, rawName: "TARGET 123",
    merchantName: "Target", description: "", plaidPrimary: null, plaidDetailed: null,
    plaidConfidence: null, kind: "bank", investType: null, ticker: null,
  };
}
const txns = [txn("new", "2026-10-14"), txn("old1", "2026-09-01"), txn("old2", "2026-08-01")];
function books(): CategoryBooks {
  return { merchantCategories: {}, txnCategories: {}, categoryUndos: [], txnSplits: {} };
}
function label(b: CategoryBooks) {
  return labelAll(txns, b.merchantCategories, b.txnCategories, b.txnSplits, { meta: b.ruleMeta, frozen: b.ruleFrozen });
}
const at = "2026-10-14T10:00:00Z";

test("legacy rules load as all and apply to every charge", () => {
  const b = { ...books(), merchantCategories: { target: "groceries" } };
  assert.equal(ruleOf(b, "target")?.scope, "all");
  assert.ok(label(b).every((row) => row.category === "groceries" && row.source === "you"));
  assert.match(setByText(label(b)[0]!), /merchant rule Target → Groceries · all charges/);
});

test("a forward rule keeps prior charges' categories and applies from its date", () => {
  const before = label(books());
  const frozen = Object.fromEntries(before.filter((r) => r.date < "2026-10-14").map((r) => [r.id, r.category]));
  const b = applyMerchantRule(books(), "target", "groceries", "Target", { scope: "forward", since: "2026-10-14", createdAt: at }, frozen);
  const rows = label(b);
  assert.equal(rows[0]?.category, "groceries");
  assert.equal(rows[0]?.source, "you");
  assert.equal(rows[1]?.category, before[1]?.category);
  assert.equal(rows[1]?.source, "kept");
  assert.match(setByText(rows[1]!), /kept from before your Target rule/);
});

test("all-scope rule recategorizes history; one-charge edits still win", () => {
  let b = applyLineCategory(books(), "old1", "household", "Target");
  b = applyMerchantRule(b, "target", "groceries", "Target", { scope: "all", since: null, createdAt: at });
  const rows = label(b);
  assert.equal(rows[1]?.category, "household");
  assert.equal(rows[1]?.source, "line");
  assert.equal(rows[2]?.category, "groceries");
  assert.ok(b.txnEditedAt?.old1);
});

test("split beats a this-charge edit which beats a kept snapshot and rule", () => {
  let b = applyMerchantRule(books(), "target", "groceries", "Target", { scope: "forward", since: "2026-10-14", createdAt: at }, { old1: "dining" });
  b = applyLineCategory(b, "old1", "household", "Target");
  b = { ...b, txnSplits: { old1: makeSplitEntry(txns[1]!, [{ category: "fuel", amount: 20 }, { category: "health", amount: 30 }]) } };
  assert.equal(label(b)[1]?.source, "split");
  const noSplit = { ...b, txnSplits: {} };
  assert.equal(label(noSplit)[1]?.source, "line");
  const noEdit = clearLineEdits(noSplit, ["old1"], "Target");
  assert.equal(label(noEdit)[1]?.category, "dining");
});

test("rule create, edit, delete and bulk clear can each be undone", () => {
  const created = applyMerchantRule(books(), "target", "groceries", "Target", { scope: "all", since: null, createdAt: at });
  const edited = applyMerchantRule(created, "target", "shopping", "Target", { scope: "forward", since: "2026-10-01", createdAt: at }, { old1: "dining" });
  const backToCreated = undoCategoryAt(edited, edited.categoryUndos.length - 1);
  assert.equal(backToCreated.merchantCategories.target, "groceries");
  assert.equal(backToCreated.ruleMeta?.target?.scope, "all");
  assert.equal(backToCreated.ruleFrozen?.target, undefined);
  const deleted = clearMerchantRule(edited, "target", "Target");
  assert.equal(deleted.merchantCategories.target, undefined);
  assert.equal(deleted.ruleFrozen?.target, undefined);
  const restored = undoCategoryAt(deleted, deleted.categoryUndos.length - 1);
  assert.equal(restored.ruleMeta?.target?.scope, "forward");
  assert.deepEqual(restored.ruleFrozen?.target, { old1: "dining" });
  const none = undoCategoryAt(created, created.categoryUndos.length - 1);
  assert.equal(none.merchantCategories.target, undefined);
  assert.equal(none.ruleMeta?.target, undefined);

  let e = applyLineCategory(books(), "old1", "household", "Target");
  e = applyLineCategory(e, "old2", "fuel", "Target");
  const cleared = clearLineEdits(e, ["old1", "old2"], "Target");
  assert.deepEqual(cleared.txnCategories, {});
  const back = undoCategoryAt(cleared, cleared.categoryUndos.length - 1);
  assert.deepEqual(back.txnCategories, { old1: "household", old2: "fuel" });
});
