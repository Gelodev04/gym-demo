"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { checkPin, endSession, requireStaff, setKiosk, startSession } from "@/lib/auth";
import { db, peso, type MemberStatus, type Staff } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { createCheckout } from "@/lib/paymongo";
import { runReminders } from "@/lib/reminders";
import { DEMO } from "@/lib/demo";

export async function login(_: unknown, form: FormData) {
  const { data: staff } = await db.from("staff").select("id, role, pin_hash").eq("id", String(form.get("staff_id"))).single();
  if (!staff || !checkPin(String(form.get("pin")), staff.pin_hash)) return { error: "Wrong PIN. Try again." };
  await startSession(staff.id);
  redirect(staff.role === "owner" ? "/" : "/checkin");
}

// Public demo (/demo): one-click login so prospects can explore without a PIN.
const DEMO_PATHS = ["/", "/checkin", "/members", "/payments", "/outbox"];

export async function demoLogin(role: "owner" | "desk", to: string) {
  if (!DEMO) redirect("/login");
  const { data: staff } = await db.from("staff").select("id").eq("role", role).order("name").limit(1).maybeSingle();
  if (!staff) redirect("/login");
  await setKiosk(false);
  await startSession(staff.id);
  redirect(DEMO_PATHS.includes(to) ? to : "/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// Returned to <ActionForm>, which shows it as a toast.
export type ActionResult = { message?: string; error?: string; redirectTo?: string } | void;

export type CheckinResult =
  | { ok: false; error: string }
  | { ok: true; recorded: boolean; member: MemberStatus };

// Expired members are not recorded unless staff explicitly override (logged for owner review).
export async function checkIn(token: string, override = false): Promise<CheckinResult> {
  const staff = await requireStaff();
  const { data: member } = await db
    .from("member_status")
    .select("*")
    .eq("gym_id", staff.gym_id)
    .eq("qr_token", token)
    .maybeSingle();
  if (!member) return { ok: false, error: "This code doesn't match any member" };
  if (member.status === "expired" && !override) return { ok: true, recorded: false, member };
  await db.from("checkins").insert({ gym_id: staff.gym_id, member_id: member.id, staff_id: staff.id, override });
  return { ok: true, recorded: true, member };
}

export async function recordWalkin(form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const amount = Number(form.get("amount"));
  if (!(amount > 0)) return { error: "Enter an amount above ₱0." };
  await db.from("payments").insert({ gym_id: staff.gym_id, kind: "walkin", amount, method: "cash", staff_id: staff.id });
  refresh();
  return { message: `Walk-in recorded: ${peso(amount)} cash` };
}

// Shared by the staff form and the member sign-up kiosk.
async function createMember(staff: Staff, form: FormData): Promise<{ error: string } | { id: string; name: string }> {
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  if (!name) return { error: "Enter the full name." };
  if (!/^(09|\+639)\d{9}$/.test(phone)) return { error: "Enter an 11-digit mobile number starting with 09." };
  if (form.get("consent") !== "on") return { error: "Tick the consent box. We need permission before storing these details." };
  const { data: existing } = await db.from("members").select("id").eq("gym_id", staff.gym_id).eq("phone", phone).maybeSingle();
  if (existing) return { error: "This mobile number is already registered. Ask the front desk for help." };

  let photo_url: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const path = `${staff.gym_id}/${crypto.randomUUID()}.jpg`;
    const { error } = await db.storage.from("photos").upload(path, photo, { contentType: photo.type });
    if (!error) photo_url = db.storage.from("photos").getPublicUrl(path).data.publicUrl;
  }

  const { data: member, error } = await db
    .from("members")
    .insert({ gym_id: staff.gym_id, name, phone, photo_url })
    .select("id")
    .single();
  if (error) throw error;
  return { id: member.id, name };
}

export async function addMember(form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const created = await createMember(staff, form);
  if ("error" in created) return created;
  const member = created;
  const name = created.name;

  const planId = String(form.get("plan_id") || "");
  if (planId && planId !== "later") {
    await assertSameGym(staff.gym_id, member.id, planId);
    await payCash(member.id, planId, staff.id);
  }
  return { message: `${name} added.`, redirectTo: `/members/${member.id}` };
}

// Form values come from the client, so confirm member and plan belong to this staff's gym.
async function assertSameGym(gymId: string, memberId: string, planId: string) {
  const [{ data: m }, { data: p }] = await Promise.all([
    db.from("members").select("id").eq("id", memberId).eq("gym_id", gymId).maybeSingle(),
    db.from("plans").select("id").eq("id", planId).eq("gym_id", gymId).maybeSingle(),
  ]);
  if (!m || !p) throw new Error("Member or plan not found");
}

async function payCash(memberId: string, planId: string, staffId: string) {
  const { error } = await db.rpc("record_payment", { p_member: memberId, p_plan: planId, p_method: "cash", p_staff: staffId });
  if (error) throw error;
}

export async function recordCash(form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const memberId = String(form.get("member_id"));
  const planId = String(form.get("plan_id"));
  await assertSameGym(staff.gym_id, memberId, planId);
  await payCash(memberId, planId, staff.id);
  const { data } = await db.from("member_status").select("end_date").eq("id", memberId).single();
  refresh();
  return { message: `Cash payment recorded. Active until ${fmtDate(data!.end_date)}.` };
}

export async function createPayLink(form: FormData): Promise<ActionResult> {
  if (!process.env.PAYMONGO_SECRET_KEY) return { error: "GCash isn't set up yet. Add PAYMONGO_SECRET_KEY to .env.local." };
  const staff = await requireStaff();
  const memberId = String(form.get("member_id"));
  await assertSameGym(staff.gym_id, memberId, String(form.get("plan_id")));
  const { data: plan } = await db.from("plans").select("id, name, price").eq("id", String(form.get("plan_id"))).single();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = await createCheckout({ gymId: staff.gym_id, memberId, plan: plan!, origin });
  return { redirectTo: `/members/${memberId}?checkout=${encodeURIComponent(url)}` };
}

export async function voidPayment(form: FormData): Promise<ActionResult> {
  const staff = await requireStaff("owner");
  await db
    .from("payments")
    .update({ voided_by: staff.id, voided_at: new Date().toISOString() })
    .eq("id", String(form.get("payment_id")))
    .eq("gym_id", staff.gym_id)
    .is("voided_at", null);
  refresh();
  return { message: "Payment voided. Any days it added were taken back." };
}

export async function runRemindersNow(): Promise<ActionResult> {
  const staff = await requireStaff("owner");
  const count = await runReminders(staff.gym_id);
  refresh();
  return { message: count ? `${count} new reminder${count === 1 ? "" : "s"} written.` : "Everyone due a reminder already has one." };
}

// ---- Member sign-up kiosk (members type their own details on the gym's tablet) ----

export async function enterKiosk() {
  await requireStaff();
  await setKiosk(true);
  redirect("/signup");
}

export async function kioskSignup(form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(undefined, { kiosk: true });
  const created = await createMember(staff, form);
  if ("error" in created) return created;
  refresh();
  return { message: created.name.split(" ")[0] };
}

// Any staff member of this gym can unlock the kiosk with their own PIN.
export async function exitKiosk(pin: string): Promise<ActionResult> {
  const staff = await requireStaff(undefined, { kiosk: true });
  const { data: team } = await db.from("staff").select("pin_hash").eq("gym_id", staff.gym_id);
  if (!(team ?? []).some((t) => checkPin(pin, t.pin_hash))) return { error: "Wrong PIN." };
  await setKiosk(false);
  return { redirectTo: "/members" };
}
