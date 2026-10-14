export type AccountClass = "cash" | "liability" | "investment";

export type Account = {
  id: string;
  connectionId: string;
  class: AccountClass;
  mask: string;
  name: string;
  officialName: string | null;
  subtype: string;
  currentBalance: number;
  availableBalance: number | null;
  currency: string;
  apr: number | null;
  nextPaymentDue: string | null;
  minimumPayment: number | null;
  institutionName: string;
};

export type RawTxn = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  direction: "in" | "out" | "zero";
  pending: boolean;
  rawName: string;
  merchantName: string | null;
  description: string;
  plaidPrimary: string | null;
  plaidDetailed: string | null;
  plaidConfidence: string | null;
  kind: "bank" | "card" | "invest";
  investType: string | null;
  ticker: string | null;
};

export type Holding = {
  id: string;
  accountId: string;
  ticker: string;
  name: string;
  securityType: string;
  quantity: number;
  costBasis: number | null;
  price: number | null;
  value: number;
  currency: string;
};

export type ConnectionHealth = {
  id: string;
  institutionName: string;
  status: string;
  updatedAt: string | null;
};

export type FinanceSnapshot = {
  ok: true;
  accounts: Account[];
  transactions: RawTxn[];
  holdings: Holding[];
  connections: ConnectionHealth[];
  syncedAt: string | null;
  warnings: string[];
  /** When the baked Plaid bank/card data was synced. */
  banksSyncedAt?: string | null;
  /** Sources merged live on this load, e.g. ["Public"]. */
  liveSources?: string[];
  /** Optional high-yield savings balances merged at build time (main, emergency fund). */
  extraSavings?: { main: number; emergencyFund: number; asOf: string };
};

export type FinanceFailure = {
  ok: false;
  data: null;
  pending?: boolean;
  loginRequired?: boolean;
  loginUrl?: string;
  errorMessage?: string;
};

export type FinanceResponse = FinanceSnapshot | FinanceFailure;

export const CATEGORIES = [
  { id: "groceries", name: "Groceries", budget: true },
  { id: "dining", name: "Dining", budget: true },
  { id: "transport", name: "Auto", budget: true },
  { id: "fuel", name: "Fuel", budget: true },
  { id: "cigarettes", name: "Cigarettes", budget: true },
  { id: "shopping", name: "Shopping", budget: true },
  { id: "subscriptions", name: "Software", budget: true },
  { id: "personal", name: "Personal care", budget: true },
  { id: "health", name: "Health", budget: true },
  { id: "housing", name: "Housing", budget: true },
  { id: "household", name: "Household", budget: true },
  { id: "utilities", name: "Utilities", budget: true },
  { id: "entertainment", name: "Entertainment", budget: true },
  { id: "travel", name: "Travel", budget: true },
  { id: "services", name: "Laundry", budget: true },
  { id: "insurance", name: "Insurance", budget: true },
  { id: "fees", name: "Fees", budget: true },
  { id: "other", name: "Other", budget: true },
  { id: "income", name: "Income", budget: false },
  { id: "transfer", name: "Transfer", budget: false },
  { id: "investing", name: "Investing", budget: false },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const BUDGET_CATEGORIES = CATEGORIES.filter((category) => category.budget);

export function categoryName(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.name ?? "Other";
}

export function isBudgetCategory(id: string): boolean {
  return BUDGET_CATEGORIES.some((category) => category.id === id);
}
