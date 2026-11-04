import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { daysAgoIso, db, type MemberStatus } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SortSelect, StatusFilter } from "./status-filter";
import { SEARCH_FORM_ID, SORTS, type SortKey } from "./sorts";
import { NewMemberForm } from "./new-member-form";

export default function Page({ searchParams }: PageProps<"/members">) {
  return (
    <Suspense fallback={<PageSkeleton rows={8} />}>
      <Members searchParams={searchParams} />
    </Suspense>
  );
}

async function Members({ searchParams }: Pick<PageProps<"/members">, "searchParams">) {
  const staff = await requireStaff();
  const { status, q, sort: rawSort } = (await searchParams) as { status?: string; q?: string; sort?: string };
  const sort: SortKey = rawSort && rawSort in SORTS ? (rawSort as SortKey) : "name";

  let query = db.from("member_status").select("*").eq("gym_id", staff.gym_id);
  // "No plan yet" members have no end date; they go last in both end-date sorts.
  if (sort === "end-asc") query = query.order("end_date", { ascending: true, nullsFirst: false });
  if (sort === "end-desc") query = query.order("end_date", { ascending: false, nullsFirst: false });
  if (sort === "newest") query = query.order("created_at", { ascending: false });
  query = query.order("name");
  if (status && status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const [{ data }, { data: plans }, { data: waiting }] = await Promise.all([
    query,
    db.from("plans").select("id, name, price").eq("gym_id", staff.gym_id).order("price"),
    // Signed up (kiosk or "Pay later") in the last 14 days but never paid.
    db
      .from("member_status")
      .select("id, name, created_at")
      .eq("gym_id", staff.gym_id)
      .is("end_date", null)
      .gte("created_at", daysAgoIso(14))
      .order("created_at", { ascending: false }),
  ]);
  const members = (data ?? []) as MemberStatus[];

  return (
    // Only the member list scrolls (see .page / .fill-scroll in globals.css).
    <div className="grid gap-4 md:h-full md:min-h-0 md:grid-cols-[2fr_1fr]">
      <Card className="md:min-h-0">
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <form id={SEARCH_FORM_ID} className="mb-3 flex flex-wrap gap-2">
            <Input name="q" defaultValue={q} placeholder="Search by name" aria-label="Search by name" className="min-w-40 flex-1" />
            <StatusFilter defaultValue={status} />
            <SortSelect defaultValue={sort} />
            <Button variant="outline">Search</Button>
          </form>
          {!!waiting?.length && (
            <div className="mb-3 shrink-0 rounded-lg border-l-4 border-l-plate-yellow bg-plate-yellow/10 px-3 py-2">
              <p className="font-display text-lg font-semibold">Waiting to pay ({waiting.length})</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {waiting.map((w) => (
                  <li key={w.id}>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/members/${w.id}`}>{w.name}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="muted mb-2">
            {members.length} member{members.length === 1 ? "" : "s"}
          </p>
          <ul className="fill-scroll space-y-1 md:-mr-2 md:pr-2">
            {members.map((m) => (
              <li key={m.id}>
                <Link href={`/members/${m.id}`} className={`edge-${m.status} flex items-center justify-between rounded-r-md px-3 py-2 hover:bg-muted`}>
                  <span className="font-display text-lg font-semibold">{m.name}</span>
                  <span className="muted">{m.end_date ? `${m.status === "expired" ? "Ended" : "Until"} ${fmtDate(m.end_date)}` : "No plan yet"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!members.length && <p className="muted">No members match. Clear the search or add a new member.</p>}
        </CardContent>
      </Card>

      <NewMemberForm plans={(plans ?? []).map((p) => ({ ...p, price: Number(p.price) }))} />
    </div>
  );
}
