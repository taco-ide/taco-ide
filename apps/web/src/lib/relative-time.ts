const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

interface Threshold {
  unit: Intl.RelativeTimeFormatUnit;
  amount: number;
}

const thresholds: Threshold[] = [
  { unit: "year", amount: 60 * 60 * 24 * 365 },
  { unit: "month", amount: 60 * 60 * 24 * 30 },
  { unit: "week", amount: 60 * 60 * 24 * 7 },
  { unit: "day", amount: 60 * 60 * 24 },
  { unit: "hour", amount: 60 * 60 },
  { unit: "minute", amount: 60 },
];

/**
 * Formats a timestamp (or ISO string) as a Brazilian Portuguese relative time
 * label (e.g. "há 3 dias", "agora", "há 2 h"). Returns "Nunca" when the value
 * is null/undefined.
 */
export function formatRelativeTimePtBR(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return "Nunca";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 45) return "agora";

  for (const { unit, amount } of thresholds) {
    if (absSeconds >= amount) {
      const value = Math.round(diffSeconds / amount);
      return formatter.format(value, unit);
    }
  }

  return formatter.format(diffSeconds, "second");
}
