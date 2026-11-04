# Gym Membership System for Small Philippine Gyms

Status: first-pass design (capstone MVP, with a path to a multi-gym product).

## 1. Problem

Small PH gyms run on notebooks, Facebook Messenger, and cash. Owners lose money in three ways:

- **Silent churn** — memberships expire and nobody follows up.
- **Cash leakage** — front-desk payments are not reliably recorded.
- **No visibility** — owners are often off-site and don't know the day's numbers.

The system targets these three pains first. Every MVP feature should map to one of them.

## 2. Requirements

### Functional (MVP)

1. **Member records** — name, phone, photo, plan, membership dates.
2. **QR check-in** — member shows QR (phone or printed card); front-desk tablet scans and shows photo + status (active / expiring / expired).
3. **Payments** — cash recorded by staff; GCash/Maya via PayMongo payment links, recorded automatically by webhook. Paying extends the membership.
4. **Cash accountability** — every payment logs staff, time, method. Payments are append-only; voids require owner approval. End-of-shift cash count vs. system total.
5. **Expiry radar + reminders** — dashboard of expiring this week / expired not renewed. Auto SMS at 3 days before and on expiry day (Taglish templates).
6. **Owner daily summary** — at closing, SMS/notification with revenue, check-ins, new members, renewals, walk-ins.
7. **Walk-ins / day passes** — record and charge single sessions.

### Functional (Phase 2)

- At-risk members (no check-in in 14 days) with "miss you" SMS.
- Membership freeze.
- PT/coach session packages and commission.
- Mini-POS (water, supplements, locker rental).
- Promos: student rate, referral credit.
- Peak-hours heatmap.
- Multi-branch support.

### Non-functional

- Works on low-end Android tablets and phones (PWA, mobile-first).
- Check-in keeps working during internet outages.
- Payment records are tamper-evident (append-only, audit trail).
- Member personal data handled per the Data Privacy Act (RA 10173): consent at sign-up, access limited by role.
- Running cost low enough for a small gym (target: under ~₱1,000/month including SMS).

### Out of scope

- Workout or diet tracking app for members.
- Wearable integrations.
- Issuing official BIR receipts (requires BIR accreditation). The system produces internal sales reports only.

### Assumptions

- One gym, ~300 active members, ~150 check-ins/day, peak ~40/hour.
- One front-desk tablet, one owner, 2–4 staff.
- Internet at the front desk is unreliable.

## 3. Scale Estimate

| Metric | Estimate |
|---|---|
| Request rate | ~0.01 requests/second average; peak well under 1/second |
| Storage | < 100 MB/year (photos dominate; compress to ~50 KB each) |
| SMS volume | ~600/month (~₱300/month on Semaphore; verify current rates) |

Conclusion: a single application and a single database are more than enough. No microservices, cache, or message queue are justified at this size.

## 4. High-Level Design

```
[Front desk tablet PWA]──┐
[Owner phone PWA]────────┼──> [Next.js monolith] ──> [Postgres (Supabase)]
[Member phone: QR/pay]───┘         │   ▲
                                   │   └── PayMongo webhook (payment.paid)
                                   ├──> Semaphore SMS
                                   └── daily cron: reminders, owner summary
```

- **Clients**: one PWA with three role views — front desk, owner, member.
- **Backend**: Next.js monolith (UI + API routes), deployed on Vercel.
- **Database**: Postgres on Supabase, with Row Level Security (RLS) scoping rows by `gym_id`.
- **Payments**: PayMongo payment links; webhook marks payment paid and extends membership.
- **SMS**: Semaphore.
- **Scheduled jobs**: a daily cron sends expiry reminders and the owner summary.

### Data model

| Table | Key columns |
|---|---|
| `gyms` | id, name, sms_sender_name |
| `staff` | id, gym_id, name, role (`owner` / `desk`), pin_hash |
| `members` | id, gym_id, name, phone, photo_url, qr_token (unique), consent_at |
| `plans` | id, gym_id, name, price, duration_days |
| `memberships` | id, member_id, plan_id, start_date, end_date |
| `payments` | id, gym_id, member_id, amount, method (`cash` / `gcash` / `maya`), staff_id, paymongo_ref (unique, nullable), voided_by, voided_at, created_at |
| `checkins` | id, gym_id, member_id, staff_id, created_at |
| `sms_log` | id, member_id, kind, sent_on, status |

Notes:

