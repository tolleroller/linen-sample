// Generates src/lib/finance/demo-snapshot.ts: a fictional person ("Sam"),
// six months of believable transactions, four accounts, a small portfolio.
// Deterministic (seeded), so the demo and the tests stay stable.
//   node scripts/generate-demo.mjs [--today 2026-10-14]
import { writeFileSync } from "node:fs";

const arg = process.argv.indexOf("--today");
const TODAY = arg > 0 ? process.argv[arg + 1] : new Date().toISOString().slice(0, 10);
let seed = 20261014;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const amt = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;

const iso = (d) => d.toISOString().slice(0, 10);
const day = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const end = new Date(`${TODAY}T00:00:00Z`);
const start = new Date(end); start.setUTCMonth(start.getUTCMonth() - 5); start.setUTCDate(1);

const CONN = { bank: "demo-conn-northwind", card: "demo-conn-harbor", brk: "demo-conn-brightline" };
const accounts = [
  { id: "demo-checking", connectionId: CONN.bank, class: "cash", mask: "0101", name: "Everyday Checking", officialName: "Everyday Checking", subtype: "checking", currentBalance: 0, availableBalance: null, currency: "USD", apr: null, nextPaymentDue: null, minimumPayment: null, institutionName: "Northwind Bank" },
  { id: "demo-savings", connectionId: CONN.bank, class: "cash", mask: "0102", name: "High-Yield Savings", officialName: "High-Yield Savings", subtype: "savings", currentBalance: 0, availableBalance: null, currency: "USD", apr: null, nextPaymentDue: null, minimumPayment: null, institutionName: "Northwind Bank" },
  { id: "demo-card", connectionId: CONN.card, class: "liability", mask: "0303", name: "Harbor Rewards Card", officialName: "Harbor Rewards Visa", subtype: "credit card", currentBalance: 0, availableBalance: null, currency: "USD", apr: 21.99, nextPaymentDue: null, minimumPayment: 35, institutionName: "Harbor Card" },
  { id: "demo-brokerage", connectionId: CONN.brk, class: "investment", mask: "0505", name: "Individual Brokerage", officialName: "Individual Brokerage", subtype: "brokerage", currentBalance: 0, availableBalance: null, currency: "USD", apr: null, nextPaymentDue: null, minimumPayment: null, institutionName: "Brightline Invest" },
];

const txns = [];
let n = 0;
function add(accountId, date, amount, rawName, merchantName, primary, detailed, kind = "bank") {
  if (date > TODAY) return;
  txns.push({ id: `demo-${String(++n).padStart(4, "0")}`, accountId, date, amount, direction: amount > 0 ? "in" : amount < 0 ? "out" : "zero", pending: false, rawName, merchantName, description: "", plaidPrimary: primary, plaidDetailed: detailed, plaidConfidence: "HIGH", kind, investType: null, ticker: null });
}
const bizBefore = (d) => { while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1); return d; };

