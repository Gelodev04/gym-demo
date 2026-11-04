"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

// Native date picker; picking a day loads /payments?date=YYYY-MM-DD.
export function DayInput({ date, max }: { date: string; max: string }) {
  const router = useRouter();
  return (
    <Input
      type="date"
      aria-label="Pick a day"
      value={date}
      max={max}
      onChange={(e) => e.target.value && router.push(`/payments?date=${e.target.value}`)}
      className="w-44"
    />
  );
}
