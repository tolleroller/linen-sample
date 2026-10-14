/** RFC4180-ish parser. Handles quoted fields and doubled quotes. */
export function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/^\uFEFF/, "");
  if (!text.trim()) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += c;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }

  if (rows.length < 2) return [];
  const header = rows[0].map((name) => name.trim());
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      if (name) record[name] = values[index] ?? "";
    });
    return record;
  });
}
