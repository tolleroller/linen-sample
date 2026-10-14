import assert from "node:assert/strict";
import test from "node:test";
import { cleanMerchant, labelTransaction, statementText } from "./label.ts";
import type { RawTxn } from "./types.ts";

function txn(id: string): RawTxn {
  return {
    id,
    accountId: "a",
    date: "2026-09-01",
    amount: -10,
    direction: "out",
    pending: false,
    rawName: "AMAZON",
    merchantName: "Amazon",
    description: "",
    plaidPrimary: "GENERAL_MERCHANDISE",
    plaidDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
    plaidConfidence: "HIGH",
    kind: "card",
    investType: null,
    ticker: null,
  };
}

test("a hand edit changes only that transaction", () => {
  const edited = labelTransaction(txn("one"), {}, { one: "groceries" });
  const other = labelTransaction(txn("two"), {}, { one: "groceries" });
  assert.equal(edited.category, "groceries");
  assert.equal(edited.source, "line");
  assert.notEqual(other.category, "groceries");
  assert.notEqual(other.source, "line");
});

test("a hand edit wins over a later merchant rule", () => {
  const edited = labelTransaction(txn("one"), { amazon: "shopping" }, { one: "groceries" });
  const untouched = labelTransaction(txn("two"), { amazon: "shopping" }, { one: "groceries" });
  assert.equal(edited.category, "groceries");
  assert.equal(edited.source, "line");
  assert.equal(untouched.category, "shopping");
  assert.equal(untouched.source, "you");
});

test("amazon defaults to shopping even when the bank says groceries", () => {
  const labeled = labelTransaction(
    {
      ...txn("amazon-groceries"),
      plaidPrimary: null,
      plaidDetailed: "RM_GROCERIES",
      plaidConfidence: "VERY_HIGH",
    },
    {},
    {},
  );
  assert.equal(labeled.merchant, "Amazon");
  assert.equal(labeled.category, "shopping");
  assert.equal(labeled.source, "merchant");
});

test("a merchant rule still labels amazon", () => {
  const labeled = labelTransaction(txn("amazon-rule"), { amazon: "groceries" }, {});
  assert.equal(labeled.category, "groceries");
  assert.equal(labeled.source, "you");
});

test("amazon prime stays amazon prime and entertainment", () => {
  const labeled = labelTransaction(
    {
      ...txn("prime"),
      rawName: "DEBIT PURCHASE 0830 1911&@#AMAZON PRIME*5Q AMZN.COM/BILL WA US",
      merchantName: "Amazon",
      plaidPrimary: "GENERAL_MERCHANDISE",
      plaidDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
      plaidConfidence: "HIGH",
    },
    { amazon: "groceries" },
    {},
  );
  assert.equal(labeled.merchant, "Amazon Prime");
  assert.equal(labeled.merchantKey, "amazon prime");
  assert.equal(labeled.category, "entertainment");
  assert.notEqual(labeled.source, "you");
});

test("amazon purchase stays amazon purchase and shopping", () => {
  const labeled = labelTransaction(
    {
      ...txn("purchase"),
      rawName: "Amazon Purchase",
      merchantName: "Amazon Purchase",
      plaidPrimary: null,
      plaidDetailed: "RM_GROCERIES",
      plaidConfidence: "VERY_HIGH",
    },
    { amazon: "groceries" },
    {},
  );
  assert.equal(labeled.merchant, "Amazon Purchase");
  assert.equal(labeled.merchantKey, "amazon purchase");
  assert.equal(labeled.category, "shopping");
  assert.equal(labeled.source, "merchant");
});

test("a line edit can still mark one amazon purchase as groceries", () => {
  const labeled = labelTransaction(
    {
      ...txn("purchase-line"),
      rawName: "Amazon Purchase",
      merchantName: "Amazon Purchase",
    },
    {},
    { "purchase-line": "groceries" },
  );
  assert.equal(labeled.merchant, "Amazon Purchase");
  assert.equal(labeled.category, "groceries");
  assert.equal(labeled.source, "line");
});

