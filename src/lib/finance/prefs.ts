import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SplitEntry } from "./splits.ts";

type Snapshot = { date: string; net: number };

/** How far a merchant rule reaches. Rules saved before scopes existed read as "all". */
export type RuleMeta = { scope: "all" | "forward"; since: string | null; createdAt: string | null };

export type MerchantRule = RuleMeta & { key: string; category: string };

export type RuleScope = { scope: "all" | "forward"; since: string | null; createdAt: string };

export type CategoryUndo =
  | { kind: "line"; id: string; previous: string | null; name: string }
  | {
      kind: "merchant";
      key: string;
      previous: string | null;
      name: string;
      previousMeta?: RuleMeta | null;
      previousFrozen?: Record<string, string> | null;
    }
  | { kind: "bulk"; edits: Record<string, string>; name: string }
  | { kind: "split"; id: string; previous: SplitEntry | null; name: string };

export type CategoryBooks = {
  merchantCategories: Record<string, string>;
  txnCategories: Record<string, string>;
  categoryUndos: CategoryUndo[];
  /** Split charges, keyed by transaction id. Optional so older saved prefs still load. */
  txnSplits?: Record<string, SplitEntry>;
  /** Scope for each merchant rule. Missing means "all" (legacy rules). */
  ruleMeta?: Record<string, RuleMeta>;
  /** Forward rules: categories prior charges showed when the rule was made, by merchant key then txn id. */
  ruleFrozen?: Record<string, Record<string, string>>;
  /** When each one-charge edit was made. */
  txnEditedAt?: Record<string, string>;
};

export function ruleOf(books: CategoryBooks, key: string): MerchantRule | null {
  const category = books.merchantCategories[key];
  if (!category) return null;
  const meta = books.ruleMeta?.[key];
  return {
    key,
    category,
    scope: meta?.scope ?? "all",
    since: meta?.since ?? null,
    createdAt: meta?.createdAt ?? null,
  };
}

/**
 * Create or replace a merchant rule with a scope. A forward rule records the
 * categories earlier charges showed (`frozen`) so they keep them. One undo entry.
 */
export function applyMerchantRule(
  books: CategoryBooks,
  key: string,
  category: string,
  name: string,
  scope: RuleScope,
  frozen: Record<string, string> = {},
): CategoryBooks {
  const previous = books.merchantCategories[key] ?? null;
  const previousMeta = books.ruleMeta?.[key] ?? null;
  const previousFrozen = books.ruleFrozen?.[key] ?? null;
  const ruleMeta = {
    ...(books.ruleMeta ?? {}),
    [key]: { scope: scope.scope, since: scope.scope === "forward" ? scope.since : null, createdAt: scope.createdAt },
  };
  const ruleFrozen = { ...(books.ruleFrozen ?? {}) };
  if (scope.scope === "forward") ruleFrozen[key] = { ...frozen };
  else delete ruleFrozen[key];
  return withUndo(
    {
      ...books,
      merchantCategories: { ...books.merchantCategories, [key]: category },
      ruleMeta,
      ruleFrozen,
    },
    { kind: "merchant", key, previous, name, previousMeta, previousFrozen },
  );
}

/** Remove several one-charge edits at once (e.g. when a rule now covers all charges). */
export function clearLineEdits(books: CategoryBooks, ids: string[], name: string): CategoryBooks {
  const edits: Record<string, string> = {};
  const txnCategories = { ...books.txnCategories };
  for (const id of ids) {
    const value = txnCategories[id];
    if (!value) continue;
    edits[id] = value;
    delete txnCategories[id];
  }
  if (Object.keys(edits).length === 0) return books;
  return withUndo({ ...books, txnCategories }, { kind: "bulk", edits, name });
}

const UNDO_CAP = 20;

function withUndo(books: CategoryBooks, entry: CategoryUndo): CategoryBooks {
  return {
    ...books,
    categoryUndos: [...books.categoryUndos, entry].slice(-UNDO_CAP),
  };
}

export function applyLineCategory(
  books: CategoryBooks,
  id: string,
  category: string,
  name: string,
): CategoryBooks {
  const previous = books.txnCategories[id] ?? null;
  if (previous === category) return books;
  return withUndo(
    {
      ...books,
      txnCategories: { ...books.txnCategories, [id]: category },
      txnEditedAt: { ...(books.txnEditedAt ?? {}), [id]: new Date().toISOString() },
    },
    { kind: "line", id, previous, name },
  );
}

export function applyMerchantCategory(
  books: CategoryBooks,
  key: string,
  category: string,
  name: string,
): CategoryBooks {
  const previous = books.merchantCategories[key] ?? null;
  if (previous === category) return books;
  return withUndo(
    {
      ...books,
      merchantCategories: { ...books.merchantCategories, [key]: category },
    },
    {
      kind: "merchant",
      key,
      previous,
      name,
      previousMeta: books.ruleMeta?.[key] ?? null,
      previousFrozen: books.ruleFrozen?.[key] ?? null,
    },
  );
}

