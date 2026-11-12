-- =====================================================================
-- Kanban App: Supabase schema
-- Jalankan sekali di Supabase Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan ulang (pakai IF NOT EXISTS / OR REPLACE).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Anggota tim (allowlist). Hanya email di tabel ini yang bisa
--    membaca/menulis data, walaupun orang lain berhasil login Google.
-- ---------------------------------------------------------------------
create table if not exists public.members (
  email      text primary key,
  role       text not null default 'member' check (role in ('owner', 'member')),
  added_at   timestamptz not null default now()
);

-- ⚠️ GANTI dengan Gmail yang akan kamu pakai login (jadi owner pertama).
insert into public.members (email, role)
values ('andromedevloper@gmail.com', 'owner')
on conflict (email) do update set role = 'owner';

create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = public.current_email());
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members where lower(email) = public.current_email() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Data Kanban (id berupa text agar cocok dengan id yang sudah ada)
-- ---------------------------------------------------------------------
create table if not exists public.boards (
  id          text primary key,
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.columns (
  id          text primary key,
  board_id    text not null references public.boards (id) on delete cascade,
  title       text not null,
  color       text,
  wip_limit   int,
  notes       jsonb not null default '[]'::jsonb,   -- catatan penting kolom
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists columns_board_idx on public.columns (board_id);

create table if not exists public.tasks (
  id          text primary key,
  column_id   text not null references public.columns (id) on delete cascade,
  title       text not null,
  description text not null default '',
  priority    text not null default 'medium',
  due_date    date,
  tags        text[] not null default '{}',
  subtasks    jsonb not null default '[]'::jsonb,
  assignees   jsonb not null default '[]'::jsonb,
  links       jsonb not null default '[]'::jsonb,
  media       jsonb,                                 -- sampul kartu
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tasks_column_idx on public.tasks (column_id);

create table if not exists public.assignees (
  id           text primary key,
  name         text not null,
  avatar_color text not null,
  email        text                                  -- opsional: tautkan ke akun Google
);

create table if not exists public.tags (
  label text primary key
);

create table if not exists public.token_timers (
  id                     text primary key,
  assignee_id            text not null references public.assignees (id) on delete cascade,
  label                  text not null,
  reset_at               timestamptz not null,
  duration_minutes       int,
  remind_before_minutes  int,
  notified_before        boolean not null default false,
  notified_ready         boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id         text primary key,
  created_at timestamptz not null default now(),
  action     text not null,
  details    text not null,
  actor      text default public.current_email()
);

-- ---------------------------------------------------------------------
-- 3. Pusat Data: indeks file kerja yang disimpan di Google Drive
-- ---------------------------------------------------------------------
create table if not exists public.files (
  id             uuid primary key default gen_random_uuid(),
  drive_file_id  text unique,                        -- null untuk entri link (mis. repo GitHub)
  name           text not null,
  mime_type      text,
  size_bytes     bigint,
  category       text not null,                      -- Responden, Blueprint, Whitepaper, PRD, ...
  description    text,
  web_view_link  text,                               -- link Drive / GitHub
  board_id       text references public.boards (id) on delete set null,
  task_id        text references public.tasks (id) on delete set null,
  uploaded_by    text not null default public.current_email(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists files_category_idx on public.files (category);
create index if not exists files_task_idx on public.files (task_id);

-- Pengaturan bersama (mis. ID folder Drive tim)
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Row Level Security: semua tabel hanya untuk anggota tim
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'boards', 'columns', 'tasks', 'assignees', 'tags',
    'token_timers', 'activity_logs', 'files', 'app_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members full access" on public.%I', t);
    execute format(
      'create policy "members full access" on public.%I for all to authenticated
         using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

alter table public.members enable row level security;
drop policy if exists "members can read team" on public.members;
create policy "members can read team" on public.members
  for select to authenticated using (public.is_member());
drop policy if exists "owner manages team" on public.members;
create policy "owner manages team" on public.members
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------
-- 5. Realtime: perubahan langsung tampil di layar anggota lain
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'boards', 'columns', 'tasks', 'assignees', 'tags', 'token_timers', 'files'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. Storage: media sampul kartu (privat, hanya anggota tim)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('covers', 'covers', false, 26214400)  -- 25 MB
on conflict (id) do nothing;

drop policy if exists "members read covers" on storage.objects;
create policy "members read covers" on storage.objects
  for select to authenticated using (bucket_id = 'covers' and public.is_member());

drop policy if exists "members upload covers" on storage.objects;
create policy "members upload covers" on storage.objects
  for insert to authenticated with check (bucket_id = 'covers' and public.is_member());

drop policy if exists "members delete covers" on storage.objects;
create policy "members delete covers" on storage.objects
  for delete to authenticated using (bucket_id = 'covers' and public.is_member());
