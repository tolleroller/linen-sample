import {
  type CategoryId,
  type RawTxn,
  categoryName,
  isBudgetCategory,
} from "./types.ts";
import { splitBalances, type SplitEntry, type SplitPart } from "./splits.ts";

export type LabelSource = "split" | "line" | "kept" | "you" | "merchant" | "bank";

/** Scope info for merchant rules, keyed by merchant key. Missing means "all". */
export type RuleContext = {
  meta?: Record<string, { scope: "all" | "forward"; since: string | null }>;
  frozen?: Record<string, Record<string, string>>;
};

export type LabeledTxn = RawTxn & {
  merchant: string;
  merchantKey: string;
  category: CategoryId;
  source: LabelSource;
  /** Present when a valid split applies. Each part counts toward its own category. */
  splits?: SplitPart[];
  /** A saved split no longer adds up to this charge, so it is ignored. */
  splitIssue?: "amount-changed";
  /** The merchant rule that set ("you") or froze ("kept") this category. */
  rule?: { key: string; category: string; scope: "all" | "forward"; since: string | null };
};

function niceDay(iso: string | null): string {
  if (!iso) return "now";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Plain-English reason for a charge's category. */
export function setByText(txn: LabeledTxn): string {
  if (txn.source === "split") return "Set by: split";
  if (txn.source === "line") return "Set by: you, this charge only";
  if (txn.source === "kept" && txn.rule) {
    return `Set by: kept from before your ${txn.merchant} rule${txn.rule.since ? ` (${niceDay(txn.rule.since)})` : ""}`;
  }
  if (txn.source === "you" && txn.rule) {
    const reach = txn.rule.scope === "forward" ? ` · from ${niceDay(txn.rule.since)} on` : " · all charges";
    return `Set by: merchant rule ${txn.merchant} → ${categoryName(txn.rule.category)}${reach}`;
  }
  if (txn.source === "merchant") return "Set by: merchant name (default)";
  return "Set by: bank category (default)";
}

const DETAILED: Record<string, CategoryId> = {
  FOOD_AND_DRINK_GROCERIES: "groceries",
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "groceries",
  FOOD_AND_DRINK_RESTAURANT: "dining",
  FOOD_AND_DRINK_FAST_FOOD: "dining",
  FOOD_AND_DRINK_COFFEE: "dining",
  FOOD_AND_DRINK_VENDING: "dining",
  GENERAL_MERCHANDISE_SUPERSTORES: "shopping",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "shopping",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "shopping",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "shopping",
  GENERAL_MERCHANDISE_ELECTRONICS: "shopping",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "shopping",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "health",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "personal",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "services",
  TRANSPORTATION_GAS: "transport",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "transport",
  TRANSPORTATION_PUBLIC_TRANSIT: "transport",
  TRANSPORTATION_PARKING: "transport",
  TRANSPORTATION_TOLLS: "transport",
  RENT_AND_UTILITIES_RENT: "housing",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "housing",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "housing",
  RENT_AND_UTILITIES_TELEPHONE: "housing",
  RENT_AND_UTILITIES_WATER: "housing",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "housing",
  MEDICAL_PRIMARY_CARE: "health",
  MEDICAL_DENTAL_CARE: "health",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "health",
  MEDICAL_VETERINARY_SERVICES: "health",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "entertainment",
  ENTERTAINMENT_TV_AND_MOVIES: "entertainment",
  ENTERTAINMENT_VIDEO_GAMES: "entertainment",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "entertainment",
  GENERAL_SERVICES_INSURANCE: "housing",
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: "services",
  BANK_FEES_ATM: "fees",
  BANK_FEES_OVERDRAFT: "fees",
  BANK_FEES_FOREIGN_TRANSACTION: "fees",
  BANK_FEES_INSUFFICIENT_FUNDS: "fees",
  BANK_FEES_OTHER_BANK_FEES: "fees",
  INCOME_WAGES: "income",
  INCOME_DIVIDENDS: "income",
  INCOME_INTEREST_EARNED: "income",
  INCOME_RETIREMENT_PENSION: "income",
  RM_GROCERIES: "groceries",
  RM_DINING: "dining",
  RM_TRANSPORT: "transport",
  RM_SHOPPING: "shopping",
  RM_SOFTWARE: "subscriptions",
  RM_PERSONAL: "personal",
  RM_HEALTH: "health",
  RM_HOUSING: "housing",
  RM_UTILITIES: "utilities",
  RM_ENTERTAINMENT: "entertainment",
  RM_FEES: "fees",
  RM_OTHER: "other",
  RM_INCOME: "income",
  RM_TRANSFER: "transfer",
  RM_SERVICES: "services",
  RM_INSURANCE: "insurance",
  TRANSFER_IN_ACCOUNT_TRANSFER: "transfer",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "transfer",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "transfer",
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: "transfer",
  TRANSFER_IN_DEPOSIT: "transfer",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "transfer",
  TRAVEL_FLIGHTS: "travel",
  TRAVEL_LODGING: "travel",
  TRAVEL_RENTAL_CARS: "travel",
};

const PRIMARY: Record<string, CategoryId> = {
  INCOME: "income",
  TRANSFER_IN: "transfer",
  TRANSFER_OUT: "transfer",
  LOAN_PAYMENTS: "transfer",
  BANK_FEES: "fees",
  ENTERTAINMENT: "entertainment",
  FOOD_AND_DRINK: "dining",
  GENERAL_MERCHANDISE: "shopping",
  HOME_IMPROVEMENT: "housing",
  MEDICAL: "health",
  PERSONAL_CARE: "personal",
  GENERAL_SERVICES: "services",
  GOVERNMENT_AND_NON_PROFIT: "other",
  TRANSPORTATION: "transport",
  TRAVEL: "travel",
  RENT_AND_UTILITIES: "housing",
};

const GENERIC_MERCHANT =
  /^(dry cleaning|restaurant|payment|purchase|debit|merchandise|pos|service|services|general)$/i;

// Deterministic merchant names. No model call. Junk (locations, processor
// codes, reference text) is stripped first. A rule then matches the leftover
// text. Specific products are listed before a brand, and a brand prefix is
// only used when the leftover words are store or processor noise. "Amazon
// Prime" stays Amazon Prime. "Amazon Purchase" stays Amazon Purchase. A
// Prime Video charge is "Amazon Prime Video", not "Prime Video", "Amazon
// Prime", or "Amazon Purchase".
const NAME_RULES: Array<[RegExp, string]> = [
  [/^amazon prime video$/, "Amazon Prime Video"],
  [/^amazon prime(?: [a-z]{1,2})?$/, "Amazon Prime"],
  [/^amazon purchase$/, "Amazon Purchase"],
  [/^prime video channels$/, "Prime Video Channels"],
  [/^prime video(?: [a-z]{1,3})?$/, "Amazon Prime Video"],
  [/^amazon(?: [a-z]{1,2})?$/, "Amazon"],
  [/^amzn$/, "Amazon"],
  [/^uber eats$/, "Uber Eats"],
  [/^ubereats$/, "Uber Eats"],
  [/^uber one(?: mem| membership)?$/, "Uber One"],
  [/^uber$/, "Uber"],
  [/^lyft standard$/, "Lyft Standard"],
  [/^lyft priority$/, "Lyft Priority"],
  [/^lyft$/, "Lyft"],
  [/^youtube premium apple store subscriptions$/, "YouTube Premium - Apple Store Subscriptions"],
  [/^icloud apple store subscriptions$/, "iCloud - Apple Store Subscriptions"],
  [/^youtube premium$/, "YouTube Premium"],
  [/^icloud$/, "iCloud"],
  [/^apple$/, "Apple"],
  [/^grok(?: xai)?$/, "Grok"],
  [/^xai$/, "Grok"],
  [/^trader joe'?s?\b/, "Trader Joe's"],
  [/^t-?mobile\b/, "T-Mobile"],
  [/^tmobile\b/, "T-Mobile"],
  [/^wal-?mart\b/, "Walmart"],
  [/^target\b/, "Target"],
  [/^costco\b/, "Costco"],
  [/^shell\b/, "Shell"],
  [/^starbucks\b/, "Starbucks"],
  [/^cursor\b/, "Cursor"],
  [/^geico\b/, "GEICO"],
  [/^netflix\b/, "Netflix"],
  [/^spotify\b/, "Spotify"],
  [/^rocket money\b/, "Rocket Money"],
  [/^(?:the )?roku\b/, "Roku"],
  [/^venmo\b/, "Venmo"],
  [/^paypal\b/, "PayPal"],
  [/^doordash\b/, "DoorDash"],
  [/^adobe\b/, "Adobe"],
  [/^github\b/, "GitHub"],
  [/^(?:openai )?chatgpt\b/, "ChatGPT"],
  [/^schwab\b/, "Schwab"],
  [/^interactive brok/, "Interactive Brokers"],
  [/^starz\b/, "Starz"],
  [/^autodesk\b/, "Autodesk"],
  [/^microsoft store$/, "Microsoft Store"],
  [/^microsoft\b/, "Microsoft"],
  [/^public(?: com)?(?: tapx\b.*)?$/, "Public"],
  [/^charles schwab\b/, "Charles Schwab"],
  [/^discover cona\b/, "Discover"],
  [/^discover$/, "Discover"],
  [/^funds transfer to brokerage$/, "Funds Transfer to Brokerage"],
  [/^bal transfer from checking\b/, "Transfer From Checking"],
];

const STATES = new Set(
  "al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc".split(
    " ",
  ),
);

const PROCESSOR = new Set([
  "com",
  "www",
  "bill",
  "pos",
  "ach",
  "mktpl",
  "marketplace",
  "amzn",
  "http",
  "https",
  "pending",
  "recurring",
  "visa",
  "debit",
  "checkcard",
  "ppd",
  "web",
]);

function isJunkToken(token: string): boolean {
  const bare = token.replace(/'/g, "");
  if (!bare || !/[a-z0-9]/.test(bare)) return true;
  if (STATES.has(bare) || bare === "us" || bare === "usa") return true;
  if (PROCESSOR.has(bare)) return true;
  if (/^[\d-]+$/.test(bare) && bare.replace(/\D/g, "").length >= 2) return true;
  if (/[a-z]/.test(bare) && /\d/.test(bare)) return true;
  return false;
}

function meaningfulText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’]/g, "'")
    .replace(/\*+/g, " ")
    .replace(/[^a-z0-9'+-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !isJunkToken(token))
    .join(" ");
}

function labelMeaningful(text: string): string | null {
  if (!text) return null;
  for (const [pattern, name] of NAME_RULES) {
    if (pattern.test(text)) return name;
  }
  return null;
}

function statementRefinesBrand(brand: string | null, statement: string | null): boolean {
  if (brand !== "Amazon" || !statement) return false;
  return (
    statement === "Amazon Prime" ||
    statement === "Amazon Purchase" ||
    statement === "Amazon Prime Video" ||
    statement === "Prime Video Channels"
  );
}

const STRONG: Array<[RegExp, CategoryId]> = [
  [/dry clean|laundromat|laundry/, "services"],
  [
    /adobe|chatgpt|openai|\bgrok\b|\bxai\b|\bcursor\b|\bgithub\b|dropbox|google one|microsoft\s*365|apple\.com\/bill|\bgithub\b|rocket money/,
    "subscriptions",
  ],
  [
    /netflix|spotify|hulu|disney|youtube premium|prime video|audible|\bhbo\b|starz|icloud/,
    "entertainment",
  ],
  [/payroll|salary|\bwages?\b|direct dep/, "income"],
];

const BROAD: Array<[RegExp, CategoryId]> = [
  [
    /whole foods|trader joe|kroger|safeway|albertsons|winco|costco|fred meyer|grocery outlet|\bgrocery\b|\baldi\b|\bheb\b|sprouts/,
    "groceries",
  ],
  [
    /starbucks|doordash|grubhub|uber\s*eats|mcdonald|chipotle|restaurant|\bcoffee\b|\bcafe\b|taco bell|wendy/,
    "dining",
  ],
  [/chevron|\bshell\b|exxon|\bparking\b|\blyft\b|\buber\b|transit|sinclair/, "transport"],
  [/amazon|\btarget\b|walmart|best buy|\betsy\b|home depot|lowes/, "shopping"],
  [/atm fee|overdraft|service charge|foreign transaction/, "fees"],
  [/airlines?|\bhotel\b|airbnb|marriott|hilton/, "travel"],
];

/** Original bank words. Never the cleaned merchant label. */
export function statementText(txn: { rawName: string; description: string }): string {
  const name = txn.rawName.trim();
  const note = txn.description.trim();
  if (!name) return note;
  if (!note || name.toLowerCase().includes(note.toLowerCase())) return name;
  return `${name}\n${note}`;
}

export function merchantKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase())
    .replace(/\b(Of|And|The|A)\b/g, (word) => word.toLowerCase());
}

