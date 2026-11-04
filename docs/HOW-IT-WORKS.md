# How GymDesk works

A plain-language guide to what the app does, who uses it, and how each part works. Read this before the demo.

---

## 1. The problem in one paragraph

Small gyms in the Philippines track members in a notebook. Payments are cash, sometimes GCash. Nobody notices when a membership expires, so members quietly stop coming and the gym loses money. The owner isn't always at the gym, so they don't know how much was collected today or whether the front desk recorded every peso.

**GymDesk fixes three things:**

| Problem | What GymDesk does |
|---|---|
| Members leave without anyone noticing | Sends a reminder SMS before and after their membership expires, and shows the owner who to follow up today |
| Cash goes missing | Every payment is recorded with the staff name. Staff can't delete payments. Only the owner can void one. |
| Owner doesn't know what's happening | The owner's "Today" page shows money collected, check-ins, walk-ins, and new members |

---

## 2. The three kinds of users

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│    OWNER     │     │   FRONT DESK     │     │    MEMBER    │
│  Mang Rudy   │     │ Ate Joy, Kuya    │     │  Juan, Maria │
│              │     │ Mark             │     │              │
│ Uses: phone  │     │ Uses: tablet at  │     │ Uses: own    │
│              │     │ the door         │     │ phone        │
│ Logs in: yes │     │ Logs in: yes     │     │ Logs in: NO  │
└──────────────┘     └──────────────────┘     └──────────────┘
  Watches money        Checks members in,      Shows QR at the
  and follow-ups.      takes payments,         door, pays by
  Can void payments.   adds new members.       GCash/Maya.
```

**Demo logins** (after `npm run seed`):

| Name | Role | PIN |
|---|---|---|
| Mang Rudy | Owner | `1234` |
| Ate Joy | Front desk | `0000` |
| Kuya Mark | Front desk | `1111` |

The owner sees 5 pages: Today, Check-in, Members, Payments, Reminders.
Front desk sees 3: Check-in, Members, Payments.

---

## 3. The one idea everything depends on: membership status

Every member has an **end date**. The app compares it with today and gives the member one of three colors. The colors come from weight plates (green 10 kg, yellow 15 kg, red 25 kg), so they're easy to remember.

| Color | Status | Rule | What happens at the door |
|---|---|---|---|
| 🟩 Green | Active | More than 3 days left | Checked in automatically |
| 🟨 Yellow | Expiring | 3 days or fewer left | Checked in, but staff should remind them |
| 🟥 Red | Expired | End date has passed, or never paid | **Not** checked in unless staff press "Let in anyway" |

Nobody sets the status by hand. It's calculated fresh every time from the end date.

**How paying changes the end date:**

```
Juan's membership ends Dec 3. He pays Monthly (30 days) on Nov 28.

   Nov 28           Dec 3                          Jan 2
     │ pays           │ old end date                  │ new end date
     ▼                ▼                               ▼
─────●────────────────●───────────────────────────────●──────
                       └──── new 30 days start here ───┘

