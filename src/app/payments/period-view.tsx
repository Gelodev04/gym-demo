import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { db, peso, phStartOf } from "@/lib/db";
import { daysBetween, fmtDate, monthStart, shiftDate, weekStart } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type Period = "week" | "month";

type Row = { amount: number; kind: string; method: string; created_at: string };

const phDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const sum = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.amount), 0);

// ponytail: pulls every payment in the period and totals in JS. Fine for a small gym
// (Supabase returns up to 1,000 rows); move to a SQL group-by if a month ever exceeds that.
async function load(gymId: string, from: string, to: string) {
  const { data } = await db
    .from("payments")
    .select("amount, kind, method, created_at")
    .eq("gym_id", gymId)
    .is("voided_at", null)
    .gte("created_at", phStartOf(from))
    .lt("created_at", phStartOf(to));
  return (data ?? []) as Row[];
}

export async function PeriodView({ gymId, period, date, today, switcher }: { gymId: string; period: Period; date: string; today: string; switcher: React.ReactNode }) {
  const start = period === "week" ? weekStart(date) : monthStart(date);
  const end = period === "week" ? shiftDate(start, 7) : monthStart(start, 1); // exclusive
  const prevStart = period === "week" ? shiftDate(start, -7) : monthStart(start, -1);
  const nextStart = end;
  const ongoing = today < end;

  // An unfinished period is compared with the same number of days of the previous one
  // (Nov 1–4 vs Oct 1–4), otherwise a fresh month always looks like a loss.
  const lastDay = ongoing ? today : shiftDate(end, -1);
  const elapsed = daysBetween(start, lastDay) + 1;
  const sameDays = shiftDate(prevStart, elapsed);
  const prevEnd = ongoing && sameDays < start ? sameDays : start;

  const [rows, prevRows] = await Promise.all([load(gymId, start, end), load(gymId, prevStart, prevEnd)]);
  const total = sum(rows);
  const prevTotal = sum(prevRows);
  const change = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const memberships = rows.filter((r) => r.kind === "membership");
  const walkins = rows.filter((r) => r.kind === "walkin");
  const cash = rows.filter((r) => r.method === "cash");
  const online = rows.filter((r) => r.method !== "cash");

  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(phDay(r.created_at), (byDay.get(phDay(r.created_at)) ?? 0) + Number(r.amount));
  const days = Array.from({ length: elapsed }, (_, i) => shiftDate(start, i));
  const best = Math.max(1, ...days.map((d) => byDay.get(d) ?? 0));

  const label =
    period === "week"
      ? `${fmtDate(start)} – ${fmtDate(shiftDate(end, -1))}`
      : new Date(`${start}T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" });
  const prevLabel = period === "week" ? "last week" : new Date(`${prevStart}T12:00:00+08:00`).toLocaleDateString("en-PH", { month: "long" });
  const href = (d: string) => `/payments?view=${period}&date=${d}`;

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {switcher}
        <Button asChild variant="outline" size="icon-lg" aria-label={`Previous ${period}`}>
          <Link href={href(prevStart)}>
            <ChevronLeftIcon />
          </Link>
        </Button>
        <span className="min-w-44 text-center font-display text-xl font-semibold">{label}</span>
        {!ongoing && (
          <Button asChild variant="outline" size="icon-lg" aria-label={`Next ${period}`}>
            <Link href={href(nextStart)}>
              <ChevronRightIcon />
            </Link>
          </Button>
        )}
        <div className="ml-auto text-right">
          <p>
            <span className="font-display text-3xl font-bold">{peso(total)}</span> <span className="text-muted-foreground">collected</span>
          </p>
          {change !== null && (
            <p className={`text-sm ${change >= 0 ? "text-plate-green" : "text-plate-red"}`}>
              {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs {ongoing ? `the same days ${period === "week" ? "last week" : `of ${prevLabel}`}` : prevLabel}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:min-h-0 md:flex-1 md:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Where the money came from</CardTitle>
            <CardDescription>Voided payments are not counted.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-1">
              <Line label="Memberships" value={sum(memberships)} note={`${memberships.length} payment${memberships.length === 1 ? "" : "s"}`} />
              <Line label="Walk-ins" value={sum(walkins)} note={`${walkins.length} visit${walkins.length === 1 ? "" : "s"}`} />
            </dl>
            <dl className="space-y-1 border-t pt-4">
              <Line label="Cash" value={sum(cash)} note="collected by staff" />
              <Line label="GCash / Maya / card" value={sum(online)} note="paid online" />
            </dl>
          </CardContent>
        </Card>

        <Card className="md:min-h-0">
          <CardHeader>
            <CardTitle>Per day</CardTitle>
            <CardDescription>Tap a day to see its payments.</CardDescription>
          </CardHeader>
          <CardContent className="fill-scroll">
            <ul className="space-y-1">
              {days.map((d) => {
                const amount = byDay.get(d) ?? 0;
                return (
                  <li key={d}>
                    <Link href={`/payments?date=${d}`} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted">
                      <span className="text-sm">
                        {new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span className="h-3 rounded-full bg-muted">
                        <span className="block h-3 rounded-full bg-primary" style={{ width: `${(amount / best) * 100}%` }} />
                      </span>
                      <span className="text-right font-medium">{peso(amount)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Line({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt>
        {label} <span className="text-sm text-muted-foreground">({note})</span>
      </dt>
      <dd className="font-display text-2xl font-bold">{peso(value)}</dd>
    </div>
  );
}
