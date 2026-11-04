import { Suspense } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { db, peso, type MemberStatus } from "@/lib/db";
import { createPayLink, recordCash } from "../../actions";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/action-form";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

export default function Page(props: PageProps<"/members/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={3} />}>
      <Member {...props} />
    </Suspense>
  );
}

async function Member({ params, searchParams }: PageProps<"/members/[id]">) {
  const staff = await requireStaff();
  const { id } = await params;
  const { checkout } = (await searchParams) as { checkout?: string };

  const { data } = await db.from("member_status").select("*").eq("id", id).eq("gym_id", staff.gym_id).maybeSingle();
  if (!data) notFound();
  const m = data as MemberStatus;

  const [{ data: plans }, { data: payments }, { data: checkins }] = await Promise.all([
    db.from("plans").select("id, name, price").eq("gym_id", staff.gym_id).order("price"),
    db.from("payments").select("id, amount, method, created_at, voided_at").eq("member_id", id).order("created_at", { ascending: false }).limit(10),
    db.from("checkins").select("id, created_at, override").eq("member_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const memberQr = await QRCode.toDataURL(m.qr_token, { margin: 1, width: 200 });
  const checkoutQr = checkout?.startsWith("https://") ? await QRCode.toDataURL(checkout, { margin: 1, width: 240 }) : null;

  return (
    <div className="grid gap-4 md:h-full md:min-h-0 md:grid-cols-2">
      <Card className="h-fit md:max-h-full md:overflow-y-auto">
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            {m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo_url} alt="" className="h-20 w-20 rounded-lg object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted font-display text-3xl font-bold">{m.name[0]}</div>
            )}
            <div className="space-y-1">
              <h1 className="heading leading-none">{m.name}</h1>
              <p className="muted">{m.phone}</p>
              <Badge variant={m.status}>{m.end_date ? `${m.status === "expired" ? "Ended" : "Until"} ${fmtDate(m.end_date)}` : "No plan yet"}</Badge>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={memberQr} alt="Member check-in QR" className="mx-auto" />
          <p className="text-center text-xs text-muted-foreground">
            Member code: {m.qr_token}
            <br />
            <a href={`/card/${m.qr_token}`} className="underline">
              Open phone card
            </a>{" "}
            to send to the member.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4 md:min-h-0 md:overflow-y-auto md:pr-1">
        <Card>
          <CardHeader>
            <CardTitle>Renew membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {plans?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {p.name}, {peso(Number(p.price))}
                </span>
                <div className="flex gap-2">
                  <ActionForm action={recordCash}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <Button variant="outline">Cash</Button>
                  </ActionForm>
                  <ActionForm action={createPayLink}>
                    <input type="hidden" name="member_id" value={m.id} />
                    <input type="hidden" name="plan_id" value={p.id} />
                    <Button>GCash / Maya</Button>
                  </ActionForm>
                </div>
              </div>
            ))}
            {checkoutQr && (
              <div className="land rounded-lg border-2 border-primary p-3 text-center">
                <p className="font-medium">Member scans this with their phone to pay by GCash, Maya, or card</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={checkoutQr} alt="Payment QR" className="mx-auto" />
                <Button asChild variant="link">
                  <a href={checkout} target="_blank">
                    Open payment page
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {payments?.length ? (
              <Table>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id} className={p.voided_at ? "text-muted-foreground line-through" : ""}>
                      <TableCell>{fmtDateTime(p.created_at)}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell className="text-right font-medium">{peso(Number(p.amount))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="muted">No payments yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            {checkins?.length ? (
              <ul className="space-y-1 text-sm">
                {checkins.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    {fmtDateTime(c.created_at)}
                    {c.override && <Badge variant="expired">Let in while expired</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No check-ins yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
