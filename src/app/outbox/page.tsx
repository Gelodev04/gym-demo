import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { runRemindersNow } from "../actions";
import { ActionForm } from "@/components/action-form";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const KIND: Record<string, string> = { expiring: "Expiring soon", expired: "Expired", owner_summary: "Owner daily summary" };
const STATUS: Record<string, string> = { outbox: "Not sent (demo)", sent: "Sent", failed: "Failed, will retry", queued: "Waiting" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outbox />
    </Suspense>
  );
}

async function Outbox() {
  const staff = await requireStaff("owner");
  const { data: messages } = await db
    .from("sms_log")
    .select("id, phone, kind, message, status, created_at")
    .eq("gym_id", staff.gym_id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="page">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading">Reminders</h1>
          <p className="muted">
            {process.env.SEMAPHORE_API_KEY ? "Sent by SMS" : "Demo mode: messages appear here instead of being sent"}. They go out automatically every night at 9 PM.
          </p>
        </div>
        <ActionForm action={runRemindersNow}>
          <Button>Send reminders now</Button>
        </ActionForm>
      </div>
      <div className="fill-scroll space-y-2 md:pr-1">
        {messages?.map((m) => (
          <Card key={m.id} size="sm">
            <CardContent className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {KIND[m.kind] ?? m.kind} to {m.phone}
                </span>
                <Badge variant={m.status === "failed" ? "destructive" : "outline"}>{STATUS[m.status] ?? m.status}</Badge>
              </div>
              <p className="text-base">{m.message}</p>
            </CardContent>
          </Card>
        ))}
        {!messages?.length && <p className="muted">No reminders yet. Press Send reminders now to message members who are expiring.</p>}
      </div>
    </div>
  );
}