He doesn't lose the 5 days he already paid for.
If he had already expired, the 30 days start today instead.
```

---

## 4. A day at the gym (the whole app as a story)

**6:00 AM: front desk opens.**
Ate Joy logs in on the tablet with PIN `0000`. She lands on **Check-in**. The camera is on.

**6:15 AM: a member arrives.**
Juan opens his membership card on his phone and holds the QR code to the tablet camera. A big **green** panel appears with his photo and name: "18 days left". He's checked in. Done in 2 seconds.

**6:30 AM: an expired member arrives.**
Maria's QR shows a big **red** panel: "Membership ended Oct 5". Ate Joy asks her to renew. Maria pays ₱1,000 cash. Ate Joy opens Maria on **Members**, presses **Cash** next to Monthly, and Maria turns green.

The payment is saved as "₱1,000, cash, taken by Ate Joy".

**7:00 AM: a walk-in.**
Someone who isn't a member pays ₱100 for one session. Ate Joy types 100 in the **Walk-in** box and presses **Record walk-in**.

**7:15 AM: a friend of the staff.**
Kuya Mark lets in Paolo, whose membership expired, by pressing **Let in anyway**. The app allows it but writes it down. The owner will see it.

**9:00 AM: a member pays by GCash.**
Bea wants to pay by GCash. Ate Joy opens Bea on **Members** and presses **GCash / Maya**. A payment QR appears. Bea scans it with her phone, pays on PayMongo's page, and her membership extends by itself. Nobody has to check a GCash screenshot.

**9:00 PM: the app works while everyone sleeps.**
Every night the app automatically:
1. Finds members with 3 days or fewer left, and members who expired in the last 7 days.
2. Writes each of them a Taglish SMS, for example: *"Hi Ana! Ang membership mo sa Iron Barangay Fitness ay mag-e-expire sa 2 araw. Renew na para tuloy-tuloy ang gains!"*
3. Sends the owner a summary: *"₱2,400 kita, 23 check-ins, 6 walk-ins, 2 renewals, 2 bagong members."*

Each member gets each reminder only once, even if the job runs twice.

**Next morning: the owner checks their phone.**
Mang Rudy opens **Today** and sees:
- ₱2,400 collected yesterday, 23 check-ins, 6 walk-ins, 2 new members.
- "₱9,200 recovered this month: 6 members renewed after a reminder." This is the proof the system pays for itself.
- A yellow warning: "1 expired member was let in by staff."
- **Follow up today**: a list of members expiring or recently expired, each with **Text** and **Call** buttons.

He opens **Payments** and sees "Cash in each drawer": Kuya Mark should hand over ₱1,100 and Ate Joy ₱300. If the drawer is short, he knows.

He notices a mistake: a ₱800 payment recorded twice. He presses **Void**, confirms, and the payment gets a line through it. The 30 days it added are taken back. Front desk staff can't do this. They don't even see the Void button.

---

## 5. Every screen, explained

### Login (`/login`)
Pick your name, type your PIN. The owner goes to Today, front desk goes to Check-in.

### Today (`/`, owner only)
| Part | What it means |
|---|---|
| Collected today | All payments today (cash + GCash + walk-ins), minus voided ones |
| Check-ins / Walk-ins / New members | Counts for today |
| Recovered this month | Money from members who renewed within 14 days after getting a reminder |
| Yellow warning | Expired members let in by staff today |
| Follow up today | Members who need a nudge, sorted by most urgent. Text and Call open the phone's SMS app or dialer. |

### Check-in (`/checkin`)
| Part | What it does |
|---|---|
| Camera | Reads the member's QR code |
| Big colored panel | Green or yellow means checked in. Red means not checked in yet. |
| Let in anyway | Checks in an expired member and records it for the owner |
| "Or type the member code" | Backup if the camera doesn't work |
| Walk-in box | Records a cash day pass |

### Members (`/members`)
| Part | What it does |
|---|---|
| Search, status filter, sort | Find a member by name, show only Active, Expiring, or Expired, and sort by name, end date, or newest |
| Member list | Colored stripe on the left shows status |
| Waiting to pay | Yellow box listing people who signed up in the last 14 days but haven't paid yet. Tap a name to take their payment. |
| New member form | Name, mobile number, photo (optional), first payment (optional), consent checkbox (required by the Data Privacy Act) |
| Let the member fill it in | Turns the tablet into the member sign-up screen (below) |

### Member sign-up screen (`/signup`, on the gym's tablet)
For new members who'd rather type their own details. Staff press **Let the member fill it in** and hand over the tablet.

1. The member types their name and mobile number, takes a selfie with the tablet's front camera, and ticks the consent box.
2. They see "Thanks! Please go to the front desk to pay." The form wipes itself after 10 seconds, so the next person can't see their details.
3. They appear in **Waiting to pay** on the Members page. Staff check their face against the selfie and press **Cash** or **GCash / Maya**. Only then do they turn green.

While the tablet is in sign-up mode:
- The staff menu is hidden, and typing a staff page address goes back to the sign-up screen.
- **Staff: exit sign-up** at the bottom asks for any staff PIN.
- A mobile number that's already registered is refused.

Tip: also turn on Android **screen pinning** (or iPad **Guided Access**) so the member can't switch to another app.

### Member page (`/members/<id>`)
| Part | What it does |
|---|---|
| Photo, name, status | Who they are and until when |
| QR code | Their check-in code. "Open phone card" gives a link to send them. |
| Renew membership | **Cash**: records the payment now. **GCash / Maya**: shows a payment QR for their phone. |
| Payments | Their payment history. Voided ones have a line through them. |
| Recent check-ins | When they came. "Let in while expired" marks overrides. |

### Payments (`/payments`)
| Part | What it does |
|---|---|
| Cash in each drawer | How much cash each staff member should hand over at end of shift |
| Expired members let in today | Who was let in, and by which staff member |
| Today's payments | Every payment today. Owner sees a **Void** button on each. |
| Day picker (owner only) | **◀ / ▶** arrows or the calendar show any past day: its total, drawer cash, overrides, and payments. **Back to today** returns. Front desk always sees today. |
| Day / Week / Month (owner only) | **Week** (Monday–Sunday) and **Month** show the total collected, the change vs the previous period, where the money came from (memberships vs walk-ins, cash vs GCash), and a bar per day. Tap a day to open its payments. An unfinished week or month is compared with the same number of days before (Nov 1–4 vs Oct 1–4), so it doesn't look like a loss. |

### Reminders (`/outbox`, owner only)
Every reminder the app has written. In demo mode (no SMS account connected) messages are shown here instead of being sent. **Send reminders now** runs the nightly job immediately, useful during a demo.

### Member card (`/card/<code>`, no login)
What the member opens on their phone: their name, status, and QR code to show at the door.

---

## 6. Rules the app enforces (good to say in your defense)

1. **Payments can't be edited or deleted.** Only the owner can void, and the voided payment stays visible. This is called an *append-only* record and it stops cash from disappearing.
2. **Expired members are blocked by default.** Letting them in is possible but always logged.
3. **Status is never stored, only calculated.** So it can never be out of date.
4. **One reminder per member per expiry.** Re-running the reminder job never double-texts anyone.
5. **A GCash payment counts once,** even if PayMongo tells the app about it twice.
6. **Consent is required** before saving a member's name, phone, and photo (Data Privacy Act, RA 10173).
7. **Staff only see their own gym's data,** checked on the server for every action.
8. **Signing up never lets anyone in.** A self sign-up waits as "not yet paid" until staff take payment.

---

## 7. What's real and what's demo

| Feature | In the demo | When a gym actually pays |
|---|---|---|
| Hosting | Your laptop, or Vercel free tier | Vercel Pro (about $20/month) |
| Database | Supabase free tier | Same, or a paid plan as it grows |
| GCash / Maya | PayMongo **test mode**: no real money moves | PayMongo live mode (about 2–3% fee per payment) |
| SMS reminders | Shown on the Reminders page, **not sent** | Semaphore account (about ₱0.50 per SMS) |
| Members | 50 fake members from `npm run seed` | The gym's real members |

---

## 8. How the pieces connect (for the technical part of your paper)

```
 Tablet / phone browser
          │
          ▼
 ┌──────────────────────┐       ┌───────────────────────┐
 │  Next.js app         │──────▶│ Supabase (Postgres)   │
 │  (pages + server     │       │ members, payments,    │
 │   actions)           │◀──────│ memberships, checkins │
 └──────────────────────┘       └───────────────────────┘
     │            ▲
     │            │ "payment paid" (webhook)
     ▼            │
 ┌──────────┐  ┌──────────┐
 │Semaphore │  │ PayMongo │   ◀── member pays here by GCash/Maya
 │  (SMS)   │  │          │
 └──────────┘  └──────────┘
     ▲
     │ every night 9 PM
 Vercel Cron
