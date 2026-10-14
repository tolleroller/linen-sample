import {
  categorySpend,
  formatMonth,
  monthIncome,
  monthSpend,
  shiftMonth,
  type LabeledTxn,
} from "./label.ts";
import { BUDGET_CATEGORIES, type Account, type CategoryId, type Holding } from "./types.ts";

export function recentMonths(anchor: string, count = 3): string[] {
  return Array.from({ length: count }, (_, index) =>
    shiftMonth(anchor, index - (count - 1)),
  );
}

export function shortMonth(key: string): string {
  return formatMonth(key).replace(/\s+\d{4}$/, "").slice(0, 3);
}

export function flowByMonth(txns: LabeledTxn[], months: string[]) {
  return months.map((month) => ({
    month,
    label: shortMonth(month),
    income: Math.max(0, monthIncome(txns, month)),
    spend: Math.max(0, monthSpend(txns, month)),
  }));
}

export function savingsRate(income: number, spend: number): number | null {
  if (income <= 0) return null;
  return (income - spend) / income;
}

export type RangeSpan = "1m" | "3m" | "6m" | "1y";

export function spanDays(span: RangeSpan): number {
  if (span === "1m") return 31;
  if (span === "3m") return 92;
  if (span === "6m") return 183;
  return 366;
}

export function monthsForSpan(anchor: string, span: RangeSpan): string[] {
  const count = span === "1m" ? 1 : span === "3m" ? 3 : span === "6m" ? 6 : 12;
  return recentMonths(anchor, count);
}

export function limitsFromSpending(
  txns: LabeledTxn[],
  anchor: string,
  count: number,
): { limits: Record<string, number>; months: string[] } {
  const end = shiftMonth(anchor, -1);
  const candidates = recentMonths(end, count);
  const active = candidates.filter(
    (month) => monthSpend(txns, month) > 0 || monthIncome(txns, month) > 0,
  );
  const months = active.length > 0 ? active : [end];
  const limits: Record<string, number> = {};
  for (const category of BUDGET_CATEGORIES) {
    const total = months.reduce(
      (sum, month) => sum + Math.max(0, categorySpend(txns, month, category.id)),
      0,
    );
    const avg = total / months.length;
    if (avg < 1) continue;
    limits[category.id] = Math.max(1, Math.round(avg));
  }
  return { limits, months };
}

export function averageBudgets(txns: LabeledTxn[], anchor: string): Record<string, number> {
  const window = recentMonths(anchor, 3).filter(
    (month) => monthSpend(txns, month) > 200 || monthIncome(txns, month) > 500,
  );
  const months = window.length > 0 ? window : recentMonths(anchor, 3);
  const next: Record<string, number> = {};
  for (const category of BUDGET_CATEGORIES) {
    const total = months.reduce(
      (sum, month) => sum + Math.max(0, categorySpend(txns, month, category.id)),
      0,
    );
    const avg = total / months.length;
    if (avg < 1) continue;
    next[category.id] = Math.max(1, Math.round(avg));
  }
  return next;
}

export function quarterFlows(txns: LabeledTxn[], endMonth: string) {
  const buckets = new Map<string, { label: string; income: number; spend: number }>();
  for (const month of recentMonths(endMonth, 12)) {
    const [year, monthNumber] = month.split("-").map(Number);
    const quarter = Math.floor(((monthNumber ?? 1) - 1) / 3) + 1;
    const key = `${year}-Q${quarter}`;
    const current = buckets.get(key) ?? { label: `Q${quarter}`, income: 0, spend: 0 };
    current.income += Math.max(0, monthIncome(txns, month));
    current.spend += Math.max(0, monthSpend(txns, month));
    buckets.set(key, current);
  }
  return [...buckets.values()].filter((bucket) => bucket.income > 0 || bucket.spend > 20);
}

export type OpenGain = {
  gain: number;
  cost: number;
  percent: number;
};

export function openGain(holdings: Holding[], accountId?: string): OpenGain | null {
  let cost = 0;
  let priced = 0;
  for (const holding of holdings) {
    if (accountId && holding.accountId !== accountId) continue;
    if (!holding.costBasis || holding.costBasis <= 0) continue;
    cost += holding.costBasis;
    priced += holding.value;
  }
  if (cost <= 0) return null;
  const gain = priced - cost;
  return { gain, cost, percent: gain / cost };
}

export function netWorthPath(
  accounts: Account[],
  txns: LabeledTxn[],
  endDate: string,
  span: RangeSpan = "3m",
): Array<{ date: string; label: string; net: number }> {
  const cashIds = new Set(
    accounts.filter((account) => account.class === "cash").map((account) => account.id),
  );
  const cashNow = accounts
    .filter((account) => account.class === "cash")
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const invested = accounts
    .filter((account) => account.class === "investment")
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const debt = accounts
    .filter((account) => account.class === "liability")
    .reduce((sum, account) => sum + account.currentBalance, 0);
  const later = txns
    .filter((txn) => cashIds.has(txn.accountId))
    .map((txn) => ({ date: txn.date, amount: txn.amount }));

  const end = parseIso(endDate);
  const days = spanDays(span);
  const points: Array<{ date: string; label: string; net: number }> = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(end);
    date.setDate(end.getDate() - index);
    const iso = toIso(date);
    const after = later
      .filter((txn) => txn.date > iso)
      .reduce((sum, txn) => sum + txn.amount, 0);
    points.push({
      date: iso,
      label: axisLabel(date, span, index === 0 || index === days - 1),
      net: cashNow - after + invested - debt,
    });
  }
  return points;
}

function axisLabel(date: Date, span: RangeSpan, edge: boolean): string {
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  if (span === "1m") {
    if (edge || date.getDay() === 1) return `${date.getMonth() + 1}/${day}`;
    return "";
  }
  if (span === "3m") {
    if (day === 1 || day === 15) return `${month} ${day}`;
    return "";
  }
  if (day === 1) return month;
  return "";
}

export function accountBucket(account: Account): string {
  if (account.class === "investment") return "Brokerage";
  if (account.class === "liability") return "Credit";
  if (account.subtype === "savings") return "Savings";
  if (account.subtype === "checking") return "Checking";
  return "Cash";
}

export function valueOn(
  accounts: Account[],
  txns: LabeledTxn[],
  iso: string,
  bucket: string,
): number {
  const selected = accounts.filter((account) => {
    if (bucket === "Net worth") return true;
    if (bucket === "Cash") return account.class === "cash";
    return accountBucket(account) === bucket;
  });
  const ids = new Set(selected.map((account) => account.id));
  const now = selected.reduce((sum, account) => sum + account.currentBalance, 0);
  const after = txns
    .filter((txn) => ids.has(txn.accountId) && txn.date > iso)
    .reduce((sum, txn) => sum + txn.amount, 0);
  return now - after;
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
