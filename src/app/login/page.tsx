import { Suspense } from "react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "./login-form";

export default function Page() {
  return (
    <Card className="mx-auto mt-10 max-w-sm">
      <CardHeader>
        <CardTitle className="text-3xl font-bold tracking-tight">GymDesk</CardTitle>
        <CardDescription>Pick your name and enter your PIN.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <StaffPicker />
        </Suspense>
        <p className="muted mt-4 text-center">
          Just looking? <a href="/demo" className="font-medium text-primary underline">Try the demo</a>, no PIN needed.
        </p>
      </CardContent>
    </Card>
  );
}

// ponytail: lists every staff row (single-gym demo). Pick the gym by subdomain when multi-tenant.
async function StaffPicker() {
  const { data: staff } = await db.from("staff").select("id, name, role").order("role", { ascending: false });
  return <LoginForm staff={staff ?? []} />;
}