function fromStatement(rawName: string): string {
  let text = rawName.trim();
  const marked = text.match(/&@#(.+)$/);
  if (marked?.[1]) text = marked[1];
  text = text.replace(
    /^(debit purchase|pos purchase|pos|purchase|ach withdrawal|ach deposit|ach transfer|checkcard)\s+/i,
    "",
  );
  text = text.replace(/^\d{2,4}\s+\d{2,}[&@#\s]*/, "");
  text = text.replace(/\*+/g, " ");
  text = text.replace(/\s+(amzn\.com\/bill|amzn\.com).*$/i, "");
  text = text.replace(/\s+\d{2}\/\d{2}.*$/, "");
  text = text.replace(/\s+ach\s+transf.*$/i, "");
  text = text.replace(/\s+#\d+\b.*$/i, "");
  text = text.replace(/\s+t-\d+\b.*$/i, "");
  text = text.replace(/\s+\d{3}-\d{3}-\d{4}\b.*$/i, "");
  text = text.replace(/\s+\d{10,}\b.*$/i, "");
  text = text.replace(/\s+postpai(?:d)?\b.*$/i, "");
  text = text.replace(/\s+auto pay\b.*$/i, "");
  text = text.replace(/\s+[a-z]+\s+[a-z]{2}\s+us$/i, "");
  text = text.replace(/\s+[a-z]{2}\s+us$/i, "");
  text = text.replace(/\s+[a-z0-9.-]+\.(com|net|org)(\/\S*)?\s*$/i, "");
  // A trailing reference code contains a digit. Leave real words like Channels.
  text = text.replace(/\s+(?=\S*\d)[a-z0-9]{3,}$/i, "");
  return text.replace(/\s+/g, " ").trim();
}

export function cleanMerchant(
  rawName: string,
  merchantName: string | null,
  ticker: string | null,
): string {
  if (ticker) {
    const security = fromStatement(rawName);
    const short = security.split(" - ")[0]?.replace(/\s+Inc\.?$/i, "").trim();
    if (short && !/^(buy|sell|dividend|fee|cash|transfer)$/i.test(short)) {
      return short.length > 28 ? ticker : short;
    }
    return ticker;
  }

  const provided = merchantName?.trim() ?? "";
  const extracted = fromStatement(rawName);
  const providedText =
    provided && !GENERIC_MERCHANT.test(provided) ? meaningfulText(provided) : "";
  const statementText = meaningfulText(extracted);
  const providedLabel = labelMeaningful(providedText);
  const statementLabel = labelMeaningful(statementText);

  // A short bank brand must not hide a product the statement actually names.
  if (statementRefinesBrand(providedLabel, statementLabel) && statementLabel) {
    return statementLabel;
  }
  if (provided && !GENERIC_MERCHANT.test(provided)) {
    return providedLabel ?? titleCase(provided);
  }
  if (statementLabel) return statementLabel;
  const loose = statementText || meaningfulText(rawName);
  return titleCase(loose || "Unknown");
}

function bankCategory(txn: RawTxn): CategoryId | null {
  if (txn.plaidDetailed && DETAILED[txn.plaidDetailed]) {
    return DETAILED[txn.plaidDetailed];
  }
  if (txn.plaidPrimary && PRIMARY[txn.plaidPrimary]) {
    return PRIMARY[txn.plaidPrimary];
  }
  return null;
}

function matchRules(
  text: string,
  rules: Array<[RegExp, CategoryId]>,
): CategoryId | null {
  for (const [pattern, category] of rules) {
    if (pattern.test(text)) return category;
  }
  return null;
}

function investCategory(txn: RawTxn): CategoryId {
  const type = (txn.investType ?? "").toLowerCase();
  if (type === "dividend") return "income";
  if (type === "fee") return "fees";
  if (type === "transfer" || type === "cash") return "transfer";
  return "investing";
}

export function labelTransaction(
  txn: RawTxn,
  overrides: Record<string, string>,
  lineEdits: Record<string, string> = {},
  splits: Record<string, SplitEntry> = {},
  rules: RuleContext = {},
): LabeledTxn {
  const base = labelUnsplit(txn, overrides, lineEdits, rules);
  const entry = splits[txn.id];
  if (!entry) return base;
  const parts = entry.parts.filter((part) => isKnownCategory(part.category));
  if (parts.length !== entry.parts.length || !splitBalances(parts, txn.amount)) {
    return { ...base, splitIssue: "amount-changed" };
  }
  const lead = [...parts].sort((a, b) => b.amount - a.amount)[0];
  return {
    ...base,
    category: (lead?.category ?? base.category) as CategoryId,
    source: "split",
    splits: parts,
  };
}

function labelUnsplit(
  txn: RawTxn,
  overrides: Record<string, string>,
  lineEdits: Record<string, string>,
  rules: RuleContext = {},
): LabeledTxn {
  const merchant = cleanMerchant(
    txn.kind === "invest" && txn.ticker
      ? txn.rawName || txn.ticker
      : txn.rawName,
    txn.merchantName,
    txn.kind === "invest" ? txn.ticker : null,
  );
  const key = merchantKey(merchant);
  const line = lineEdits[txn.id];
  if (line && isKnownCategory(line)) {
    return { ...txn, merchant, merchantKey: key, category: line, source: "line" };
  }
  const override = overrides[key];
  const meta = rules.meta?.[key];
  const scope = meta?.scope ?? "all";
  const since = meta?.since ?? null;
  const kept = rules.frozen?.[key]?.[txn.id];
  if (override && kept && isKnownCategory(kept) && scope === "forward") {
    return {
      ...txn,
      merchant,
      merchantKey: key,
      category: kept,
      source: "kept",
      rule: { key, category: override, scope, since },
    };
  }
  const reaches = scope === "all" || !since || txn.date.slice(0, 10) >= since;
  if (override && isKnownCategory(override) && reaches) {
    return {
      ...txn,
      merchant,
      merchantKey: key,
      category: override,
      source: "you",
      rule: { key, category: override, scope, since },
    };
  }

  // Prime is its own merchant, so a phone rule stored under "amazon" cannot
  // rename it. Purchase and the Amazon store default to shopping. A bank code
  // (groceries included) must not win. A line edit, or a rule on this key, already won above.
  if (
    key === "amazon prime" ||
    key === "amazon prime video" ||
    key === "prime video" ||
    key === "prime video channels"
  ) {
    return { ...txn, merchant, merchantKey: key, category: "entertainment", source: "merchant" };
  }
  if (key === "amazon" || key === "amazon purchase") {
    return { ...txn, merchant, merchantKey: key, category: "shopping", source: "merchant" };
  }

  if (txn.kind === "invest") {
    return {
      ...txn,
      merchant,
      merchantKey: key,
      category: investCategory(txn),
      source: "bank",
    };
  }

  const haystack = `${merchant} ${txn.rawName} ${txn.description}`.toLowerCase();
  const pinned = matchRules(haystack, [
    [/geico|progressive|state farm/, "insurance"],
    [/dry clean|laundromat|laundry/, "services"],
    [/uber\s*\*?\s*one/, "dining"],
    [/power & light|electric|water utility|t-?mobile|verizon/, "utilities"],
    [/jiffy lube|take 5|car wash/, "transport"],
    [/\bshell\b/, "fuel"],
    [/tobacco|smoke shop/, "cigarettes"],
  ]);
  if (pinned) {
    return { ...txn, merchant, merchantKey: key, category: pinned, source: "merchant" };
  }
  if (/icloud|\bapple\b/.test(haystack) && Math.abs(txn.amount) > 0 && Math.abs(txn.amount) < 8) {
    return { ...txn, merchant, merchantKey: key, category: "subscriptions", source: "merchant" };
  }
  if (txn.plaidDetailed?.startsWith("RM_")) {
    const fromBank = bankCategory(txn);
    if (fromBank) {
      return { ...txn, merchant, merchantKey: key, category: fromBank, source: "bank" };
    }
  }
  const strong = matchRules(haystack, STRONG);
  if (strong) {
    return { ...txn, merchant, merchantKey: key, category: strong, source: "merchant" };
  }

  const trusted =
    txn.plaidConfidence === "VERY_HIGH" || txn.plaidConfidence === "HIGH";
  if (trusted) {
    const fromBank = bankCategory(txn);
    if (fromBank) {
      return {
        ...txn,
        merchant,
        merchantKey: key,
        category: fromBank,
        source: "bank",
      };
    }
  }

  const broad = matchRules(haystack, BROAD);
  if (broad) {
    return { ...txn, merchant, merchantKey: key, category: broad, source: "merchant" };
  }

  const fromBank = bankCategory(txn);
  return {
    ...txn,
    merchant,
    merchantKey: key,
    category: fromBank ?? "other",
    source: fromBank ? "bank" : "merchant",
  };
}

function isKnownCategory(id: string): id is CategoryId {
  return (
    id === "groceries" ||
    id === "dining" ||
    id === "transport" ||
    id === "fuel" ||
    id === "cigarettes" ||
    id === "shopping" ||
    id === "subscriptions" ||
    id === "personal" ||
    id === "health" ||
    id === "housing" ||
    id === "household" ||
    id === "utilities" ||
    id === "entertainment" ||
    id === "travel" ||
    id === "services" ||
    id === "insurance" ||
    id === "fees" ||
    id === "other" ||
    id === "income" ||
    id === "transfer" ||
    id === "investing"
  );
}

export function labelAll(
  txns: RawTxn[],
  overrides: Record<string, string>,
  lineEdits: Record<string, string> = {},
  splits: Record<string, SplitEntry> = {},
  rules: RuleContext = {},
): LabeledTxn[] {
  return txns.map((txn) => labelTransaction(txn, overrides, lineEdits, splits, rules));
}

export function isSpending(txn: LabeledTxn): boolean {
  if (txn.splits) return txn.amount < 0 && spendingShare(txn) > 0;
  return txn.amount < 0 && isBudgetCategory(txn.category);
}

/** Dollars of this charge that count as spending (all of it unless split). */
export function spendingShare(txn: LabeledTxn): number {
  if (!txn.splits) return isSpending(txn) ? Math.abs(txn.amount) : 0;
  if (txn.amount >= 0) return 0;
  return txn.splits
    .filter((part) => isBudgetCategory(part.category))
    .reduce((sum, part) => sum + part.amount, 0);
}

/** Signed amount this charge puts in one category (split parts counted separately). */
export function categoryShare(txn: LabeledTxn, category: string): number {
  if (!txn.splits) return txn.category === category ? txn.amount : 0;
  const sign = txn.amount < 0 ? -1 : 1;
  return txn.splits
    .filter((part) => part.category === category)
    .reduce((sum, part) => sum + sign * part.amount, 0);
}

export function touchesCategory(txn: LabeledTxn, category: string): boolean {
  if (!txn.splits) return txn.category === category;
  return txn.splits.some((part) => part.category === category);
}

export type Recurring = {
  merchant: string;
  merchantKey: string;
  category: CategoryId;
  cadence: "weekly" | "monthly";
  amount: number;
  monthly: number;
  lastDate: string;
  nextDate: string;
};

function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const ms = parseDay(to).getTime() - parseDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function todayIso(now = new Date()): string {
  return isoDay(now);
}

export function findRecurring(txns: LabeledTxn[], now = new Date()): Recurring[] {
  const today = todayIso(now);
  const groups = new Map<string, LabeledTxn[]>();
  for (const txn of txns) {
    if (!isSpending(txn) || txn.pending) continue;
    const list = groups.get(txn.merchantKey) ?? [];
    list.push(txn);
    groups.set(txn.merchantKey, list);
  }

  const found: Recurring[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((txn) => Math.abs(txn.amount)).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)] ?? 0;
    if (median < 1) continue;
    const close = sorted.filter(
      (txn) => Math.abs(Math.abs(txn.amount) - median) / median <= 0.18,
    );
    if (close.length < 2) continue;

    const gaps: number[] = [];
    for (let index = 1; index < sorted.length; index += 1) {
      gaps.push(daysBetween(sorted[index - 1].date, sorted[index].date));
    }
    const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    let cadence: Recurring["cadence"] | null = null;
    if (avg >= 5 && avg <= 10 && close.length >= 3) cadence = "weekly";
    else if (avg >= 20 && avg <= 45) cadence = "monthly";
    else if (close.length >= 2 && avg >= 20 && avg <= 75) cadence = "monthly";
    if (!cadence) continue;

    const last = sorted[sorted.length - 1];
    const since = daysBetween(last.date, today);
    if (cadence === "monthly" && since > 50) continue;
    if (cadence === "weekly" && since > 16) continue;

    const next = parseDay(last.date);
    next.setDate(next.getDate() + (cadence === "weekly" ? 7 : 30));
    found.push({
      merchant: last.merchant,
      merchantKey: key,
      category: last.category,
      cadence,
      amount: median,
      monthly: cadence === "weekly" ? median * 4.345 : median,
      lastDate: last.date,
      nextDate: isoDay(next),
    });
  }

  return found.sort((a, b) => b.monthly - a.monthly);
}

export function monthKeyFromDate(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatDay(iso: string): string {
  return parseDay(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function categorySpend(
  txns: LabeledTxn[],
  month: string,
  category: CategoryId,
): number {
  return txns.reduce((sum, txn) => {
    if (!txn.date.startsWith(month)) return sum;
    return sum + -categoryShare(txn, category);
  }, 0);
}

export function monthIncome(txns: LabeledTxn[], month: string): number {
  return txns.reduce((sum, txn) => {
    if (!txn.date.startsWith(month)) return sum;
    return sum + Math.max(0, categoryShare(txn, "income"));
  }, 0);
}

export function monthSpend(txns: LabeledTxn[], month: string): number {
  return txns.reduce((sum, txn) => {
    if (!txn.date.startsWith(month) || !isSpending(txn)) return sum;
    return sum + spendingShare(txn);
  }, 0);
}
