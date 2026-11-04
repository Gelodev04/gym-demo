import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, type Staff } from "./db";

const COOKIE = "sid";
// While set, the device is a member sign-up kiosk: every staff page redirects to /signup
// until a staff PIN is entered (see exitKiosk in actions.ts).
const KIOSK = "kiosk";

function sign(value: string) {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
}

// pin_hash format: "<salt>:<scrypt hex>" (same as scripts/seed.mjs)
export function checkPin(pin: string, pinHash: string) {
  const [salt, hash] = pinHash.split(":");
  const test = scryptSync(pin, salt, 32);
  return timingSafeEqual(test, Buffer.from(hash, "hex"));
}

export async function startSession(staffId: string) {
  (await cookies()).set(COOKIE, `${staffId}.${sign(staffId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getStaff(): Promise<Staff | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  const expected = sign(id);
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const { data } = await db.from("staff").select("id, gym_id, name, phone, role").eq("id", id).single();
  return data;
}

export async function isKiosk() {
  return (await cookies()).has(KIOSK);
}

export async function setKiosk(on: boolean) {
  const jar = await cookies();
  if (on) jar.set(KIOSK, "1", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 12 });
  else jar.delete(KIOSK);
}

export async function requireStaff(role?: "owner", opts?: { kiosk?: boolean }): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  if (!opts?.kiosk && (await cookies()).has(KIOSK)) redirect("/signup");
  if (role && staff.role !== role) redirect("/checkin");
  return staff;
}
