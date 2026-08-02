-- ============================================================
-- Selah — Supabase schema
-- Run top to bottom in the SQL Editor. Safe to re-run.
-- ============================================================

-- ---------- profiles: the public face of a pilgrim ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  handle        text unique not null check (handle ~ '^[a-z0-9_]{2,20}$'),
  display_name  text,
  avatar        text,
  -- denormalised so a friends list is one cheap read
  streak        int  default 0,
  chapters_read int  default 0,
  memorized     int  default 0,
  total_xp      int  default 0,
  current_book  text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ---------- the synced blob ----------
create table if not exists public.progress (
  user_id    uuid primary key references auth.users on delete cascade,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ---------- kept / highlighted verses ----------
create table if not exists public.highlights (
  user_id    uuid references auth.users on delete cascade,
  ref        text not null,
  text       text,
  color      text default 'gold',
  created_at timestamptz default now(),
  primary key (user_id, ref)
);

-- ---------- friendship edges ----------
create table if not exists public.friendships (
  requester  uuid references auth.users on delete cascade,
  addressee  uuid references auth.users on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- ---------- web push endpoints ----------
create table if not exists public.push_subs (
  endpoint         text primary key,
  user_id          uuid references auth.users on delete cascade,
  p256dh           text not null,
  "auth"           text not null,
  tz               text default 'UTC',
  verse_on         boolean default false,
  verse_time       text default '07:00',
  lesson_on        boolean default false,
  lesson_time      text default '20:00',
  last_verse_sent  date,
  last_lesson_sent date,
  created_at       timestamptz default now()
);
create index if not exists push_subs_user_idx on public.push_subs(user_id);

-- ============================================================
-- helpers
-- ============================================================
create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b)
        or (f.requester = b and f.addressee = a))
  );
$$;

-- Lookup by handle WITHOUT exposing the whole profile table to strangers.
create or replace function public.find_profile(h text)
returns table (id uuid, handle text, display_name text, avatar text)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle, p.display_name, p.avatar
  from public.profiles p
  where p.handle = lower(trim(both '@' from h))
  limit 1;
$$;
grant execute on function public.find_profile(text) to authenticated;

-- ============================================================
-- row level security
-- ============================================================
alter table public.profiles   enable row level security;
alter table public.progress   enable row level security;
alter table public.highlights enable row level security;
alter table public.friendships enable row level security;
alter table public.push_subs  enable row level security;

-- profiles: you own yours; friends may read yours. Strangers go through find_profile().
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.are_friends(auth.uid(), id));
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- progress: strictly yours
drop policy if exists progress_all on public.progress;
create policy progress_all on public.progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- highlights: yours to write, friends may read
drop policy if exists highlights_read on public.highlights;
create policy highlights_read on public.highlights for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
drop policy if exists highlights_write on public.highlights;
create policy highlights_write on public.highlights for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- friendships: you can see and make edges you're part of; only the addressee accepts
drop policy if exists fr_read on public.friendships;
create policy fr_read on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
drop policy if exists fr_insert on public.friendships;
create policy fr_insert on public.friendships for insert to authenticated
  with check (requester = auth.uid());
drop policy if exists fr_update on public.friendships;
create policy fr_update on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists fr_delete on public.friendships;
create policy fr_delete on public.friendships for delete to authenticated
  using (requester = auth.uid() or addressee = auth.uid());

-- push subscriptions: strictly yours
drop policy if exists push_all on public.push_subs;
create policy push_all on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- views the app reads
-- SECURITY DEFINER on purpose: each view pins itself to auth.uid(),
-- which lets it show a friend's row without opening the table.
-- ============================================================
create or replace view public.friend_view as
  select p.id, p.handle, p.display_name, p.avatar,
         p.streak, p.chapters_read, p.memorized, p.total_xp,
         p.current_book, p.updated_at
  from public.profiles p
  where public.are_friends(auth.uid(), p.id);

create or replace view public.friend_requests_in as
  select f.requester as id, p.handle, p.display_name, p.avatar, f.created_at
  from public.friendships f
  join public.profiles p on p.id = f.requester
  where f.addressee = auth.uid() and f.status = 'pending';

grant select on public.friend_view, public.friend_requests_in to authenticated;

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists progress_touch on public.progress;
create trigger progress_touch before update on public.progress
  for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
