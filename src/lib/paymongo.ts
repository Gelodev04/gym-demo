import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";

const API = "https://api.paymongo.com/v1";

function headers() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return {
    Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
    "Content-Type": "application/json",
  };
}

export async function createCheckout(opts: {
  gymId: string;
  memberId: string;
  plan: { id: string; name: string; price: number };
  origin: string;
}) {
  const res = await fetch(`${API}/checkout_sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ currency: "PHP", amount: Math.round(opts.plan.price * 100), name: opts.plan.name, quantity: 1 }],
          payment_method_types: ["gcash", "paymaya", "card"],
          description: `Gym membership: ${opts.plan.name}`,
          success_url: `${opts.origin}/pay/return?member=${opts.memberId}`,
          cancel_url: `${opts.origin}/pay/return?member=${opts.memberId}`,
          show_line_items: true,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`PayMongo: ${res.status} ${await res.text()}`);
  const { data } = await res.json();
  await db.from("checkouts").insert({ id: data.id, gym_id: opts.gymId, member_id: opts.memberId, plan_id: opts.plan.id });
  return data.attributes.checkout_url as string;
}

// Asks PayMongo for the session's real state (never trusts a payload) and records it once.
// Called by the webhook and by the return page, so the demo also works on localhost without webhooks.
export async function syncCheckout(sessionId: string) {
  const { data: checkout } = await db.from("checkouts").select("*").eq("id", sessionId).single();
  if (!checkout) return false;

  const res = await fetch(`${API}/checkout_sessions/${sessionId}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return false;
  const payment = (await res.json()).data.attributes.payments?.[0];
  if (payment?.attributes.status !== "paid") return false;

  const source = payment.attributes.source?.type;
  const method = source === "gcash" ? "gcash" : source === "paymaya" ? "maya" : "card";
  const { error } = await db.rpc("record_payment", {
    p_member: checkout.member_id,
    p_plan: checkout.plan_id,
    p_method: method,
    p_staff: null,
    p_ref: payment.id,
  });
  if (error) throw error;
  return true;
}

// Checks this member's sessions from the last 2 hours; true if any is paid.
export async function syncRecentCheckouts(memberId: string) {
  const since = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const { data: sessions } = await db.from("checkouts").select("id").eq("member_id", memberId).gte("created_at", since);
  const results = await Promise.all((sessions ?? []).map((s) => syncCheckout(s.id)));
  return results.some(Boolean);
}

// Header format: "t=<timestamp>,te=<test sig>,li=<live sig>"
export function verifyWebhook(rawBody: string, header: string | null) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const sig = parts.li || parts.te;
  if (!parts.t || !sig) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
