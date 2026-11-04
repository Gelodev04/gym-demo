import { syncCheckout, verifyWebhook } from "@/lib/paymongo";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers.get("paymongo-signature"))) return new Response("bad signature", { status: 401 });
  const event = JSON.parse(raw).data.attributes;
  if (event.type === "checkout_session.payment.paid") await syncCheckout(event.data.id);
  return Response.json({ ok: true });
}
