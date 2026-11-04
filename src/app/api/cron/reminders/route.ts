import { db } from "@/lib/db";
import { runReminders } from "@/lib/reminders";

// Vercel Cron calls this nightly with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  const { data: gyms } = await db.from("gyms").select("id");
  let processed = 0;
  for (const g of gyms ?? []) processed += await runReminders(g.id);
  return Response.json({ processed });
}
