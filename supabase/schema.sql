-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.
-- The app only talks to the DB server-side with the service role key.
-- RLS is enabled with no policies, so the public anon key can read nothing.

create table gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  name text not null,
  phone text,
  role text not null check (role in ('owner', 'desk')),
  pin_hash text not null
);

create table plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  name text not null,
  price numeric(10, 2) not null,
  duration_days int not null
);

create table members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  name text not null,
  phone text not null,
  photo_url text,
  qr_token uuid not null unique default gen_random_uuid(),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Append-only. Only voided_by / voided_at may change, and only by an owner (enforced in app).
create table payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  member_id uuid references members(id),
  kind text not null check (kind in ('membership', 'walkin')),
  amount numeric(10, 2) not null check (amount > 0),
  method text not null check (method in ('cash', 'gcash', 'maya', 'card')),
  staff_id uuid references staff(id),
  paymongo_ref text unique,
  voided_by uuid references staff(id),
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id),
  plan_id uuid not null references plans(id),
  payment_id uuid not null references payments(id),
  start_date date not null,
  end_date date not null
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  member_id uuid not null references members(id),
  staff_id uuid references staff(id),
  override boolean not null default false,
  created_at timestamptz not null default now()
);

-- PayMongo checkout sessions we created, so a paid session maps back to member + plan.
create table checkouts (
  id text primary key,
  gym_id uuid not null references gyms(id),
  member_id uuid not null references members(id),
  plan_id uuid not null references plans(id),
  created_at timestamptz not null default now()
);

-- One row per message. ref_date makes each reminder unique (e.g. one "expiring" per membership end date).
create table sms_log (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id),
  member_id uuid references members(id),
  phone text not null,
  kind text not null,
  ref_date date not null,
  message text not null,
  status text not null default 'queued' check (status in ('queued', 'outbox', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  unique (phone, kind, ref_date)
);

create index on payments (gym_id, created_at);
create index on checkins (gym_id, created_at);
create index on memberships (member_id);

alter table gyms enable row level security;
alter table staff enable row level security;
alter table plans enable row level security;
alter table members enable row level security;
alter table payments enable row level security;
alter table memberships enable row level security;
alter table checkins enable row level security;
alter table checkouts enable row level security;
alter table sms_log enable row level security;

create function ph_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Manila')::date
$$;

-- Status is derived from the latest non-voided membership, never stored.
create view member_status with (security_invoker = true) as
select m.*, s.end_date,
  case
    when s.end_date is null or s.end_date < ph_today() then 'expired'
    when s.end_date <= ph_today() + 3 then 'expiring'
    else 'active'
  end as status,
  s.end_date - ph_today() as days_left
from members m
left join lateral (
  select max(ms.end_date) as end_date
  from memberships ms join payments p on p.id = ms.payment_id
  where ms.member_id = m.id and p.voided_at is null
) s on true;

-- Records a membership payment and extends the membership in one transaction.
-- Idempotent on p_ref, so a PayMongo payment delivered twice only counts once.
create function record_payment(
  p_member uuid, p_plan uuid, p_method text, p_staff uuid, p_ref text default null
) returns uuid language plpgsql as $$
declare
  v_plan plans;
  v_gym uuid;
  v_payment uuid;
  v_end date;
  v_start date;
begin
  select * into v_plan from plans where id = p_plan;
  -- Row lock so two payments for the same member can't both extend from the same end date.
  select gym_id into v_gym from members where id = p_member for update;

  insert into payments (gym_id, member_id, kind, amount, method, staff_id, paymongo_ref)
  values (v_gym, p_member, 'membership', v_plan.price, p_method, p_staff, p_ref)
  on conflict (paymongo_ref) do nothing
  returning id into v_payment;

  if v_payment is null then
    select id into v_payment from payments where paymongo_ref = p_ref;
    return v_payment;
  end if;

  select end_date into v_end from member_status where id = p_member;
  v_start := greatest(ph_today(), coalesce(v_end + 1, ph_today()));

  insert into memberships (member_id, plan_id, payment_id, start_date, end_date)
  values (p_member, p_plan, v_payment, v_start, v_start + v_plan.duration_days - 1);

  return v_payment;
end $$;
