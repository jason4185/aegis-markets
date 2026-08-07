const UTC_DAY_MS = 24 * 60 * 60 * 1000;

function parseUtcCalendarDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return timestamp;
}

export function utcCalendarDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export type SettlementDateAvailability = "past" | "today" | "future" | "invalid";

export function settlementDateAvailability(
  settlementDate: string,
  now: Date = new Date(),
): SettlementDateAvailability {
  const settlementTimestamp = parseUtcCalendarDate(settlementDate);
  const currentTimestamp = parseUtcCalendarDate(utcCalendarDate(now));
  if (settlementTimestamp === null || currentTimestamp === null) return "invalid";
  if (settlementTimestamp < currentTimestamp) return "past";
  if (settlementTimestamp === currentTimestamp) return "today";
  return "future";
}

export function isDailySettlementProcessable(
  settlementDate: string,
  now: Date = new Date(),
): boolean {
  return settlementDateAvailability(settlementDate, now) === "past";
}

export function settlementAvailabilityMessage(
  settlementDate: string,
  now: Date = new Date(),
): string | null {
  if (settlementDateAvailability(settlementDate, now) !== "today") return null;
  const settlementTimestamp = parseUtcCalendarDate(settlementDate);
  if (settlementTimestamp === null) return null;
  const availableDate = new Date(settlementTimestamp + UTC_DAY_MS);
  return `Daily market data is still being finalized. Available to settle after 00:00 UTC on ${availableDate.toISOString().slice(0, 10)}.`;
}