for (let m = new Date(start); m <= end; m.setUTCMonth(m.getUTCMonth() + 1)) {
  const y = m.getUTCFullYear(), mo = m.getUTCMonth() + 1;
  const D = (d) => iso(day(y, mo, d));
  for (const d of [5, 20]) add("demo-checking", iso(bizBefore(day(y, mo, d))), 2140.0, "ACME DESIGN CO PAYROLL", "Acme Design Co", "INCOME", "INCOME_WAGES");
  add("demo-checking", D(3), -1450.0, "MAPLE COURT APARTMENTS RENT", "Maple Court Apartments", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT");
  add("demo-checking", D(12), -amt(58, 92), "CITY POWER & LIGHT", "City Power & Light", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY");
  add("demo-card", D(18), -65.0, "VERIZON WIRELESS", "Verizon", "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_TELEPHONE");
  add("demo-card", D(9), -118.0, "PROGRESSIVE INSURANCE", "Progressive", "LOAN_PAYMENTS", "GENERAL_SERVICES_INSURANCE");
  add("demo-card", D(14), -15.49, "NETFLIX.COM", "Netflix", "ENTERTAINMENT", "ENTERTAINMENT_TV_AND_MOVIES");
  add("demo-card", D(22), -11.99, "SPOTIFY USA", "Spotify", "ENTERTAINMENT", "ENTERTAINMENT_MUSIC_AND_AUDIO");
  add("demo-card", D(2), -4.0, "GITHUB INC", "GitHub", "GENERAL_SERVICES", "GENERAL_SERVICES_OTHER_GENERAL_SERVICES");
  add("demo-card", D(16), -20.0, "OPENAI CHATGPT", "ChatGPT", "GENERAL_SERVICES", "GENERAL_SERVICES_OTHER_GENERAL_SERVICES");
  add("demo-checking", D(21), -400.0, "TRANSFER TO SAVINGS 0102", null, "TRANSFER_OUT", "TRANSFER_OUT_SAVINGS");
  add("demo-savings", D(21), 400.0, "TRANSFER FROM CHECKING 0101", null, "TRANSFER_IN", "TRANSFER_IN_ACCOUNT_TRANSFER");
  add("demo-checking", D(25), -300.0, "BRIGHTLINE INVEST DEPOSIT", null, "TRANSFER_OUT", "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS");
  add("demo-checking", D(26), -amt(380, 620), "HARBOR CARD PAYMENT", null, "LOAN_PAYMENTS", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT");
  for (const w of [1, 8, 15, 22, 29]) {
    const d = Math.min(w + Math.floor(rand() * 3), 28);
    add("demo-card", D(d), -amt(64, 118), pick(["TRADER JOE'S #512", "KROGER #0331", "WALMART SUPERCENTER #2214", "COSTCO WHSE #0417"]), null, "FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES");
    if (rand() < 0.8) add("demo-card", D(Math.min(d + 2, 28)), -amt(5.5, 7.5), "STARBUCKS STORE 1182", "Starbucks", "FOOD_AND_DRINK", "FOOD_AND_DRINK_COFFEE");
    if (rand() < 0.6) add("demo-card", D(Math.min(d + 3, 28)), -amt(14, 42), pick(["CHIPOTLE 2291", "PANERA BREAD #6021", "DOORDASH*CHIPOTLE", "UBER *EATS"]), null, "FOOD_AND_DRINK", "FOOD_AND_DRINK_RESTAURANT");
    if (rand() < 0.5) add("demo-card", D(Math.min(d + 1, 28)), -amt(32, 48), pick(["SHELL OIL 57442", "CHEVRON 0093127"]), null, "TRANSPORTATION", "TRANSPORTATION_GAS");
  }
  add("demo-card", D(11), -amt(25, 140), pick(["TARGET T-1450", "AMAZON MKTPL*2K4"]), null, "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE");
  add("demo-card", D(24), -amt(15, 90), "AMAZON MKTPL*7Q1", null, "GENERAL_MERCHANDISE", "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES");
  add("demo-card", D(7), -amt(22, 38), "UBER *TRIP", "Uber", "TRANSPORTATION", "TRANSPORTATION_TAXIS_AND_RIDE_SHARES");
  if (mo % 3 === 0) add("demo-card", D(13), -amt(30, 160), "THE HOME DEPOT #4410", "The Home Depot", "HOME_IMPROVEMENT", "HOME_IMPROVEMENT_HARDWARE");
  add("demo-card", D(6), -2.99, "APPLE.COM/BILL", "Apple", "ENTERTAINMENT", "ENTERTAINMENT_OTHER_ENTERTAINMENT");
  if (mo % 2 === 0) add("demo-card", D(19), -amt(28, 45), "GREAT CLIPS #88", "Great Clips", "PERSONAL_CARE", "PERSONAL_CARE_HAIR_AND_BEAUTY");
  add("demo-savings", D(28), Math.round(amt(9, 12) * 100) / 100, "INTEREST PAYMENT", null, "INCOME", "INCOME_INTEREST_EARNED");
}
txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const holdings = [
  ["VTI", "Vanguard Total Stock Market ETF", "etf", 18, 248.2, 292.4],
  ["VXUS", "Vanguard Total International Stock ETF", "etf", 30, 58.1, 66.3],
  ["BND", "Vanguard Total Bond Market ETF", "etf", 15, 72.4, 73.1],
  ["AAPL", "Apple Inc.", "equity", 6, 182.5, 228.9],
].map(([ticker, name, securityType, quantity, cost, price], i) => ({ id: `demo-h${i + 1}`, accountId: "demo-brokerage", ticker, name, securityType, quantity, costBasis: Math.round(quantity * cost * 100) / 100, price, value: Math.round(quantity * price * 100) / 100, currency: "USD" }));

const bal = { "demo-checking": 2384.17, "demo-savings": 9620.0, "demo-card": 412.36, "demo-brokerage": holdings.reduce((s, h) => s + h.value, 0) };
for (const a of accounts) a.currentBalance = Math.round(bal[a.id] * 100) / 100;

const snapshot = {
  ok: true,
  accounts,
  transactions: txns,
  holdings,
  connections: Object.entries({ [CONN.bank]: "Northwind Bank", [CONN.card]: "Harbor Card", [CONN.brk]: "Brightline Invest" }).map(([id, institutionName]) => ({ id, institutionName, status: "active", updatedAt: `${TODAY}T08:00:00Z` })),
  syncedAt: `${TODAY}T08:00:00Z`,
  warnings: ["Demo data: a fictional person and fictional accounts."],
};
writeFileSync(new URL("../src/lib/finance/demo-snapshot.ts", import.meta.url), `// Generated by scripts/generate-demo.mjs. Fictional demo data only.\nimport type { FinanceSnapshot } from "./types.ts";\n\nexport const demoSnapshot: FinanceSnapshot = ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`demo snapshot: ${txns.length} transactions, ${accounts.length} accounts, ${holdings.length} holdings (today ${TODAY})`);
