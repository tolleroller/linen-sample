export function money(value: number, digits = 2): string {
  const abs = Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return value < 0 ? `−${abs}` : abs;
}

export function signedMoney(value: number): string {
  if (value > 0) return `+${money(value)}`;
  if (value < 0) return money(value);
  return money(0);
}

export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 10_000) {
    return `${sign}$${(abs / 1000).toLocaleString("en-US", {
      maximumFractionDigits: abs >= 100_000 ? 0 : 1,
    })}k`;
  }
  return money(value, abs >= 100 ? 0 : 2);
}

export function formatSubtype(subtype: string): string {
  const known: Record<string, string> = {
    checking: "Checking",
    savings: "Savings",
    brokerage: "Brokerage",
    hsa: "HSA",
    "401k": "401(k)",
    roth: "Roth IRA",
    ira: "IRA",
    "credit card": "Credit card",
    credit: "Credit card",
    loan: "Loan",
    mortgage: "Mortgage",
  };
  return known[subtype.toLowerCase()] ?? subtype.replace(/_/g, " ");
}
