import {
  Apple,
  ArrowLeftRight,
  BadgeDollarSign,
  Car,
  CircleHelp,
  Clapperboard,
  HeartPulse,
  House,
  Landmark,
  Plane,
  Receipt,
  Cigarette,
  Cpu,
  Fuel,
  Zap,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  Sofa,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { categoryColor } from "@/lib/finance/colors";
import type { CategoryId } from "@/lib/finance/types";

const ICONS: Record<CategoryId, LucideIcon> = {
  groceries: Apple,
  dining: Utensils,
  transport: Car,
  fuel: Fuel,
  cigarettes: Cigarette,
  shopping: ShoppingBag,
  subscriptions: Cpu,
  personal: Scissors,
  health: HeartPulse,
  housing: House,
  household: Sofa,
  utilities: Zap,
  entertainment: Clapperboard,
  travel: Plane,
  services: Shirt,
  insurance: Shield,
  fees: Receipt,
  other: CircleHelp,
  income: BadgeDollarSign,
  transfer: ArrowLeftRight,
  investing: Landmark,
};

export function LeafMark() {
  return (
    <span
      className="grid size-10 shrink-0 place-items-center rounded-md bg-sage-soft"
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-7" fill="none">
        <path
          d="M16.2 5.4c4.2 2.8 7.4 7.2 7.4 11.8 0 4.8-3.2 8.6-7.6 8.6-.9 0-1.8-.2-2.6-.5-2-1.6-3.8-4.8-3.8-8.2 0-4.8 2.6-8.8 6.6-11.7z"
          fill="currentColor"
          className="text-sage"
        />
        <path
          d="M15.5 9.2c.3 3.6.2 7.4-.5 11.6"
          stroke="#fffcf9"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M15.2 15.2c1.8.2 3.6 1.1 5 2.4"
          stroke="#fffcf9"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function CategoryMark({
  category,
  tone = "spend",
  compact = false,
  tiny = false,
}: {
  category: CategoryId;
  tone?: "spend" | "in" | "quiet";
  compact?: boolean;
  tiny?: boolean;
}) {
  const color = categoryColor(category);
  const Icon = ICONS[category];
  const toneStyle =
    tone === "quiet"
      ? { background: "#e7e0d6", color: "#6e655c" }
      : { background: `${color}22`, color };
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-sm ${tiny ? "size-6" : compact ? "size-8" : "size-10"}`}
      style={toneStyle}
      aria-hidden="true"
    >
      <Icon className={tiny ? "size-3" : compact ? "size-3.5" : "size-4"} strokeWidth={1.75} />
    </span>
  );
}
