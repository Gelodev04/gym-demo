// Shared by server pages and client components (no server-only imports here).

// "2026-10-05" → "Oct 5, 2026"
export function fmtDate(date: string) {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

// ISO timestamp → "Oct 5, 2026, 8:00 AM" in PH time
export function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}

// "2026-11-04", -1 → "2026-11-03". Pure calendar math, no time zone involved.
export function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Monday of the week containing `date`.
export function weekStart(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDate(date, -((day + 6) % 7));
}

// First day of the month `months` away from the month containing `date`.
export function monthStart(date: string, months = 0) {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// Whole days from `a` to `b` ("2026-11-01" → "2026-11-04" = 3).
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// Self-check: node --experimental-strip-types src/lib/format.ts
if (typeof process !== "undefined" && process.argv[1]?.endsWith("format.ts")) {
  const assert = (ok: boolean, msg: string) => { if (!ok) throw new Error(msg); };
  assert(shiftDate("2026-03-01", -1) === "2026-02-28", "shiftDate across month");
  assert(weekStart("2026-11-04") === "2026-11-02", "Wednesday → Monday");
  assert(weekStart("2026-11-08") === "2026-11-02", "Sunday belongs to the week before");
  assert(weekStart("2026-11-02") === "2026-11-02", "Monday stays");
  assert(monthStart("2026-11-04") === "2026-11-01", "monthStart");
  assert(monthStart("2026-01-31", -1) === "2025-12-01", "previous month across year");
  assert(monthStart("2026-12-15", 1) === "2027-01-01", "next month across year");
  assert(daysBetween("2026-11-01", "2026-11-04") === 3, "daysBetween");
  console.log("format.ts self-check ok");
}
