import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  House,
  Landmark,
  Receipt,
  RefreshCw,
  Search,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { classifyLoadError, useRefetchWhenReady } from "@/lib/finance/load-state";
import { loadFinance } from "@/lib/finance/load";
import {
  navigationIsReload,
  readSnapshotCache,
  writeSnapshotCache,
} from "@/lib/finance/snapshot-cache";
import {
  categorySpend,
  currentMonthKey,
  findRecurring,
  formatDay,
  formatMonth,
  categoryShare,
  isSpending,
  labelAll,
  setByText,
  spendingShare,
  touchesCategory,
  monthIncome,
  statementText,
  monthSpend,
  shiftMonth,
  todayIso,
  type LabeledTxn,
} from "@/lib/finance/label";
import {
  accountBucket,
  flowByMonth,
  limitsFromSpending,
  monthsForSpan,
  netWorthPath,
  openGain,
  quarterFlows,
  recentMonths,
  savingsRate,
  spanDays,
  valueOn,
  type RangeSpan,
} from "@/lib/finance/series";
import { categoryColor } from "@/lib/finance/colors";
import { compactMoney, formatSubtype, money, signedMoney } from "@/lib/finance/money";
import { useLinenPrefs, type CategoryUndo } from "@/lib/finance/prefs";
import {
  BUDGET_CATEGORIES,
  CATEGORIES,
  categoryName,
  type Account,
  type CategoryId,
  type FinanceSnapshot,
  type Holding,
} from "@/lib/finance/types";
import { CategoryMark } from "./marks";

type Tab = "home" | "activity";
type FlowFilter = "all" | "out" | "in" | "pending";

const TABS: Array<{ id: Tab; label: string; icon: typeof House; color: string }> = [
  { id: "home", label: "Home", icon: House, color: "#6b84ad" },
  { id: "activity", label: "Activity", icon: Receipt, color: "#df7a5e" },
];

function sumClass(accounts: Account[], klass: Account["class"]): number {
  return accounts
    .filter((account) => account.class === klass)
    .reduce((sum, account) => sum + account.currentBalance, 0);
}

function netWorth(accounts: Account[]): number {
  return (
    sumClass(accounts, "cash") +
    sumClass(accounts, "investment") -
    sumClass(accounts, "liability")
  );
}

const chartTip = {
  background: "#f4efe6",
  border: "1px solid #e4d9cc",
  borderRadius: 8,
  fontSize: 12,
  color: "#2c241c",
};

function axisTick(value: number): string {
  return compactMoney(value);
}

function spendColor(index: number): string {
  const palette = ["#6b84ad", "#3f9e9f", "#df7a5e", "#d1a75a", "#5fae7d", "#c98a9e", "#9488c4", "#cfc6b8"];
  return palette[index % palette.length] ?? palette[0];
}

function signedPercent(value: number): string {
  const pct = Math.abs(value * 100);
  const text = pct >= 10 ? pct.toFixed(0) : pct.toFixed(1);
  if (value > 0.0005) return `+${text}%`;
  if (value < -0.0005) return `−${text}%`;
  return "0%";
}

function toneFor(category: CategoryId): "spend" | "in" | "quiet" {
  if (category === "income") return "in";
  if (category === "transfer" || category === "investing") return "quiet";
  return "spend";
}

function sourceCopy(source: LabeledTxn["source"]): string {
  if (source === "split") return "You split this charge. Each part counts toward its own category.";
  if (source === "line") return "You changed this charge. It stays on this line.";
  if (source === "you") return "Using your rule for this merchant";
  if (source === "merchant") return "Labeled from the merchant name";
  return "Labeled from the bank category";
}

function banksDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function syncedLabel(iso: string | null): string {
  if (!iso) return "Waiting for a sync";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "Synced";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 2) return "Synced just now";
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `Synced ${hours}h ago`;
  return `Synced ${Math.round(hours / 24)}d ago`;
}

