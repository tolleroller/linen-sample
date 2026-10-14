import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLineCategory,
  applyMerchantCategory,
  clearLineCategory,
  clearMerchantRule,
  undoCategoryAt,
  type CategoryBooks,
} from "./prefs.ts";

function empty(): CategoryBooks {
  return { merchantCategories: { amazon: "shopping" }, txnCategories: {}, categoryUndos: [] };
}

test("a line change can be undone without touching the merchant rule", () => {
  const changed = applyLineCategory(empty(), "charge-1", "groceries", "Amazon");
  assert.equal(changed.txnCategories["charge-1"], "groceries");
  assert.equal(changed.merchantCategories.amazon, "shopping");
  const back = undoCategoryAt(changed, changed.categoryUndos.length - 1);
  assert.equal(back.txnCategories["charge-1"], undefined);
  assert.equal(back.merchantCategories.amazon, "shopping");
  assert.equal(back.categoryUndos.length, 0);
});

test("a merchant rule undo restores the previous rule only", () => {
  const changed = applyMerchantCategory(empty(), "amazon", "groceries", "Amazon");
  const back = undoCategoryAt(changed, 0);
  assert.equal(back.merchantCategories.amazon, "shopping");
  assert.deepEqual(back.txnCategories, {});
});

test("undo restores a removed merchant rule and a cleared line", () => {
  const clearedRule = clearMerchantRule(empty(), "amazon", "Amazon");
  assert.equal(clearedRule.merchantCategories.amazon, undefined);
  assert.equal(undoCategoryAt(clearedRule, 0).merchantCategories.amazon, "shopping");

  const withLine = applyLineCategory(empty(), "charge-1", "dining", "Amazon");
  const clearedLine = clearLineCategory(withLine, "charge-1", "Amazon");
  assert.equal(clearedLine.txnCategories["charge-1"], undefined);
  const restored = undoCategoryAt(clearedLine, clearedLine.categoryUndos.length - 1);
  assert.equal(restored.txnCategories["charge-1"], "dining");
});

test("the latest matching action undoes that step and leaves the earlier one", () => {
  let books = applyMerchantCategory(empty(), "amazon", "groceries", "Amazon");
  books = applyLineCategory(books, "charge-1", "dining", "Amazon");
  const lineIndex = books.categoryUndos.length - 1;
  books = undoCategoryAt(books, lineIndex);
  assert.equal(books.txnCategories["charge-1"], undefined);
  assert.equal(books.merchantCategories.amazon, "groceries");
  books = undoCategoryAt(books, books.categoryUndos.length - 1);
  assert.equal(books.merchantCategories.amazon, "shopping");
});

test("setting the same category does not add an undo", () => {
  const same = applyMerchantCategory(empty(), "amazon", "shopping", "Amazon");
  assert.equal(same.categoryUndos.length, 0);
});