export function clearLineCategory(books: CategoryBooks, id: string, name: string): CategoryBooks {
  const previous = books.txnCategories[id] ?? null;
  if (!previous) return books;
  const txnCategories = { ...books.txnCategories };
  delete txnCategories[id];
  return withUndo({ ...books, txnCategories }, { kind: "line", id, previous, name });
}

export function clearMerchantRule(books: CategoryBooks, key: string, name: string): CategoryBooks {
  const previous = books.merchantCategories[key] ?? null;
  if (!previous) return books;
  const merchantCategories = { ...books.merchantCategories };
  delete merchantCategories[key];
  const previousMeta = books.ruleMeta?.[key] ?? null;
  const previousFrozen = books.ruleFrozen?.[key] ?? null;
  const ruleMeta = { ...(books.ruleMeta ?? {}) };
  delete ruleMeta[key];
  const ruleFrozen = { ...(books.ruleFrozen ?? {}) };
  delete ruleFrozen[key];
  return withUndo(
    { ...books, merchantCategories, ruleMeta, ruleFrozen },
    { kind: "merchant", key, previous, name, previousMeta, previousFrozen },
  );
}

export function applySplit(
  books: CategoryBooks,
  id: string,
  entry: SplitEntry,
  name: string,
): CategoryBooks {
  const splits = books.txnSplits ?? {};
  const previous = splits[id] ?? null;
  return withUndo(
    { ...books, txnSplits: { ...splits, [id]: entry } },
    { kind: "split", id, previous, name },
  );
}

export function clearSplit(books: CategoryBooks, id: string, name: string): CategoryBooks {
  const splits = books.txnSplits ?? {};
  const previous = splits[id] ?? null;
  if (!previous) return books;
  const txnSplits = { ...splits };
  delete txnSplits[id];
  return withUndo({ ...books, txnSplits }, { kind: "split", id, previous, name });
}

/** Move a split from a vanished charge id to its new id. Not an undo entry. */
export function reattachSplit(
  books: CategoryBooks,
  fromId: string,
  toId: string,
  entry: SplitEntry,
): CategoryBooks {
  const txnSplits = { ...(books.txnSplits ?? {}) };
  delete txnSplits[fromId];
  txnSplits[toId] = entry;
  return { ...books, txnSplits };
}

export function undoCategoryAt(books: CategoryBooks, index: number): CategoryBooks {
  const entry = books.categoryUndos[index];
  if (!entry) return books;
  const categoryUndos = books.categoryUndos.filter((_, item) => item !== index);
  if (entry.kind === "split") {
    const txnSplits = { ...(books.txnSplits ?? {}) };
    if (entry.previous) txnSplits[entry.id] = entry.previous;
    else delete txnSplits[entry.id];
    return { ...books, txnSplits, categoryUndos };
  }
  if (entry.kind === "line") {
    const txnCategories = { ...books.txnCategories };
    if (entry.previous) txnCategories[entry.id] = entry.previous;
    else delete txnCategories[entry.id];
    return { ...books, txnCategories, categoryUndos };
  }
  if (entry.kind === "bulk") {
    return { ...books, txnCategories: { ...books.txnCategories, ...entry.edits }, categoryUndos };
  }
  const merchantCategories = { ...books.merchantCategories };
  if (entry.previous) merchantCategories[entry.key] = entry.previous;
  else delete merchantCategories[entry.key];
  const ruleMeta = { ...(books.ruleMeta ?? {}) };
  if (entry.previousMeta) ruleMeta[entry.key] = entry.previousMeta;
  else delete ruleMeta[entry.key];
  const ruleFrozen = { ...(books.ruleFrozen ?? {}) };
  if (entry.previousFrozen) ruleFrozen[entry.key] = entry.previousFrozen;
  else delete ruleFrozen[entry.key];
  return { ...books, merchantCategories, ruleMeta, ruleFrozen, categoryUndos };
}

function booksOf(state: CategoryBooks): CategoryBooks {
  return {
    merchantCategories: state.merchantCategories,
    txnCategories: state.txnCategories,
    categoryUndos: state.categoryUndos,
    txnSplits: state.txnSplits,
    ruleMeta: state.ruleMeta,
    ruleFrozen: state.ruleFrozen,
    txnEditedAt: state.txnEditedAt,
  };
}

