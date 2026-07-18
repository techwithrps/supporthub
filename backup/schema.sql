-- ============================================
-- SUYOG SUPPORT SYSTEM — Consolidated Schema Setup
-- Run this script in the Supabase SQL Editor on a fresh database
-- ============================================

-- 1. TICKETS TABLE (Support Query submissions)
create table if not exists tickets (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  tally_serial text not null,
  email text not null,
  mobile text not null,
  issue_type text not null,
  description text not null,
  status text default 'pending' check (status in ('pending', 'assigned', 'resolved')),
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  resolved_at timestamptz,
  push_token text,
  is_escalated boolean default false,
  escalation_reason text,
  feedback jsonb default '{"rating": null, "comments": null, "resolution_notes": null}',
  created_at timestamptz default now()
);

-- 2. ENQUIRIES TABLE (Callback Lead Enquiries)
create table if not exists enquiries (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone text not null,
  details text not null,
  enquiry_type text,
  status text default 'pending' check (status in ('pending', 'in_progress', 'converted', 'not_converted')),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz default now()
);

-- 3. PROFILES TABLE (Employee details synced with auth.users)
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  created_at timestamptz default now()
);

-- ============================================
-- ENABLE REALTIME (Live Updates on Dashboard)
-- ============================================
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table tickets;
alter publication supabase_realtime add table enquiries;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- 1. TICKETS POLICIES
alter table tickets enable row level security;

create policy "Anyone can insert tickets"
  on tickets for insert
  with check (true);

create policy "Anyone can view tickets"
  on tickets for select
  using (true);

create policy "Employees can update tickets"
  on tickets for update
  using (auth.role() = 'authenticated');

-- 2. ENQUIRIES POLICIES
alter table enquiries enable row level security;

create policy "Anyone can insert enquiries"
  on enquiries for insert
  with check (true);

create policy "Employees can view enquiries"
  on enquiries for select
  using (auth.role() = 'authenticated');

create policy "Employees can update enquiries"
  on enquiries for update
  using (auth.role() = 'authenticated');

-- 3. PROFILES POLICIES
alter table profiles enable row level security;

create policy "Authenticated can view profiles"
  on profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can upsert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- ============================================
-- AUTH TRIGGER: AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