test("a rule on the purchase key still wins", () => {
  const labeled = labelTransaction(
    {
      ...txn("purchase-rule"),
      rawName: "Amazon Purchase",
      merchantName: "Amazon Purchase",
    },
    { "amazon purchase": "groceries" },
    {},
  );
  assert.equal(labeled.category, "groceries");
  assert.equal(labeled.source, "you");
});

test("store amazon is not renamed amazon shopping or amazon purchase", () => {
  assert.equal(
    cleanMerchant(
      "DEBIT PURCHASE 0929 1911&@#AMAZON.COM*5X80 AMZN.COM/BILL",
      "Amazon",
      null,
    ),
    "Amazon",
  );
  assert.equal(
    cleanMerchant(
      "DEBIT PURCHASE 0929 1911&@#AMAZON MKTPL*51 AMZN.COM/BILL",
      null,
      null,
    ),
    "Amazon",
  );
});

test("other merchants keep a distinct name and drop statement junk", () => {
  assert.equal(
    cleanMerchant("APPLE.COM/BILL 866-712-7753", "Apple - App Store Subscriptions", null),
    "Apple - App Store Subscriptions",
  );
  assert.equal(
    cleanMerchant("DEBIT PURCHASE 0916 1911&@#UBER *EATS 866-576-1039 CA US", null, null),
    "Uber Eats",
  );
  assert.equal(
    cleanMerchant("DEBIT PURCHASE 0919 1911&@#TRADER JOE S #3 MERIDIAN ID US", null, null),
    "Trader Joe's",
  );
  assert.equal(cleanMerchant("LYFT *PRIORITY 07-28 LYFT.COM", null, null), "Lyft Priority");
  assert.equal(cleanMerchant("SHELL SERVICE STATION MERIDIAN", null, null), "Shell");
  assert.equal(
    cleanMerchant("DEBIT PURCHASE 0912 1911&@#PRIME VIDEO CHA AMZN.COM/BILL WA US", null, null),
    "Amazon Prime Video",
  );
});

test("prime video displays as amazon prime video and stays entertainment", () => {
  const labeled = labelTransaction(
    {
      ...txn("prime-video"),
      rawName: "DEBIT PURCHASE 0912 1911&@#PRIME VIDEO CHA AMZN.COM/BILL WA US",
      merchantName: null,
      plaidPrimary: null,
      plaidDetailed: "RM_ENTERTAINMENT",
      plaidConfidence: "VERY_HIGH",
    },
    { amazon: "groceries", "amazon prime": "shopping", "amazon purchase": "groceries" },
    {},
  );
  assert.equal(labeled.merchant, "Amazon Prime Video");
  assert.equal(labeled.merchantKey, "amazon prime video");
  assert.notEqual(labeled.merchant, "Amazon Prime");
  assert.notEqual(labeled.merchant, "Prime Video");
  assert.notEqual(labeled.merchant, "Amazon Purchase");
  assert.equal(labeled.category, "entertainment");
  assert.equal(labeled.source, "merchant");
});

test("october 1 amazon prime is the bank text, not prime video", () => {
  const raw = "Amazon Prime";
  const labeled = labelTransaction(
    {
      ...txn("oct-1"),
      date: "2026-10-01",
      rawName: raw,
      merchantName: "Amazon Prime",
      description: "",
      plaidPrimary: "GENERAL_MERCHANDISE",
      plaidDetailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
      plaidConfidence: "HIGH",
    },
    { amazon: "groceries", "amazon prime video": "shopping" },
    {},
  );
  assert.equal(labeled.merchant, "Amazon Prime");
  assert.equal(labeled.merchantKey, "amazon prime");
  assert.equal(labeled.category, "entertainment");
  assert.equal(statementText(labeled), raw);
});

test("a prime video row keeps the original statement under its label", () => {
  const raw = "DEBIT PURCHASE 0912 1911&@#PRIME VIDEO CHA AMZN.COM/BILL WA US";
  const labeled = labelTransaction(
    {
      ...txn("prime-video-statement"),
      rawName: raw,
      merchantName: "Amazon",
      description: "channel",
    },
    {},
    {},
  );
  assert.equal(labeled.merchant, "Amazon Prime Video");
  assert.equal(statementText(labeled).startsWith(raw), true);
  assert.equal(statementText(labeled).includes("channel"), true);
});
