import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { db, peso, phStartOf, phToday } from "@/lib/db";
import { fmtDate, shiftDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DayInput } from "./day-picker";
import { PeriodView, type Period } from "./period-view";
import { PageSkeleton } from "@/components/page-skeleton";
import { VoidButton } from "@/components/void-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function Page({ searchParams }: PageProps<"/payments">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}

async function Payments({ searchParams }: Pick<PageProps<"/payments">, "searchParams">) {
  const staff = await requireStaff();
  const today = phToday();
  // Owner can look back at any past day; front desk always sees today.
  const { date: asked, view: askedView } = (await searchParams) as { date?: string; view?: string };
  const date = staff.role === "owner" && asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) && asked <= today ? asked : today;
  const view: "day" | Period = staff.role === "owner" && (askedView === "week" || askedView === "month") ? askedView : "day";
  const switcher = <ViewSwitch view={view} date={date} />;
  if (view !== "day") {
    return (
      <div className="page">
        <PeriodView gymId={staff.gym_id} period={view} date={date} today={today} switcher={switcher} />
      </div>
    );
  }
  const isToday = date === today;
  const dayLabel = isToday ? "today" : `on ${fmtDate(date)}`;
  const from = phStartOf(date);
  const to = phStartOf(shiftDate(date, 1));
  const [{ data: payments }, { data: overrides }] = await Promise.all([
    db
      .from("payments")
      .select("id, amount, kind, method, created_at, voided_at, member:members(id, name), staff:staff!payments_staff_id_fkey(name)")
      .eq("gym_id", staff.gym_id)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: false }),
    db
      .from("checkins")
      .select("id, created_at, member:members(id, name), staff(name)")
      .eq("gym_id", staff.gym_id)
      .eq("override", true)
      .gte("created_at", from)
      .lt("created_at", to),
  ]);

  // Expected cash in each staff member's drawer = their non-voided cash payments today.
  const cashByStaff = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.method !== "cash" || p.voided_at) continue;
    const name = one(p.staff)?.name ?? "—";
    cashByStaff.set(name, (cashByStaff.get(name) ?? 0) + Number(p.amount));
  }
  const total = (payments ?? []).filter((p) => !p.voided_at).reduce((s, p) => s + Number(p.amount), 0);
  const time = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", timeStyle: "short" });

  return (
    <div className="page">
      {staff.role === "owner" && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {switcher}
          <Button asChild variant="outline" size="icon-lg" aria-label="Previous day">
            <Link href={`/payments?date=${shiftDate(date, -1)}`}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <DayInput date={date} max={today} />
          {!isToday && (
            <Button asChild variant="outline" size="icon-lg" aria-label="Next day">
              <Link href={`/payments?date=${shiftDate(date, 1)}`}>
                <ChevronRightIcon />
              </Link>
            </Button>
          )}
          {!isToday && (
            <Button asChild variant="ghost">
              <Link href="/payments">Back to today</Link>
            </Button>
          )}
          <p className="ml-auto">
            <span className="font-display text-2xl font-bold">{peso(total)}</span>{" "}
            <span className="text-muted-foreground">collected {dayLabel}</span>
          </p>
        </div>
      )}

      <Card className="shrink-0">
        <CardHeader>
          <CardTitle>Cash in each drawer</CardTitle>
          <CardDescription>
            {isToday ? "What each staff member should hand over at end of shift." : `Cash each staff member took ${dayLabel}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1">
            {[...cashByStaff].map(([name, total]) => (
              <li key={name} className="flex items-baseline justify-between">
                <span>{name}</span>
                <span className="font-display text-2xl font-bold">{peso(total)}</span>
              </li>
            ))}
            {!cashByStaff.size && <li className="muted">No cash payments {isToday ? "yet" : dayLabel}.</li>}
          </ul>
        </CardContent>
      </Card>

      {!!overrides?.length && (
        <Card className="edge-expiring shrink-0">
          <CardHeader>
            <CardTitle>Expired members let in {dayLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {overrides.map((c) => (
                <li key={c.id}>
                  {time(c.created_at)}: {one(c.member)?.name}, let in by {one(c.staff)?.name}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="md:min-h-0 md:flex-1">
        <CardHeader>
          <CardTitle>{isToday ? "Today’s payments" : `Payments on ${fmtDate(date)}`}</CardTitle>
          {staff.role !== "owner" && <CardDescription>Payments can&apos;t be edited or deleted. Ask the owner to void a mistake.</CardDescription>}
        </CardHeader>
        <CardContent className="fill-scroll">
          {payments?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="hidden sm:table-cell">Method</TableHead>
                  <TableHead className="hidden sm:table-cell">Taken by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {staff.role === "owner" && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const member = one(p.member);
                  return (
                    <TableRow key={p.id} className={p.voided_at ? "text-muted-foreground line-through" : ""}>
                      <TableCell>{time(p.created_at)}</TableCell>
                      <TableCell>
                        {member ? (
                          <Link href={`/members/${member.id}`} className="hover:underline">
                            {member.name}
                          </Link>
                        ) : (
                          "Walk-in"
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{p.method}</TableCell>
                      <TableCell className="hidden sm:table-cell">{one(p.staff)?.name ?? "Online"}</TableCell>
                      <TableCell className="text-right font-medium">{peso(Number(p.amount))}</TableCell>
                      {staff.role === "owner" && (
                        <TableCell className="text-right">
                          {!p.voided_at && <VoidButton paymentId={p.id} summary={`${peso(Number(p.amount))} from ${member?.name ?? "a walk-in"}`} />}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="muted">{isToday ? "No payments yet today." : `No payments ${dayLabel}.`}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Day | Week | Month. Keeps the chosen date so switching views stays on the same period.
function ViewSwitch({ view, date }: { view: "day" | Period; date: string }) {
  const tabs = [
    ["day", "Day"],
    ["week", "Week"],
    ["month", "Month"],
  ] as const;
  return (
    <div role="tablist" aria-label="Period" className="mr-2 flex rounded-lg border bg-white p-1">
      {tabs.map(([key, label]) => (
        <Link
          key={key}
          role="tab"
          aria-selected={view === key}
          href={key === "day" ? `/payments?date=${date}` : `/payments?view=${key}&date=${date}`}
          className={`rounded-md px-3 py-1.5 text-sm ${view === key ? "bg-primary font-semibold text-primary-foreground" : "hover:bg-muted"}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

// Supabase types embedded relations as object or array; normalize to one row.
function one<T>(x: T | T[] | null): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : x;
}
