import type { CategoryId } from "./types.ts";

export const CATEGORY_COLOR: Record<CategoryId, string> = {
  groceries: "#5fae7d",
  dining: "#4a9268",
  transport: "#b06f84",
  fuel: "#c98a9e",
  cigarettes: "#c4694d",
  shopping: "#df7a5e",
  subscriptions: "#3f9e9f",
  personal: "#ddaab9",
  health: "#b3a9d6",
  housing: "#6b84ad",
  household: "#e8a088",
  utilities: "#8fa3c4",
  entertainment: "#7a6fb0",
  travel: "#e0c48a",
  services: "#7cbcbd",
  insurance: "#9488c4",
  fees: "#b08a72",
  other: "#d1a75a",
  income: "#5fae7d",
  transfer: "#9a8e80",
  investing: "#b8913f",
};

export function categoryColor(id: string): string {
  return CATEGORY_COLOR[id as CategoryId] ?? "#9a8e80";
}