- Membership status is **derived** from `end_date` (active / expiring within 3 days / expired), never stored as a flag.
- `payments` rows are never updated or deleted except to set `voided_by` / `voided_at`, which only an owner can do.
- `sms_log` has a unique constraint on (`member_id`, `kind`, `sent_on`) so a reminder is never sent twice.

### API (core endpoints)

| Endpoint | Purpose | Response |
|---|---|---|
| `POST /api/checkins` `{qr_token}` | Scan at the door | `{member, photo_url, status, days_left}` |
| `POST /api/payments` `{member_id, plan_id, amount, method}` | Record cash payment | payment + new `end_date` |
| `POST /api/payments/:id/void` | Owner voids a payment | voided payment |
| `POST /api/payment-links` `{member_id, plan_id}` | Create PayMongo link | `{checkout_url}` |
| `POST /api/webhooks/paymongo` | Payment confirmed | 200; idempotent on `paymongo_ref` |
| `GET /api/dashboard/today` | Owner dashboard | revenue, check-ins, expiring, walk-ins |
| `GET /api/members?status=expiring` | Expiry radar | member list |

## 5. Decisions and Trade-offs

| Decision | Solves | Worsens | Change it when… |
|---|---|---|---|
| Monolith + one Postgres | Fast to build, cheap, one deploy; fits a capstone team | All features deploy together | More than ~50 gyms, or a separate team owns payments |
| Shared DB with `gym_id` + RLS | One codebase serves many gyms (business path) | A bad query or RLS bug could expose another gym's data | A large client demands separate data |
| Offline-capable PWA at the front desk | Check-in works during outages | Sync conflicts; cached member list can be stale | Gym has stable fiber plus a backup connection |
| PayMongo payment links (not GCash screenshots) | Auto-recorded, no fake screenshots, auto-extends membership | ~2–3% transaction fee; webhook setup | Owner refuses fees → fall back to manual entry with reference number |
| Append-only payments, owner-only voids | Stops cash leakage; clean audit trail | Staff mistakes need the owner to fix | Owner trusts staff and wants less friction (make it a setting) |
| SMS rather than Messenger | Reaches everyone; no Meta app review | Costs per message | Messenger API approval is granted → switch, since it's free |
| Status derived from `end_date` | No stale flags, no cleanup job | Slightly more complex queries | Effectively never at this scale |

## 6. Failure Modes

| Failure | Behaviour |
|---|---|
| Internet down at front desk | Tablet validates against a cached member list and queues check-ins in IndexedDB; syncs when back online |
| PayMongo webhook delivered twice | Unique `paymongo_ref` makes the second delivery a no-op |
| Semaphore down | Failed sends stay unsent in `sms_log`; next cron run retries |
| Staff tampers with payments | Payments cannot be deleted; voids need owner; shift cash count exposes gaps |
| Tablet lost or stolen | Staff log in with personal PINs; owner can revoke sessions remotely |

## 7. Weakest Point

**Offline check-in with a stale cache.** A member renews online while the tablet is offline, and the door wrongly shows them as expired.

Mitigation: when online, look up the member on every scan instead of trusting the cache; when offline, allow a staff override that is logged and shown to the owner for review.

Next move when the gym grows to 2+ branches: share members across branches and sync them in near real time.

## 8. Demo Deployment (₱0)

For the client demo, everything runs on free tiers. No paid services until the gym commits.

| Component | Free option | Limit to watch |
|---|---|---|
| Hosting | Vercel Hobby (`*.vercel.app` URL) | Non-commercial use only; move to Pro (~$20/month) once the gym pays |
| Database + photo storage | Supabase Free | 500 MB DB, 1 GB storage; project pauses after ~7 days of inactivity |
| Payments | PayMongo test mode | No real money moves; uses test cards and test GCash flow |
| SMS reminders | Demo outbox screen showing each message that would be sent | No real SMS; switch to Semaphore when the gym pays |
| Daily cron | Vercel Cron (Hobby: once per day) | Add an owner-only "Run reminders now" button for the demo |

Demo checklist:

1. Open the Supabase project the day before so it is not paused.
2. Seed realistic data: ~50 members, some expiring this week, some expired, a few cash payments by different staff.
3. Have the app running locally (`npm run dev`) as a backup in case the venue's internet fails; bring a phone hotspot.
4. Demo order: owner daily summary → expiry radar + outbox → QR check-in (show an expired member flagged red) → GCash payment in test mode extending a membership → void attempt by desk staff being blocked.

## 9. Open Questions for the Partner Gym

1. What is the cash vs. GCash split today?
2. Is the owner usually on site?
3. How many walk-ins per day?
4. How reliable is the internet at the front desk?
