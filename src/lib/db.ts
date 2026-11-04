import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service role key bypasses RLS, so this must never reach the browser.
export const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export type Staff = { id: string; gym_id: string; name: string; phone: string | null; role: "owner" | "desk" };

export type MemberStatus = {
  id: string;
  gym_id: string;
  name: string;
  phone: string;
  photo_url: string | null;
  qr_token: string;
  end_date: string | null;
  status: "active" | "expiring" | "expired";
  days_left: number | null;
};

export function phToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function phStartOf(date: string) {
  return `${date}T00:00:00+08:00`;
}

export function peso(n: number) {
  return "₱" + n.toLocaleString("en-PH", { maximumFractionDigits: 0 });
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