type LinenPrefs = CategoryBooks & {
  txnSplits: Record<string, SplitEntry>;
  ruleMeta: Record<string, RuleMeta>;
  ruleFrozen: Record<string, Record<string, string>>;
  txnEditedAt: Record<string, string>;
  /** Goal targets the owner set on the phone (e.g. homestead). */
  goalTargets: Record<string, number>;
  /** Checked Goals next steps, keyed by "<report date>:<step id>". */
  goalSteps: Record<string, boolean>;
  setGoalTarget: (id: string, amount: number | null) => void;
  toggleGoalStep: (key: string) => void;
  setMerchantRule: (
    key: string,
    category: string,
    name: string,
    scope: RuleScope,
    frozen?: Record<string, string>,
  ) => void;
  clearLineEdits: (ids: string[], name: string) => void;
  setSplit: (id: string, entry: SplitEntry, name: string) => void;
  clearSplit: (id: string, name: string) => void;
  reattachSplit: (fromId: string, toId: string, entry: SplitEntry) => void;
  hydrated: boolean;
  budgets: Record<string, number>;
  budgetRevision: number;
  snapshots: Snapshot[];
  setHydrated: () => void;
  setBudget: (id: string, amount: number) => void;
  setBudgets: (budgets: Record<string, number>) => void;
  setBudgetRevision: (revision: number) => void;
  setMerchantCategory: (key: string, category: string, name: string) => void;
  clearMerchantCategory: (key: string, name: string) => void;
  setTxnCategory: (id: string, category: string, name: string) => void;
  clearTxnCategory: (id: string, name: string) => void;
  undoCategory: (index?: number) => void;
  rememberNetWorth: (net: number, date: string) => void;
};

export const useLinenPrefs = create<LinenPrefs>()(
  persist(
    (set, get) => ({
      hydrated: false,
      budgets: {},
      budgetRevision: 0,
      merchantCategories: {},
      txnCategories: {},
      categoryUndos: [],
      txnSplits: {},
      ruleMeta: {},
      ruleFrozen: {},
      txnEditedAt: {},
      goalTargets: {},
      goalSteps: {},
      snapshots: [],
      setHydrated: () => set({ hydrated: true }),
      setBudget: (id, amount) => {
        const next = Math.max(0, Math.round(amount));
        const budgets = { ...get().budgets };
        if (next <= 0) delete budgets[id];
        else budgets[id] = next;
        set({ budgets });
      },
      setBudgets: (budgets) => set({ budgets }),
      setBudgetRevision: (revision) => set({ budgetRevision: revision }),
      setMerchantCategory: (key, category, name) =>
        set(applyMerchantCategory(booksOf(get()), key, category, name)),
      clearMerchantCategory: (key, name) => set(clearMerchantRule(booksOf(get()), key, name)),
      setTxnCategory: (id, category, name) =>
        set(applyLineCategory(booksOf(get()), id, category, name)),
      clearTxnCategory: (id, name) => set(clearLineCategory(booksOf(get()), id, name)),
      setGoalTarget: (id, amount) => {
        const goalTargets = { ...get().goalTargets };
        if (amount && amount > 0) goalTargets[id] = Math.round(amount);
        else delete goalTargets[id];
        set({ goalTargets });
      },
      toggleGoalStep: (key) => {
        const goalSteps = { ...get().goalSteps };
        if (goalSteps[key]) delete goalSteps[key];
        else goalSteps[key] = true;
        set({ goalSteps });
      },
      setMerchantRule: (key, category, name, scope, frozen) =>
        set(applyMerchantRule(booksOf(get()), key, category, name, scope, frozen)),
      clearLineEdits: (ids, name) => set(clearLineEdits(booksOf(get()), ids, name)),
      setSplit: (id, entry, name) => set(applySplit(booksOf(get()), id, entry, name)),
      clearSplit: (id, name) => set(clearSplit(booksOf(get()), id, name)),
      reattachSplit: (fromId, toId, entry) =>
        set(reattachSplit(booksOf(get()), fromId, toId, entry)),
      undoCategory: (index) => {
        const current = booksOf(get());
        const at = index ?? current.categoryUndos.length - 1;
        set(undoCategoryAt(current, at));
      },
      rememberNetWorth: (net, date) => {
        const rounded = Math.round(net * 100) / 100;
        const existing = get().snapshots.find((point) => point.date === date);
        if (existing && existing.net === rounded) return;
        const prior = get().snapshots.filter((point) => point.date !== date);
        const snapshots = [...prior, { date, net: rounded }].slice(-120);
        set({ snapshots });
      },
    }),
    {
      name: "linen-prefs-v1",
      partialize: (state) => ({
        budgets: state.budgets,
        budgetRevision: state.budgetRevision,
        merchantCategories: state.merchantCategories,
        txnCategories: state.txnCategories,
        categoryUndos: state.categoryUndos,
        txnSplits: state.txnSplits,
        ruleMeta: state.ruleMeta,
        ruleFrozen: state.ruleFrozen,
        txnEditedAt: state.txnEditedAt,
        goalTargets: state.goalTargets,
        goalSteps: state.goalSteps,
        snapshots: state.snapshots,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
