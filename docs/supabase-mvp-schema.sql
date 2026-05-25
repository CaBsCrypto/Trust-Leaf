-- Trust Leaf Supabase MVP schema
-- Scope: actor onboarding only. Do not store clinical records, exams or legal
-- documents in these tables.

create table if not exists public.doctor_applications (
  id text primary key,
  name text not null,
  license_id text not null,
  specialty text not null,
  contact text not null,
  wallet text not null,
  status text not null default 'pending'
    check (status in ('pending', 'needs_review', 'approved', 'rejected')),
  onchain_status text not null default 'pending'
    check (onchain_status in ('pending', 'registered', 'failed')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text,
  metadata_hash text
);

create table if not exists public.dispensary_applications (
  id text primary key,
  name text not null,
  legal_id text not null,
  address text not null,
  contact text not null,
  wallet text not null,
  status text not null default 'pending'
    check (status in ('pending', 'needs_review', 'approved', 'rejected')),
  onchain_status text not null default 'pending'
    check (onchain_status in ('pending', 'registered', 'failed')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text,
  metadata_hash text
);

create index if not exists doctor_applications_submitted_at_idx
  on public.doctor_applications (submitted_at desc);

create index if not exists doctor_applications_status_idx
  on public.doctor_applications (status);

create index if not exists doctor_applications_wallet_idx
  on public.doctor_applications (wallet);

create index if not exists dispensary_applications_submitted_at_idx
  on public.dispensary_applications (submitted_at desc);

create index if not exists dispensary_applications_status_idx
  on public.dispensary_applications (status);

create index if not exists dispensary_applications_wallet_idx
  on public.dispensary_applications (wallet);

alter table public.doctor_applications enable row level security;
alter table public.dispensary_applications enable row level security;

-- Public applications: doctors and dispensaries can request access from the
-- landing/app without an account. Admin review should be protected later with
-- Supabase Auth and an admin allowlist.
drop policy if exists "public can submit doctor applications" on public.doctor_applications;
create policy "public can submit doctor applications"
  on public.doctor_applications
  for insert
  to anon
  with check (status = 'pending' and onchain_status = 'pending');

drop policy if exists "public can submit dispensary applications" on public.dispensary_applications;
create policy "public can submit dispensary applications"
  on public.dispensary_applications
  for insert
  to anon
  with check (status = 'pending' and onchain_status = 'pending');

-- Temporary demo policies.
-- Use these only for a clean demo project with no sensitive data. They let the
-- browser admin screen read/update applications with the anon key. Remove them
-- before pilots with real actors.
drop policy if exists "demo can read doctor applications" on public.doctor_applications;
create policy "demo can read doctor applications"
  on public.doctor_applications
  for select
  to anon
  using (true);

drop policy if exists "demo can review doctor applications" on public.doctor_applications;
create policy "demo can review doctor applications"
  on public.doctor_applications
  for update
  to anon
  using (true)
  with check (status in ('pending', 'needs_review', 'approved', 'rejected'));

drop policy if exists "demo can read dispensary applications" on public.dispensary_applications;
create policy "demo can read dispensary applications"
  on public.dispensary_applications
  for select
  to anon
  using (true);

drop policy if exists "demo can review dispensary applications" on public.dispensary_applications;
create policy "demo can review dispensary applications"
  on public.dispensary_applications
  for update
  to anon
  using (true)
  with check (status in ('pending', 'needs_review', 'approved', 'rejected'));

-- Production direction:
-- 1. Add Supabase Auth.
-- 2. Create an app_admins table with authenticated user ids.
-- 3. Replace the temporary demo select/update policies with authenticated
--    admin-only policies.
-- 4. Store clinical files in encrypted storage, never in these tables.
