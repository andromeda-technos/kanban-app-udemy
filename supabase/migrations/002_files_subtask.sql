-- =====================================================================
-- 002: Pusat Data — file bisa ditautkan ke subtugas
-- Jalankan di Supabase → SQL Editor → New query → Run (aman diulang).
-- =====================================================================

alter table public.files add column if not exists subtask_id text;
create index if not exists files_subtask_idx on public.files (subtask_id);

-- Realtime untuk app_settings (konfigurasi folder Drive tim)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