export function LinenApp() {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState<"hold" | "load">("hold");
  const query = useQuery({
    queryKey: ["linen-finance"],
    queryFn: async () => {
      const data = await loadFinance();
      writeSnapshotCache(data);
      return data;
    },
    // Opening the app shows the last snapshot saved on this phone.
    // Refresh, and a full browser reload, replace it from the server.
    enabled: pull === "load",
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  useEffect(() => {
    if (navigationIsReload()) {
      setPull("load");
      return;
    }
    const cached = readSnapshotCache();
    if (cached) {
      queryClient.setQueryData(["linen-finance"], cached);
      return;
    }
    setPull("load");
  }, [queryClient]);
  const waiting = query.data?.ok === false && query.data.pending === true;
  const connectorWait = useRefetchWhenReady(waiting, () => {
    void query.refetch();
  });
  const [tab, setTab] = useState<Tab>("home");
  const [refreshed, setRefreshed] = useState(false);
  const [month, setMonth] = useState(currentMonthKey);
  const hydrated = useLinenPrefs((state) => state.hydrated);
  const budgets = useLinenPrefs((state) => state.budgets);
  const merchantCategories = useLinenPrefs((state) => state.merchantCategories);
  const txnCategories = useLinenPrefs((state) => state.txnCategories);
  const txnSplits = useLinenPrefs((state) => state.txnSplits);
  const ruleMeta = useLinenPrefs((state) => state.ruleMeta);
  const ruleFrozen = useLinenPrefs((state) => state.ruleFrozen);
  const rememberNetWorth = useLinenPrefs((state) => state.rememberNetWorth);
  const setBudget = useLinenPrefs((state) => state.setBudget);
  const setBudgets = useLinenPrefs((state) => state.setBudgets);
  const budgetRevision = useLinenPrefs((state) => state.budgetRevision);
  const setBudgetRevision = useLinenPrefs((state) => state.setBudgetRevision);

  const snapshot: FinanceSnapshot | null = query.data?.ok ? query.data : null;
  const labeled = useMemo(
    () =>
      labelAll(
        snapshot?.transactions ?? [],
        hydrated ? merchantCategories : {},
        hydrated ? txnCategories : {},
        hydrated ? txnSplits : {},
        hydrated ? { meta: ruleMeta, frozen: ruleFrozen } : {},
      ),
    [snapshot, merchantCategories, txnCategories, txnSplits, ruleMeta, ruleFrozen, hydrated],
  );
  const accounts = snapshot?.accounts ?? [];
  const net = netWorth(accounts);

  useEffect(() => {
    if (!hydrated || !snapshot) return;
    rememberNetWorth(net, todayIso());
  }, [hydrated, snapshot, net, rememberNetWorth]);

  useEffect(() => {
    if (!hydrated || !snapshot) return;
    if (budgetRevision >= 4) return;
    setBudgets({
      housing: 1450,
      groceries: 420,
      subscriptions: 30,
      insurance: 120,
      fees: 20,
      shopping: 150,
      dining: 130,
      cigarettes: 0,
      entertainment: 30,
      services: 35,
      utilities: 160,
      health: 0,
      transport: 50,
      fuel: 90,
      other: 25,
      personal: 40,
    });
    setBudgetRevision(4);
  }, [hydrated, snapshot, budgetRevision, labeled, month, setBudgets, setBudgetRevision]);

  const failure =
    query.data && query.data.ok === false
      ? classifyLoadError(query.data)
      : null;

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <main
        className="mx-auto w-full max-w-lg px-5 pt-safe-top pb-safe-nav"
      >
        <header>
          <div
            className="h-40 overflow-hidden"
            style={{
              width: "100vw",
              marginLeft: "calc(50% - 50vw)",
              marginTop: "calc(-1.25rem - env(safe-area-inset-top))",
            }}
          >
            <img
              src="/header.png"
              alt="Liněn"
              className="block h-full w-full max-w-none origin-center scale-125 object-cover object-center"
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {snapshot ? syncedLabel(snapshot.syncedAt) : "Personal finance"}
            </p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink"
              aria-label="Refresh"
              onClick={() => {
                setRefreshed(true);
                setPull("load");
                void query.refetch();
              }}
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
              Refresh
            </button>
          </div>
          {snapshot?.banksSyncedAt ? (
            <p className="text-xs text-muted">Banks updated {banksDate(snapshot.banksSyncedAt)}</p>
          ) : null}
          {refreshed ? (
            <p className="mt-1 text-xs text-muted">
              {query.isFetching
                ? "Updating the saved snapshot…"
                : snapshot?.liveSources?.length
                  ? `${snapshot.liveSources.join(", ")} updated live. Banks stay as of the last sync. Budget limits and category edits on this phone stay put.`
                  : "Updated from the latest saved snapshot. Budget limits and category edits on this phone stay put."}
            </p>
          ) : null}
        </header>

        {snapshot?.connections.some((connection) => connection.status !== "active") ? (
          <p className="mt-4 rounded-lg border border-line bg-clay-soft px-4 py-3 text-sm text-clay">
            {snapshot.connections
              .filter((connection) => connection.status !== "active")
              .map((connection) => connection.institutionName)
              .join(", ")}{" "}
            needs a fresh sync.
          </p>
        ) : null}

        <div className="mt-6">
          {query.isPending && !query.data ? (
            <LoadingState />
          ) : snapshot ? (
            <>
            <Loaded
              tab={tab}
              month={month}
              setMonth={setMonth}
              snapshot={snapshot}
              labeled={labeled}
              budgets={hydrated ? budgets : {}}
              net={net}
              onBudget={setBudget}
              onSuggest={(next) => setBudgets({ ...budgets, ...next })}
              onTab={(next) => {
                setTab(next);
                window.scrollTo(0, 0);
              }}
            />
            </>
          ) : (
            <StatusState
              title={
                waiting
                  ? connectorWait === "timed_out"
                    ? "Still connecting"
                    : "Pulling your accounts"
                  : "Accounts are unavailable"
              }
              body={
                waiting
                  ? "Liněn is loading your snapshot. This usually takes a moment."
                  : failure?.message ??
                    "Check src/lib/finance/demo-snapshot.ts (or your own snapshot), then refresh."
              }
              onRetry={() => void query.refetch()}
            />
          )}
        </div>

        {snapshot && snapshot.warnings.length > 0 ? (
          <p className="mt-6 text-sm text-muted">{snapshot.warnings[0]}</p>
        ) : null}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper">
        <div className="mx-auto flex max-w-lg pb-[max(1rem,env(safe-area-inset-bottom))]">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs"
                style={{ color: active ? item.color : "#95897c" }}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setTab(item.id);
                  window.scrollTo(0, 0);
                }}
              >
                <Icon className="size-5" strokeWidth={active ? 2 : 1.75} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading accounts">
      <div className="h-28 animate-pulse rounded-xl bg-line" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-xl bg-line" />
        <div className="h-20 animate-pulse rounded-xl bg-line" />
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-line" />
    </div>
  );
}

