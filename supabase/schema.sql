-- Run once in the SQL editor of a new Supabase project.
-- Never expose a service-role key in the frontend.
create table if not exists public.books (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.books enable row level security;
drop policy if exists "Owner can read book" on public.books;
drop policy if exists "Owner can create book" on public.books;
drop policy if exists "Owner can update book" on public.books;
create policy "Owner can read book" on public.books for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owner can create book" on public.books for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owner can update book" on public.books for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.books from anon;
grant select, insert, update on public.books to authenticated;
