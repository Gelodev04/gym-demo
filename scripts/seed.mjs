// Demo data. WIPES all existing data, then seeds one gym.
// Run: npm run seed         (gym, staff, plans + 50 demo members with history)
//      npm run seed:empty   (gym, staff, plans only: no members, no money)
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const DAY = 86_400_000;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const dateOffset = (days) => new Date(Date.parse(`${today}T00:00:00+08:00`) + days * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
// A PH-local timestamp `days` from today at `hour`:`minute`.
const at = (days, hour, minute = 0) => new Date(Date.parse(`${dateOffset(days)}T00:00:00+08:00`) + (hour * 60 + minute) * 60_000).toISOString();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
}

async function must(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

// Wipe in FK order.
for (const t of ["sms_log", "checkouts", "checkins", "memberships", "payments", "members", "plans", "staff", "gyms"]) {
  await must(db.from(t).delete().not("id", "is", null));
}

await db.storage.createBucket("photos", { public: true }).catch(() => {});

const gym = (await must(db.from("gyms").insert({ name: "Iron Barangay Fitness" }).select()))[0];
const [, joy, mark] = await must(
  db
    .from("staff")
    .insert([
      { gym_id: gym.id, name: "Mang Rudy", role: "owner", phone: "09000000001", pin_hash: hashPin("1234") },
      { gym_id: gym.id, name: "Ate Joy", role: "desk", pin_hash: hashPin("0000") },
      { gym_id: gym.id, name: "Kuya Mark", role: "desk", pin_hash: hashPin("1111") },
    ])
    .select(),
);
const desk = [joy, mark];

const plans = await must(
  db
    .from("plans")
    .insert([
      { gym_id: gym.id, name: "Monthly", price: 1000, duration_days: 30 },
      { gym_id: gym.id, name: "Student Monthly", price: 800, duration_days: 30 },
      { gym_id: gym.id, name: "3 Months", price: 2700, duration_days: 90 },
    ])
    .select(),
);

if (process.argv.includes("--empty")) {
  console.log(`Reset ${gym.name}: staff and plans only, no members or payments.`);
  console.log("Logins: Mang Rudy (owner) PIN 1234 · Ate Joy (desk) PIN 0000 · Kuya Mark (desk) PIN 1111");
  process.exit(0);
}

const first = ["Juan", "Maria", "Jose", "Ana", "Mark", "Kristine", "John Paul", "Angelica", "Carlo", "Jasmine", "Paolo", "Bea", "Miguel", "Camille", "Rafael", "Nicole", "Gabriel", "Patricia", "Joshua", "Trisha", "Kevin", "Erika", "Bryan", "Shiela", "Renz"];
const last = ["Santos", "Reyes", "Cruz", "Bautista", "Garcia", "Mendoza", "Torres", "Villanueva", "Ramos", "Aquino", "Castillo", "Flores", "Dela Cruz", "Navarro", "Pascual"];

// days_left for each member's current membership end date
const scenarios = [
  ...Array.from({ length: 30 }, () => rand(4, 28)), // active
  ...[0, 1, 1, 2, 2, 3, 3, 3], // expiring this week
  ...[-1, -2, -3, -4, -5, -6, -7], // recently expired
  ...[-30, -45, -60, -75, -90], // long gone
];

const members = [], payments = [], memberships = [], checkins = [], sms = [];

scenarios.forEach((daysLeft, i) => {
  const plan = i % 5 === 0 ? plans[2] : i % 3 === 0 ? plans[1] : plans[0];
  const member = {
    id: randomUUID(),
    gym_id: gym.id,
    name: `${pick(first)} ${pick(last)}`,
    // 0900 numbers are placeholders; never set SEMAPHORE_API_KEY with seeded data.
    phone: `0900${String(1000000 + i).slice(1)}`,
    created_at: at(i < 2 ? 0 : -rand(100, 300), 9),
  };
  members.push(member);

  const start = daysLeft - plan.duration_days + 1;
  const payment = {
    id: randomUUID(),
    gym_id: gym.id,
    member_id: member.id,
    kind: "membership",
    amount: plan.price,
    method: pick(["cash", "cash", "gcash"]),
    staff_id: pick(desk).id,
    created_at: at(start, rand(7, 11)),
  };
  if (payment.method === "gcash") {
    payment.staff_id = null;
    payment.paymongo_ref = `pay_demo_${i}`;
  }
  payments.push(payment);
  memberships.push({ member_id: member.id, plan_id: plan.id, payment_id: payment.id, start_date: dateOffset(start), end_date: dateOffset(daysLeft) });

  // Some active members renewed this month after getting an "expiring" SMS: feeds "recovered" on the dashboard.
  if (i < 6) {
    const reminderDay = -rand(1, 3);
    sms.push({
      gym_id: gym.id,
      member_id: member.id,
      phone: member.phone,
      kind: "expiring",
      ref_date: dateOffset(start - 1),
      message: `Hi ${member.name.split(" ")[0]}! Ang membership mo sa ${gym.name} ay mag-e-expire sa 2 araw. Renew na para tuloy-tuloy ang gains!`,
      status: "outbox",
      created_at: at(reminderDay, 21),
    });
    payment.created_at = at(reminderDay + 1, rand(7, 11));
  }

  // Check-in history for current members.
  if (daysLeft >= 0) {
    for (let d = -14; d < 0; d++) if (Math.random() < 0.45) checkins.push({ gym_id: gym.id, member_id: member.id, staff_id: pick(desk).id, override: false, created_at: at(d, rand(6, 21), rand(0, 59)) });
    if (Math.random() < 0.5) checkins.push({ gym_id: gym.id, member_id: member.id, staff_id: pick(desk).id, override: false, created_at: at(0, rand(6, 8), rand(0, 59)) });
  }
});

// One expired member let in today by staff override (shows up for owner review).
const expired = members[scenarios.indexOf(-2)];
checkins.push({ gym_id: gym.id, member_id: expired.id, staff_id: mark.id, override: true, created_at: at(0, 7, 15) });

// Walk-ins today.
for (let i = 0; i < 6; i++) payments.push({ id: randomUUID(), gym_id: gym.id, kind: "walkin", amount: 100, method: "cash", staff_id: pick(desk).id, created_at: at(0, rand(6, 8), rand(0, 59)) });

await must(db.from("members").insert(members));
await must(db.from("payments").insert(payments));
await must(db.from("memberships").insert(memberships));
await must(db.from("checkins").insert(checkins));
await must(db.from("sms_log").insert(sms));

console.log(`Seeded ${gym.name}: ${members.length} members, ${payments.length} payments, ${checkins.length} check-ins.`);
console.log("Logins: Mang Rudy (owner) PIN 1234 · Ate Joy (desk) PIN 0000 · Kuya Mark (desk) PIN 1111");
