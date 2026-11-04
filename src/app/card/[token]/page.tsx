import { Suspense } from "react";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db, type MemberStatus } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { Card } from "@/components/ui/card";

const BAND = { active: "bg-plate-green text-white", expiring: "bg-plate-yellow text-ink", expired: "bg-plate-red text-white" };

// Public page the member opens on their phone to show their QR at the door.
// The token is a random UUID, so it acts as the access key.
export default function Page({ params }: PageProps<"/card/[token]">) {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <MemberCard params={params} />
    </Suspense>
  );
}

async function MemberCard({ params }: Pick<PageProps<"/card/[token]">, "params">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/.test(token)) notFound();
  const { data } = await db.from("member_status").select("name, qr_token, status, end_date").eq("qr_token", token).maybeSingle();
  if (!data) notFound();
  const m = data as Pick<MemberStatus, "name" | "qr_token" | "status" | "end_date">;
  const qr = await QRCode.toDataURL(m.qr_token, { margin: 1, width: 280 });

  return (
    <Card className="mx-auto mt-6 max-w-xs gap-0 pt-0 text-center">
      <div className={`${BAND[m.status]} py-3 text-base font-semibold`}>
        {m.status === "expired" ? "Membership ended. Renew at the desk." : `Active until ${fmtDate(m.end_date!)}`}
      </div>
      <p className="heading mt-4 px-4">{m.name}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Check-in QR" className="mx-auto mt-3" />
      <p className="muted mt-2 px-4">Show this at the front desk. Turn your screen brightness up if it won&apos;t scan.</p>
    </Card>
  );
}
