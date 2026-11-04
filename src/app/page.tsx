import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { db, peso, phStartOf, phToday, type MemberStatus } from "@/lib/db";
import { dailySummary } from "@/lib/reminders";
import { MessageSquareIcon, PhoneIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageSkeleton } from "@/components/page-skeleton";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const staff = await requireStaff("owner");
  const today = phToday();
  const monthStart = phStartOf(today.slice(0, 8) + "01");

  const [summary, { data: atRisk }, { data: monthPayments }, { data: reminders }, { count: overrides }] = await Promise.all([
    dailySummary(staff.gym_id, today),
    db.from("member_status").select("*").eq("gym_id", staff.gym_id).gte("days_left", -7).lte("days_left", 3).order("days_left"),
    db.from("payments").select("member_id, amount, created_at").eq("gym_id", staff.gym_id).eq("kind", "membership").is("voided_at", null).gte("created_at", monthStart),
    db.from("sms_log").select("member_id, created_at").eq("gym_id", staff.gym_id).in("kind", ["expiring", "expired"]),
    db.from("checkins").select("id", { count: "exact", head: true }).eq("gym_id", staff.gym_id).eq("override", true).gte("created_at", phStartOf(today)),
  ]);

  // "Recovered": a renewal paid within 14 days after that member got a reminder.
  const DAY = 86_400_000;
  const recovered = (monthPayments ?? []).filter((p) =>
    (reminders ?? []).some((r) => {
      const gap = Date.parse(p.created_at) - Date.parse(r.created_at);
      return r.member_id === p.member_id && gap >= 0 && gap <= 14 * DAY;
    }),
  );
  const recoveredTotal = recovered.reduce((s, p) => s + Number(p.amount), 0);
  const members = (atRisk ?? []) as MemberStatus[];

  return (
    <div className="page gap-6">
      <header>
        <h1 className="heading">
          {new Date(`${today}T12:00:00+08:00`).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
        </h1>
        <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
          <Stat label="Collected today" value={peso(summary.revenue)} />
          <Stat label="Check-ins" value={summary.checkins} />
          <Stat label="Walk-ins" value={summary.walkins} />
          <Stat label="New members" value={summary.newMembers} />
        </dl>
        <p className="mt-3 text-plate-green">
          <strong className="font-display text-xl">{peso(recoveredTotal)}</strong> recovered this month: {recovered.length} member
          {recovered.length === 1 ? "" : "s"} renewed after a reminder.
        </p>
      </header>

      {!!overrides && (
        <Link href="/payments" className="block">
          <Card className="edge-expiring px-4 hover:bg-muted">
            {overrides} expired member{overrides === 1 ? " was" : "s were"} let in today by staff. Review on Payments.
          </Card>
        </Link>
      )}

      <section className="flex flex-col md:min-h-0 md:flex-1">
        <h2 className="subheading mb-2">Follow up today</h2>
        {members.length ? (
          <ul className="fill-scroll space-y-2 md:pr-1">
            {members.map((m) => (
              <li key={m.id}>
                <Card size="sm" className={`edge-${m.status} flex-row flex-wrap items-center gap-3 px-4`}>
                  <Link href={`/members/${m.id}`} className="font-display text-lg font-semibold hover:underline">
                    {m.name}
                  </Link>
                  <Badge variant={m.status}>{daysText(m.days_left!)}</Badge>
                  <span className="ml-auto flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`sms:${m.phone}`}>
                        <MessageSquareIcon /> Text
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a href={`tel:${m.phone}`}>
                        <PhoneIcon /> Call
                      </a>
                    </Button>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nobody is expiring this week. Reminders go out automatically every night.</p>
        )}
      </section>
    </div>
  );
}

function daysText(d: number) {
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} left`;
  if (d === 0) return "Expires today";
  return `Expired ${-d} day${d === -1 ? "" : "s"} ago`;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="muted">{label}</dt>
      <dd className="font-display text-3xl font-bold">{value}</dd>
    </div>
  );
}
