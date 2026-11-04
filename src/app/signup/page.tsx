import { Suspense } from "react";
import { requireStaff } from "@/lib/auth";
import { db, peso } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { KioskForm } from "./kiosk-form";

// Member sign-up kiosk: runs on the gym's tablet, logged in as staff, but covers the
// whole screen (nav included). Leaving needs a staff PIN; see enterKiosk/exitKiosk.
export default function Page() {
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-lg" />}>
        <Kiosk />
      </Suspense>
    </div>
  );
}

async function Kiosk() {
  const staff = await requireStaff(undefined, { kiosk: true });
  const [{ data: gym }, { data: plans }] = await Promise.all([
    db.from("gyms").select("name").eq("id", staff.gym_id).single(),
    db.from("plans").select("name, price").eq("gym_id", staff.gym_id).order("price"),
  ]);
  return (
    <KioskForm
      gymName={gym?.name ?? "the gym"}
      prices={(plans ?? []).map((p) => `${p.name} ${peso(Number(p.price))}`)}
    />
  );
}