```

**Where things live in the code:**

| What | File |
|---|---|
| Database tables and rules | [supabase/schema.sql](../supabase/schema.sql) |
| Every button's server logic (check in, pay, void, add member) | [src/app/actions.ts](../src/app/actions.ts) |
| Login and PINs | [src/lib/auth.ts](../src/lib/auth.ts) |
| GCash / Maya (PayMongo) | [src/lib/paymongo.ts](../src/lib/paymongo.ts) |
| Nightly reminders and owner summary | [src/lib/reminders.ts](../src/lib/reminders.ts) |
| Pages | `src/app/<page>/page.tsx` |
| QR scanner | [src/app/checkin/scanner.tsx](../src/app/checkin/scanner.tsx) |
| UI building blocks (buttons, cards, dialogs) | [src/components/ui/](../src/components/ui/) |
| Fake demo data | [scripts/seed.mjs](../scripts/seed.mjs) |

**Database tables in one line each:**

| Table | Holds |
|---|---|
| `gyms` | The gym (ready for more than one gym later) |
| `staff` | Owner and desk staff, with hashed PINs |
| `plans` | Monthly ₱1,000, Student ₱800, 3 Months ₱2,700 |
| `members` | Name, phone, photo, QR code |
| `payments` | Every peso: amount, method, who took it, voided or not |
| `memberships` | Start and end date created by each payment |
| `checkins` | Every visit, and whether it was an override |
| `checkouts` | GCash/Maya payment sessions waiting to be paid |
| `sms_log` | Every reminder written or sent |

---

## 9. Common questions

**Why can't I log in?**
Run `npm run seed` first, then use one of the PINs above.

**Why is the dashboard empty?**
The database has no data. Run `npm run seed`. It wipes everything and loads 50 demo members.

**Why didn't the SMS send?**
Demo mode. Messages appear on the Reminders page instead. Real sending needs a Semaphore account.

**GCash says it isn't set up.**
Add your PayMongo test key (`sk_test_...`) as `PAYMONGO_SECRET_KEY` in `.env.local`, then restart `npm run dev`.

**The camera doesn't open.**
Allow camera access in the browser. Or type the member code (shown on the member page) under the camera.

**Does it work without internet?**
Not yet. Offline check-in is planned for phase 2 (see [design doc](design/gym-membership.md)).

**How do I reset the demo?**
`npm run seed`. It deletes everything and reloads fresh demo data.
