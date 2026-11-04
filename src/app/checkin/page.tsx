import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { db, phStartOf, phToday } from "@/lib/db";
import { ActionForm } from "@/components/action-form";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordWalkin } from "../actions";
import { Scanner } from "./scanner";

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton rows={2} />}>
      <Checkin />
    </Suspense>
  );
}

async function Checkin() {
  const staff = await requireStaff();
  // Count updates after each walk-in, which doubles as the "it worked" feedback.
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("gym_id", staff.gym_id)
    .eq("kind", "walkin")
    .is("voided_at", null)
    .gte("created_at", phStartOf(phToday()));
  return (
    <div className="grid gap-4 md:h-full md:min-h-0 md:grid-cols-[2fr_1fr] md:items-start">
      <Scanner />
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Walk-in</CardTitle>
          <CardDescription>
            {count ?? 0} walk-in{count === 1 ? "" : "s"} today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={recordWalkin} className="space-y-3">
            <Label htmlFor="amount">Day pass, cash</Label>
            <div className="flex items-center gap-2">
              <span className="font-display text-2xl">₱</span>
              <Input id="amount" name="amount" type="number" defaultValue={100} min={1} inputMode="numeric" className="font-display text-2xl" />
            </div>
            <Button className="w-full">Record walk-in</Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
