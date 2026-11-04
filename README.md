# GymDesk

Membership, QR check-in, and payments for small Philippine gyms.

- New to the app? Start with [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md).
- Design and trade-offs: [docs/design/gym-membership.md](docs/design/gym-membership.md).

Stack: Next.js 16 (App Router), Supabase Postgres + Storage, PayMongo (test mode), Semaphore SMS (optional), Vercel. All free tiers.

## Demo logins

After `npm run seed`, pick a name on the login screen and enter its PIN:

| Name | Role | PIN | Can use |
|---|---|---|---|
| Mang Rudy | Owner | `1234` | Everything, including voiding payments and reminders |
| Ate Joy | Front desk | `0000` | Check-in, Members, Payments (no void) |
| Kuya Mark | Front desk | `1111` | Check-in, Members, Payments (no void) |

## How the app works

### Who uses it

- **Owner**: watches the money and follows up members who are about to leave. Usually on their phone, often not at the gym.
- **Front desk staff**: check members in, take payments, sign up new members. Usually on a tablet at the door.
- **Members**: show their QR at the door and pay by GCash/Maya on their own phone. They never log in.

### Membership status

Every member is in one of three states, shown with the same color everywhere (taken from weight-plate colors):

| Color | Status | Meaning |
|---|---|---|
| Green | Active | More than 3 days left |
| Yellow | Expiring | 3 days or fewer left |
| Red | Expired | End date has passed, or no plan yet |

Status is calculated from the membership end date each time. Nobody sets it by hand. Paying extends the end date. If a member renews early, the new period starts the day after the current one ends, so they never lose days.

### Screens

**Today** (owner only, `/`)
- Money collected today, check-ins, walk-ins, and new members.
- "Recovered this month": money from members who renewed within 14 days of getting a reminder. This is the number that shows the owner the system pays for itself.
- A warning when staff let an expired member in.
- "Follow up today": members expiring this week or expired in the last 7 days, with Text and Call buttons that open the phone's SMS app or dialer.

**Check-in** (`/checkin`)
- The camera reads the member's QR. A big panel shows their photo, name, and status in green, yellow, or red.
- Green and yellow are checked in automatically. Red is not. Staff can press "Let in anyway", and the owner sees it on Today and Payments.
- If the camera doesn't work, type the member code under the camera.
- Walk-ins: enter the day-pass amount and press Record walk-in.

**Members** (`/members`)
- Search by name and filter by status.
- New member: name, mobile number, optional photo (taken with the tablet camera), and an optional first payment in cash. The consent checkbox is required under the Data Privacy Act.
- Member page: their QR code, renew buttons, payment history, and recent check-ins.
  - **Cash**: records the payment under the logged-in staff member and extends the membership right away.
  - **GCash / Maya**: shows a payment QR. The member scans it with their phone and pays on PayMongo. When payment succeeds, the membership extends automatically.

**Payments** (`/payments`)
- "Cash in each drawer": how much cash each staff member took today. Compare it with the actual cash at end of shift.
- Expired members let in today, and by whom.
- All of today's payments. Payments can't be edited or deleted. Only the owner can void one, and a voided payment stays visible with a line through it. Voiding a membership payment also takes back the days it added.

**Reminders** (owner only, `/outbox`)
- Every night at 9 PM, the app writes a Taglish SMS to each member who is expiring (3 days or fewer) or expired in the last 7 days, plus a daily summary for the owner.
- Each member gets each reminder only once, even if the job runs again.
- In demo mode (no Semaphore key), messages are listed here instead of being sent. Press **Send reminders now** to run it during a demo.

**Member card** (`/card/<code>`, public)
- A page the member opens on their phone to show their QR and status at the door. The link is on the member page.

## Demo script

1. Log in as **Mang Rudy** (`1234`). Show **Today**: money collected, the recovered amount, the override warning, and the follow-up list.
2. Open **Reminders** and press **Send reminders now**. Show the Taglish messages.
3. Open **Members**, filter by **Expired**, and open a member. Copy their member code.
4. Open **Check-in**, paste the code, and press **Check in**. The red panel appears. Press **Let in anyway**.
5. Go back to the member and press **GCash / Maya**. Scan the payment QR with a phone and pay with PayMongo's test flow. The member turns green.
6. Log out and log in as **Ate Joy** (`0000`). Open **Payments**: there's no Void button. Log back in as the owner and void a payment. The drawer total drops.

## Setup (about 15 minutes)

1. **Supabase**: create a free project at supabase.com. Open **SQL Editor**, paste [supabase/schema.sql](supabase/schema.sql), and run it.
2. **PayMongo**: sign up at paymongo.com and copy the **test** secret key (`sk_test_...`) from Developers → API keys.
3. **Env**: copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API Keys. Use the **secret** key (`sb_secret_...`), not the publishable one.
   - `SESSION_SECRET`: any long random string.
   - `PAYMONGO_SECRET_KEY`: the test key.
4. **Install and seed**:
   ```bash
   npm install
   npm run seed        # WIPES the database, then loads 50 demo members
   npm run seed:empty  # WIPES the database, keeps only staff logins and plans
   npm run dev
   ```
5. Open http://localhost:3000/login.

## Deploy to Vercel (free)

1. Push to GitHub and import the repo at vercel.com (Hobby plan).
2. Add the same env vars, plus `CRON_SECRET` (any random string).
3. The nightly reminders job (9 PM PH time) is set up in [vercel.json](vercel.json).
4. Optional: in PayMongo, add a webhook to `https://<your-app>.vercel.app/api/webhooks/paymongo` for the event `checkout_session.payment.paid`, then set `PAYMONGO_WEBHOOK_SECRET`. Without it, payments still record when the payer returns to the success page.

Before the demo, open the Supabase project so it isn't paused (free projects pause after about a week of inactivity).

## Notes

- Seeded phone numbers are `0900...` placeholders. Do **not** set `SEMAPHORE_API_KEY` while using seed data.
- Vercel Hobby is for non-commercial use. Move to Pro once a gym pays.
- Not built yet: offline check-in, membership freeze, PT packages, POS, multi-branch. See phase 2 in the design doc.
