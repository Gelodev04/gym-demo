import "server-only";
import { db, peso, phStartOf, phToday, type MemberStatus } from "./db";

// Queues expiry reminders + owner summary, then sends queued/failed rows.
// Without SEMAPHORE_API_KEY, messages land in the demo outbox instead of going out.
export async function runReminders(gymId: string) {
  const today = phToday();
  const { data: gym } = await db.from("gyms").select("name").eq("id", gymId).single();
  const { data: members } = await db
    .from("member_status")
    .select("*")
    .eq("gym_id", gymId)
    .not("end_date", "is", null)
    .gte("days_left", -7)
    .lte("days_left", 3);

  type Row = { gym_id: string; member_id: string | null; phone: string; kind: string; ref_date: string; message: string };
  const rows: Row[] = (members as MemberStatus[]).map((m) => {
    const first = m.name.split(" ")[0];
    const expiring = m.days_left! >= 0;
    return {
      gym_id: gymId,
      member_id: m.id,
      phone: m.phone,
      kind: expiring ? "expiring" : "expired",
      ref_date: m.end_date!,
      message: expiring
        ? `Hi ${first}! Ang membership mo sa ${gym!.name} ay mag-e-expire ${m.days_left === 0 ? "ngayong araw" : `sa ${m.days_left} araw`}. Renew na para tuloy-tuloy ang gains!`
        : `Hi ${first}, na-miss ka namin sa ${gym!.name}! Expired na ang membership mo. Renew ka na sa front desk o via GCash.`,
    };
  });

  const { data: owners } = await db.from("staff").select("phone").eq("gym_id", gymId).eq("role", "owner");
  const summary = await dailySummary(gymId, today);
  for (const o of owners ?? []) {
    if (!o.phone) continue;
    rows.push({
      gym_id: gymId,
      member_id: null,
      phone: o.phone,
      kind: "owner_summary",
      ref_date: today,
      message: `${gym!.name} ${today}: ${peso(summary.revenue)} kita, ${summary.checkins} check-ins, ${summary.walkins} walk-ins, ${summary.renewals} renewals, ${summary.newMembers} bagong members.`,
    });
  }

  // Unique (phone, kind, ref_date) means re-running never double-sends.
  if (rows.length) await db.from("sms_log").upsert(rows, { onConflict: "phone,kind,ref_date", ignoreDuplicates: true });

  const { data: pending } = await db.from("sms_log").select("*").eq("gym_id", gymId).in("status", ["queued", "failed"]);
  for (const msg of pending ?? []) {
    const status = await send(msg.phone, msg.message);
    await db.from("sms_log").update({ status }).eq("id", msg.id);
  }
  return pending?.length ?? 0;
}

async function send(phone: string, message: string) {
  const apikey = process.env.SEMAPHORE_API_KEY;
  if (!apikey) return "outbox";
  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ apikey, number: phone, message, ...(process.env.SEMAPHORE_SENDER ? { sendername: process.env.SEMAPHORE_SENDER } : {}) }),
  });
  return res.ok ? "sent" : "failed";
}

export async function dailySummary(gymId: string, date: string) {
  const from = phStartOf(date);
  const [{ data: payments }, { count: checkins }, { count: newMembers }] = await Promise.all([
    db.from("payments").select("amount, kind").eq("gym_id", gymId).is("voided_at", null).gte("created_at", from),
    db.from("checkins").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("created_at", from),
    db.from("members").select("id", { count: "exact", head: true }).eq("gym_id", gymId).gte("created_at", from),
  ]);
  const p = payments ?? [];
  return {
    revenue: p.reduce((s, x) => s + Number(x.amount), 0),
    walkins: p.filter((x) => x.kind === "walkin").length,
    renewals: p.filter((x) => x.kind === "membership").length,
    checkins: checkins ?? 0,
    newMembers: newMembers ?? 0,
  };
}