function StatusState({
  title,
  body,
  onRetry,
}: {
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <section className="card p-4">
      <h1 className="font-display text-3xl leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-pretty text-muted">{body}</p>
      <button
        type="button"
        className="mt-4 min-h-11 rounded-sm bg-ink px-4 text-sm font-medium text-sheet"
        onClick={onRetry}
      >
        Try again
      </button>
    </section>
  );
}

function Loaded({
  tab,
  month,
  setMonth,
  snapshot,
  labeled,
  budgets,
  net,
  onBudget,
  onSuggest,
  onTab,
}: {
  onTab: (tab: Tab) => void;
  tab: Tab;
  month: string;
  setMonth: (month: string) => void;
  snapshot: FinanceSnapshot;
  labeled: LabeledTxn[];
  budgets: Record<string, number>;
  net: number;
  onBudget: (id: string, amount: number) => void;
  onSuggest: (budgets: Record<string, number>) => void;
}) {
  if (tab === "activity") {
    return (
      <Activity
        month={month}
        setMonth={setMonth}
        labeled={labeled}
        accounts={snapshot.accounts}
      />
    );
  }
  return (
    <Home
      month={month}
      setMonth={setMonth}
      labeled={labeled}
      accounts={snapshot.accounts}
      holdings={snapshot.holdings}
      extraSavings={snapshot.extraSavings}
      budgets={budgets}
      net={net}
      onGoals={() => onTab("home")}
    />
  );
}

function RangeSwitch({
  value,
  onChange,
  compact = false,
}: {
  value: RangeSpan;
  onChange: (value: RangeSpan) => void;
  compact?: boolean;
}) {
  const options: Array<[RangeSpan, string]> = [
    ["1m", "1M"],
    ["3m", "3M"],
    ["6m", "6M"],
    ["1y", "1Y"],
  ];
  return (
    <div className="flex gap-1">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`rounded-sm px-3 text-sm ${compact ? "min-h-8" : "min-h-11"} ${value === id ? "text-ink" : "text-faint"}`}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

const BANK_HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-10-12",
  "2026-11-11",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-10-11",
  "2027-11-11",
  "2027-11-25",
  "2027-12-24",
]);

function isoFromDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !BANK_HOLIDAYS.has(isoFromDate(date));
}

function precedingBusinessDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
  while (!isBusinessDay(date)) date.setDate(date.getDate() - 1);
  return isoFromDate(date);
}

function addBusinessDays(iso: string, count: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
  let left = count;
  while (left > 0) {
    date.setDate(date.getDate() + 1);
    if (isBusinessDay(date)) left -= 1;
  }
  return isoFromDate(date);
}

function monthsTouched(start: string, end: string): string[] {
  const months: string[] = [];
  let cursor = start.slice(0, 7);
  const last = end.slice(0, 7);
  while (cursor <= last) {
    months.push(cursor);
    const [year, month] = cursor.split("-").map(Number);
    const next = new Date(year ?? 2026, month ?? 1, 1);
    cursor = isoFromDate(next).slice(0, 7);
  }
  return months;
}

/** Your schedule: rent merchant, paycheck merchant. Edit to match your own data. */
const RENT_PATTERN = /\brent\b|apartments|property management/i;
const PAYCHECK_PATTERN = /payroll|paycheck|direct dep/i;

function paydaysInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (const month of monthsTouched(start, end)) {
    for (const day of [5, 20]) {
      const paid = precedingBusinessDay(`${month}-${String(day).padStart(2, "0")}`);
      if (paid >= start && paid <= end) dates.push(paid);
    }
  }
  return dates;
}

function rentClearDate(month: string): string {
  // Same rule the activities calendar uses: paid on the 3rd, clears two business days later.
  return addBusinessDays(`${month}-03`, 2);
}

function rentClearsInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  for (const month of monthsTouched(start, end)) {
    const clears = rentClearDate(month);
    if (clears >= start && clears <= end) dates.push(clears);
  }
  return dates;
}

function nextRentClear(fromIso: string): string {
  const month = fromIso.slice(0, 7);
  const clears = rentClearDate(month);
  if (clears >= fromIso) return clears;
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = isoFromDate(new Date(year ?? 2026, monthNumber ?? 1, 1)).slice(0, 7);
  return rentClearDate(nextMonth);
}

function Upcoming({ labeled }: { labeled: LabeledTxn[] }) {
  const today = todayIso();
  const [picked, setPicked] = useState<string | null>(null);
  const recurring = findRecurring(labeled)
    .filter((item) => item.nextDate >= today)
    .filter((item) => !RENT_PATTERN.test(item.merchant) && !PAYCHECK_PATTERN.test(item.merchant));
  const pays = labeled
    .filter((txn) => txn.category === "income" && txn.amount > 1500)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastPay = pays[pays.length - 1];
  const rents = labeled
    .filter((txn) => txn.amount < 0 && RENT_PATTERN.test(`${txn.merchant} ${txn.rawName}`))
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastRent = rents[rents.length - 1];
  const weekStart = (() => {
    const [year, month, day] = today.split("-").map(Number);
    const date = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
    date.setDate(date.getDate() - date.getDay());
    return isoFromDate(date);
  })();
  const days = Array.from({ length: 28 }, (_, index) => addDays(weekStart, index));
  const lastDay = days[days.length - 1] ?? today;
  const scheduled = [
    ...paydaysInRange(today, lastDay).map((date) => ({
      key: `pay-${date}`,
      name: "Paycheck",
      date,
      amount: lastPay?.amount ?? 0,
      income: true,
    })),
    ...rentClearsInRange(today, lastDay).map((date) => ({
      key: `rent-${date}`,
      name: "Rent",
      date,
      amount: lastRent ? -Math.abs(lastRent.amount) : 0,
      income: false,
    })),
  ];
  const events = [
    ...scheduled,
    ...recurring.map((item) => ({
      key: item.merchantKey,
      name: item.merchant,
      date: item.nextDate,
      amount: -Math.abs(item.amount),
      income: false,
    })),
  ]
    .filter((item) => item.date >= today && item.date <= lastDay)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const marks = new Set(events.map((item) => item.date));

  return (
    <section>
      <h2 className="section-title">Coming up</h2>
      <p className="mt-1 text-sm text-muted">
        {formatShort(days[0] ?? today)} – {formatShort(lastDay)}. Tap a day.
      </p>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="text-faint">
            {day}
          </span>
        ))}
        {days.map((iso) => {
          const date = new Date(`${iso}T12:00:00`);
          const marked = marks.has(iso);
          const active = picked === iso;
          const monthStart = date.getDate() === 1;
          return (
            <button
              key={iso}
              type="button"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setPicked((current) => (current === iso ? null : iso))}
              className="flex flex-col items-center gap-0.5"
            >
              <span className="h-3 text-[9px] uppercase leading-none text-faint">
                {monthStart ? date.toLocaleDateString("en-US", { month: "short" }) : ""}
              </span>
              <span
                className={`grid size-8 place-items-center rounded-full ${
                  active
                    ? "bg-ink font-semibold text-sheet"
                    : marked
                      ? "border-2 border-ink font-semibold text-ink"
                      : iso === today
                        ? "border border-line font-medium text-ink"
                        : "text-muted"
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      {events.length > 0 ? (
        <ul className="mt-3 divide-y divide-line">
          {events.map((item) => {
            const hot = picked === item.date;
            const dim = picked !== null && !hot;
            return (
              <li
                key={`${item.key}-${item.date}`}
                className={`flex items-baseline justify-between gap-3 py-2 ${hot ? "font-semibold" : ""} ${dim ? "opacity-35" : ""}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.name}</p>
                  <p className="text-xs text-muted">{formatShort(item.date)}</p>
                </div>
                <p className={`text-sm tabular-nums ${item.income ? "text-[#4a9268]" : "text-ink"}`}>
                  {item.income ? signedMoney(item.amount) : money(Math.abs(item.amount), 0)}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing due in these four weeks.</p>
      )}
    </section>
  );
}
function MonthBar({
  month,
  setMonth,
  compact = false,
}: {
  month: string;
  setMonth: (month: string) => void;
  compact?: boolean;
}) {
  const current = currentMonthKey();
  const earliest = shiftMonth(current, -4);
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className={`grid place-items-center rounded-sm text-ink disabled:text-faint ${compact ? "size-8" : "size-11"}`}
        aria-label="Previous month"
        disabled={month <= earliest}
        onClick={() => setMonth(shiftMonth(month, -1))}
      >
        <ChevronLeft className="size-5" strokeWidth={1.75} />
      </button>
      <p className="font-display text-xl text-ink">{formatMonth(month)}</p>
      <button
        type="button"
        className={`grid place-items-center rounded-sm text-ink disabled:text-faint ${compact ? "size-8" : "size-11"}`}
        aria-label="Next month"
        disabled={month >= current}
        onClick={() => setMonth(shiftMonth(month, 1))}
      >
        <ChevronRight className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function Home({
  month,
  setMonth,
  labeled,
  accounts,
  holdings,
  budgets,
  net,
  onGoals,
  extraSavings,
}: {
  month: string;
  setMonth: (month: string) => void;
  labeled: LabeledTxn[];
  accounts: Account[];
  holdings: Holding[];
  budgets: Record<string, number>;
  net: number;
  onGoals: () => void;
  extraSavings?: { emergencyFund: number } | null;
}) {
  const [selected, setSelected] = useState<LabeledTxn | null>(null);
  const [openBucket, setOpenBucket] = useState<string | null>(null);
  const [flowView, setFlowView] = useState<"month" | "quarter">("month");
  const cash = sumClass(accounts, "cash");
  const invested = sumClass(accounts, "investment");
  const debt = sumClass(accounts, "liability");
  const income = monthIncome(labeled, month);
  const spent = monthSpend(labeled, month);
  const months = recentMonths(month, 3);
  const flows = flowView === "quarter" ? quarterFlows(labeled, month) : flowByMonth(labeled, months);
  const quarterIncome = flows.reduce((sum, row) => sum + row.income, 0);
  const quarterSpend = flows.reduce((sum, row) => sum + row.spend, 0);
  const rate = savingsRate(quarterIncome, quarterSpend);
  const priorSpend = flows[flows.length - 2]?.spend ?? 0;
  const spendDelta = priorSpend > 0 ? (spent - priorSpend) / priorSpend : null;
  const summary = rollupAccounts(
    accounts.filter((account) => Math.abs(account.currentBalance) >= 0.5),
  );
  const book = openGain(holdings);
  const merchants = topMerchants(labeled, month).slice(0, 4);
  const today = todayIso();
  const recurring = findRecurring(labeled)
    .map((item) =>
      RENT_PATTERN.test(item.merchant)
        ? { ...item, nextDate: nextRentClear(today) }
        : item,
    )
    .slice(0, 4);
  const recent = labeled.filter((txn) => txn.date.startsWith(month)).slice(0, 6);
  const budgetTotal = Object.values(budgets).reduce((sum, value) => sum + value, 0);
  const spentAgainstBudget = BUDGET_CATEGORIES.reduce((sum, category) => {
    const limit = budgets[category.id] ?? 0;
    if (limit <= 0) return sum;
    return sum + Math.max(0, categorySpend(labeled, month, category.id));
  }, 0);

  return (
    <div className="linen-rise space-y-8">
      <section>
        <p className="text-sm text-muted">Net worth</p>
        <p className="font-display text-4xl leading-none tabular-nums tracking-tight">
          {money(net)}
        </p>
        <p className="mt-2 text-sm text-muted">
          {compactMoney(cash)} cash · {compactMoney(invested)} invested
          {debt > 0 ? ` · ${compactMoney(debt)} debt` : ""}
          {book ? (
            <>
              {" "}
              · brokerage open{" "}
              <span className={book.gain >= 0 ? "text-sage" : "text-clay"}>
                {signedMoney(book.gain)} ({signedPercent(book.percent)})
              </span>
            </>
          ) : null}
        </p>
      </section>
      <FullKitCard />

      <section>
        <h2 className="section-title">Accounts</h2>
        <p className="mt-1 text-sm text-muted">Tap a group to see the accounts inside it.</p>
        <div className="mt-2 divide-y divide-line">
          {summary.map((group) => {
            const open = openBucket === group.name;
            return (
              <div key={group.name}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenBucket(open ? null : group.name)}
                >
                  <span className="text-sm font-medium">{group.name}</span>
                  <span className="text-sm tabular-nums">{money(group.total, 0)}</span>
                </button>
                {open ? (
                  <ul className="pb-2">
                    {group.accounts.map((account) => {
                      const gain =
                        account.class === "investment" ? openGain(holdings, account.id) : null;
                      return (
                        <li
                          key={account.id}
                          className="flex items-baseline justify-between gap-3 py-1.5 pl-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm">{account.name}</p>
                            <p className="text-xs text-muted">
                              {account.institutionName}
                              {account.mask ? ` ···${account.mask}` : ""}
                            </p>
                            {gain ? (
                              <p
                                className={`text-xs tabular-nums ${gain.gain >= 0 ? "text-sage" : "text-clay"}`}
                              >
                                Open {signedMoney(gain.gain)} · {signedPercent(gain.percent)}
                              </p>
                            ) : null}
                          </div>
                          <p className="text-sm tabular-nums">{money(account.currentBalance, 0)}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">Income and spending</h2>
        <p className="mt-1 text-sm text-muted">
          {flowView === "quarter" ? "By quarter." : `${formatMonth(months[0] ?? month)} through ${formatMonth(month)}.`}
          Tap a bar for the amount. July and August include the old checking account.
          {rate !== null && rate >= 0 ? ` Saved ${Math.round(rate * 100)}% of income.` : ""}
          {rate !== null && rate < 0 ? " Spent more than the income that landed in these accounts." : ""}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-sage" /> Income
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-clay" /> Spending
            </span>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className={flowView === "month" ? "text-ink" : "text-faint"}
              onClick={() => setFlowView("month")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={flowView === "quarter" ? "text-ink" : "text-faint"}
              onClick={() => setFlowView("quarter")}
            >
              Quarterly
            </button>
          </div>
        </div>
        <div className="mt-2 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flows} barGap={4} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6e655c", fontSize: 12 }}
              />
              <YAxis
                width={48}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6e655c", fontSize: 11 }}
                tickFormatter={axisTick}
              />
              <Tooltip
                cursor={false}
                contentStyle={chartTip}
                formatter={(value, name) => [
                  money(Number(value), 0),
                  name === "income" ? "Income" : "Spending",
                ]}
              />
              <Bar dataKey="income" fill="#5fae7d" radius={[2, 2, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="spend" fill="#df7a5e" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <MonthBar month={month} setMonth={setMonth} />

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Money in" value={money(income, income >= 100 ? 0 : 2)} tone="in" />
        <Stat label="Money out" value={money(spent, spent >= 100 ? 0 : 2)} tone="out" />
      </section>
      {budgetTotal > 0 ? (
        <p className="text-sm text-muted">
          {money(Math.max(0, budgetTotal - spentAgainstBudget), 0)} left of{" "}
          {money(budgetTotal, 0)} budgeted. Transfers and investing stay out of spending.
        </p>
      ) : (
        <p className="text-sm text-muted">
          Transfers and investing stay out of spending. Set budgets to track what’s left.
        </p>
      )}

      {merchants.length > 0 ? (
        <section>
          <h2 className="section-title">Biggest charges</h2>
          <p className="mt-1 text-sm text-muted">Where the money went this month.</p>
          <ul className="mt-2 divide-y divide-line">
            {merchants.map((merchant) => (
              <li key={merchant.merchantKey} className="flex items-center gap-3 py-3">
                <CategoryMark category={merchant.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{merchant.merchant}</p>
                  <p className="text-xs text-muted">
                    {categoryName(merchant.category)} · {merchant.count}{" "}
                    {merchant.count === 1 ? "charge" : "charges"}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{money(merchant.total, 0)}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {recurring.length > 0 ? (
        <section>
          <h2 className="section-title">Recurring</h2>
          <p className="mt-1 text-sm text-muted">Charges that come back on a schedule.</p>
          <ul className="mt-2 divide-y divide-line">
            {recurring.map((item) => (
              <li key={item.merchantKey} className="flex items-center gap-3 py-3">
                <CategoryMark category={item.category} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.merchant}</p>
                  <p className="text-xs text-muted">
                    {item.cadence === "weekly" ? "Weekly" : "Monthly"} · next {formatShort(item.nextDate)}
                  </p>
                </div>
                <p className="text-sm tabular-nums">{money(item.monthly, 0)}/mo</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="section-title">Recent</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing posted this month yet.</p>
        ) : (
          <TxnList txns={recent} accounts={accounts} onOpen={setSelected} />
        )}
      </section>

      <TxnDialog
        txn={selected ? labeled.find((item) => item.id === selected.id) ?? selected : null}
        accounts={accounts}
        labeled={labeled}
        month={month}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function Activity({
  month,
  setMonth,
  labeled,
  accounts,
}: {
  month: string;
  setMonth: (month: string) => void;
  labeled: LabeledTxn[];
  accounts: Account[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FlowFilter>("all");
  const [selected, setSelected] = useState<LabeledTxn | null>(null);
  const searching = query.trim().length > 0;
  const needle = query.trim().toLowerCase();

  const filtered = labeled.filter((txn) => {
    if (!searching && !txn.date.startsWith(month)) return false;
    if (filter === "out" && txn.amount >= 0) return false;
    if (filter === "in" && txn.amount <= 0) return false;
    if (filter === "pending" && !txn.pending) return false;
    if (!needle) return true;
    return (
      txn.merchant.toLowerCase().includes(needle) ||
      txn.rawName.toLowerCase().includes(needle) ||
      categoryName(txn.category).toLowerCase().includes(needle) ||
      (txn.ticker ?? "").toLowerCase().includes(needle)
    );
  });

  const groups: Array<{ day: string; items: LabeledTxn[] }> = [];
  for (const txn of filtered) {
    const last = groups[groups.length - 1];
    if (!last || last.day !== txn.date) groups.push({ day: txn.date, items: [txn] });
    else last.items.push(txn);
  }

  return (
    <div className="space-y-4">
      {searching ? (
        <p className="text-sm text-muted">Searching the last four months</p>
      ) : (
        <>
          <Upcoming labeled={labeled} />
          <MonthBar month={month} setMonth={setMonth} />
        </>
      )}
      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-sheet px-3">
        <Search className="size-4 text-faint" strokeWidth={1.75} />
        <span className="sr-only">Search transactions</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Merchant, category, ticker"
          className="h-11 w-full bg-transparent outline-none placeholder:text-faint"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["out", "Out"],
            ["in", "In"],
            ["pending", "Pending"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-sm px-3 text-sm ${
              filter === id ? "bg-ink text-sheet" : "border border-line bg-sheet text-ink"
            }`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">No transactions match.</p>
      ) : (
        groups.map((group) => (
          <section key={group.day}>
            <h2 className="text-sm text-muted">{formatDay(group.day)}</h2>
            <TxnList txns={group.items} accounts={accounts} onOpen={setSelected} />
          </section>
        ))
      )}
      <TxnDialog
        txn={selected ? labeled.find((item) => item.id === selected.id) ?? selected : null}
        accounts={accounts}
        labeled={labeled}
        month={month}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function TxnDialog({
  txn,
  accounts,
  onClose,
}: {
  txn: LabeledTxn | null;
  accounts: Account[];
  labeled?: LabeledTxn[];
  month?: string;
  onClose: () => void;
}) {
  const account = accounts.find((item) => item.id === txn?.accountId);
  return (
    <Dialog.Root open={txn !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg rounded-lg border border-line bg-paper px-4 pt-4 pb-4 shadow-xl">
          {txn ? (
            <>
              <div className="flex items-start gap-3">
                <CategoryMark category={txn.category} tone={toneFor(txn.category)} />
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="font-display text-xl leading-tight">{txn.merchant}</Dialog.Title>
                  <p className="text-sm text-muted">{categoryName(txn.category)}</p>
                </div>
                <p className="text-lg tabular-nums">{signedMoney(txn.amount)}</p>
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-muted">Statement</dt><dd className="text-right">{txn.rawName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Date</dt><dd>{formatShort(txn.date)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">Account</dt><dd>{account ? `${account.institutionName} ···${account.mask}` : "—"}</dd></div>
              </dl>
              <p className="mt-3 rounded-md bg-[#f7efe8] px-3 py-2 text-xs text-[#8a7d6e]">
                Recategorizing, splitting a charge, and merchant rules are in the full Liněn kit.
              </p>
              <Dialog.Close className="mt-3 h-10 w-full rounded-sm bg-ink text-sm font-medium text-paper">Done</Dialog.Close>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FullKitCard() {
  return (
    <div className="rounded-[14px] border border-line bg-[#fffaf3] px-3.5 py-3 text-[13px]">
      <div className="text-[10px] uppercase tracking-wider text-faint">In the full kit</div>
      <p className="mt-1">Budgets, Goals with rings and coaching, Wealth, split transactions and merchant rules.</p>
    </div>
  );
}

function TxnList({
  txns,
  accounts,
  onOpen,
}: {
  txns: LabeledTxn[];
  accounts: Account[];
  onOpen: (txn: LabeledTxn) => void;
}) {
  return (
    <ul className="mt-2 divide-y divide-line overflow-hidden card">
      {txns.map((txn) => {
        const account = accounts.find((item) => item.id === txn.accountId);
        return (
          <li key={txn.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3 text-left"
              onClick={() => onOpen(txn)}
            >
              <CategoryMark category={txn.category} tone={toneFor(txn.category)} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{txn.merchant}</span>
                  {txn.splits ? (
                    <span className="shrink-0 rounded-sm bg-clay-soft px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-clay">
                      Split
                    </span>
                  ) : null}
                  {txn.splitIssue ? (
                    <span className="shrink-0 rounded-sm bg-gold/20 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-gold">
                      Check split
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted">
                  {txn.splits
                    ? txn.splits.map((part) => categoryName(part.category)).join(" + ")
                    : categoryName(txn.category)}
                  {txn.pending ? " · Pending" : ""}
                  {account ? ` · ${account.institutionName}` : ""}
                </p>
              </div>
              <p
                className={`text-sm tabular-nums ${
                  txn.amount > 0 ? "text-sage" : txn.amount < 0 ? "text-clay" : "text-muted"
                }`}
              >
                {signedMoney(txn.amount)}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function undoPhrase(entry: CategoryUndo): string {
  if (entry.kind === "bulk") return `Undo · restore ${Object.keys(entry.edits).length} cleared edit${Object.keys(entry.edits).length === 1 ? "" : "s"}`;
  if (entry.kind === "split") return entry.previous ? "Undo · back to the earlier split" : "Undo split";
  const back = entry.previous ? categoryName(entry.previous) : "the usual label";
  return entry.kind === "line" ? `Undo · back to ${back}` : `Undo merchant rule · back to ${back}`;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "in" | "out";
}) {
  return (
    <div className="card p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p
        className={`mt-1 font-display text-3xl tabular-nums tracking-tight ${
          tone === "in" ? "text-sage" : "text-clay"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function topMerchants(txns: LabeledTxn[], month: string) {
  const map = new Map<
    string,
    { merchant: string; merchantKey: string; total: number; count: number; category: CategoryId }
  >();
  for (const txn of txns) {
    if (!txn.date.startsWith(month) || !isSpending(txn)) continue;
    const current = map.get(txn.merchantKey) ?? {
      merchant: txn.merchant,
      merchantKey: txn.merchantKey,
      total: 0,
      count: 0,
      category: txn.category,
    };
    current.total += spendingShare(txn);
    current.count += 1;
    map.set(txn.merchantKey, current);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function combinedHoldings(holdings: Holding[]) {
  const map = new Map<
    string,
    { ticker: string; name: string; quantity: number; value: number; cost: number; pricedValue: number }
  >();
  for (const holding of holdings) {
    const current = map.get(holding.ticker) ?? {
      ticker: holding.ticker,
      name: holding.name,
      quantity: 0,
      value: 0,
      cost: 0,
      pricedValue: 0,
    };
    current.quantity += holding.quantity;
    current.value += holding.value;
    if (holding.costBasis && holding.costBasis > 0) {
      current.cost += holding.costBasis;
      current.pricedValue += holding.value;
    }
    map.set(holding.ticker, current);
  }
  return [...map.values()]
    .map((row) => {
      const gain = row.cost > 0 ? row.pricedValue - row.cost : null;
      const percent = gain !== null && row.cost > 0 ? gain / row.cost : null;
      return { ...row, gain, percent };
    })
    .sort((a, b) => b.value - a.value);
}

function suggestFromHistory(txns: LabeledTxn[], month: string): Record<string, number> {
  const previous = shiftMonth(month, -1);
  const source = txns.some((txn) => txn.date.startsWith(previous)) ? previous : month;
  const next: Record<string, number> = {};
  for (const category of BUDGET_CATEGORIES) {
    const spent = Math.max(0, categorySpend(txns, source, category.id));
    if (spent <= 0) continue;
    next[category.id] = Math.ceil(spent / 10) * 10;
  }
  return next;
}

function rollupAccounts(accounts: Account[]) {
  const order = ["Checking", "Savings", "Brokerage", "Credit", "Cash"];
  const map = new Map<string, Account[]>();
  for (const account of accounts) {
    const name =
      account.class === "investment"
        ? "Brokerage"
        : account.class === "liability"
          ? "Credit"
          : account.subtype === "savings"
            ? "Savings"
            : account.subtype === "checking"
              ? "Checking"
              : "Cash";
    const list = map.get(name) ?? [];
    list.push(account);
    map.set(name, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      accounts: list.sort((a, b) => b.currentBalance - a.currentBalance),
      total: list.reduce((sum, account) => sum + account.currentBalance, 0),
    }))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

function groupAccounts(accounts: Account[]) {
  const map = new Map<string, Account[]>();
  for (const account of accounts) {
    const list = map.get(account.institutionName) ?? [];
    list.push(account);
    map.set(account.institutionName, list);
  }
  return [...map.entries()]
    .map(([name, list]) => ({
      name,
      accounts: list.sort((a, b) => b.currentBalance - a.currentBalance),
      total: list.reduce((sum, account) => sum + account.currentBalance, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

function formatShort(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function shortName(name: string): string {
  const head = name.split(" - ")[0] ?? name;
  return head.length > 36 ? `${head.slice(0, 34)}…` : head;
}

function trimQuantity(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: value < 10 ? 2 : 0 });
}
