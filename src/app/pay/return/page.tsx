import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { syncRecentCheckouts } from "@/lib/paymongo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// PayMongo sends the payer here after checkout. We re-check recent sessions with PayMongo,
// which records the payment even when the webhook can't reach us (e.g. localhost demo).
export default function Page({ searchParams }: PageProps<"/pay/return">) {
  return (
    <Suspense fallback={<p>Checking payment…</p>}>
      <Result searchParams={searchParams} />
    </Suspense>
  );
}

async function Result({ searchParams }: Pick<PageProps<"/pay/return">, "searchParams">) {
  const { member } = (await searchParams) as { member?: string };
  const paid = await syncRecentCheckouts(member ?? "");
  const { data: m } = await db.from("members").select("qr_token").eq("id", member ?? "").maybeSingle();

  return (
    <Card className="mx-auto mt-10 max-w-sm px-4 text-center">
      <p className="text-2xl font-bold">{paid ? "Payment received ✓" : "Payment not completed"}</p>
      <p className="mt-2 text-iron">{paid ? "Your membership has been extended. Salamat!" : "No charge was made. You can try again at the front desk."}</p>
      {m && (
        <Button asChild>
          <Link href={`/card/${m.qr_token}`}>View my membership card</Link>
        </Button>
      )}
    </Card>
  );
}
