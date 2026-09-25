-- Repeatable FamBudget schema. Never expose a service-role key in the frontend.
create table if not exists public.books (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data) = 'object'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);

create table if not exists public.book_members (
 book_user_id uuid not null references public.books(user_id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','partner')),
 joined_at timestamptz not null default now(),
 primary key (book_user_id,user_id),
 unique (user_id)
);

create table if not exists public.book_invites (
 id uuid primary key default gen_random_uuid(),
 book_user_id uuid not null references public.books(user_id) on delete cascade,
 email text not null,
 invited_by uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','declined')),
 created_at timestamptz not null default now()
);
create unique index if not exists book_invites_one_pending_email
on public.book_invites(book_user_id,lower(email)) where status='pending';

insert into public.book_members(book_user_id,user_id,role)
select user_id,user_id,'owner' from public.books on conflict (user_id) do nothing;

create or replace function public.add_book_owner()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.book_members(book_user_id,user_id,role) values(new.user_id,new.user_id,'owner') on conflict (user_id) do nothing;
 return new;
end $$;
drop trigger if exists add_book_owner_after_insert on public.books;
create trigger add_book_owner_after_insert after insert on public.books for each row execute function public.add_book_owner();

create or replace function public.can_access_book(p_book_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.book_members where book_user_id=p_book_user_id and user_id=auth.uid())
$$;

create or replace function public.invite_partner(p_email text)
returns uuid language plpgsql security definer set search_path=public,auth as $$
declare v_book uuid; v_id uuid; v_email text:=lower(trim(p_email));
begin
 if v_email='' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Email tidak valid.'; end if;
 if v_email=lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Kamu tidak dapat mengundang email sendiri.'; end if;
 select book_user_id into v_book from public.book_members where user_id=auth.uid() and role='owner';
 if v_book is null then raise exception 'Hanya pemilik buku yang dapat mengundang pasangan.'; end if;
 if exists(select 1 from auth.users u join public.book_members m on m.user_id=u.id where m.book_user_id=v_book and lower(u.email)=v_email) then raise exception 'Email tersebut sudah menjadi anggota.'; end if;
 insert into public.book_invites(book_user_id,email,invited_by) values(v_book,v_email,auth.uid())
 on conflict (book_user_id,lower(email)) where status='pending' do update set created_at=now(),invited_by=auth.uid()
 returning id into v_id;
 return v_id;
end $$;

create or replace function public.pending_book_invites()
returns table(id uuid,book_user_id uuid,book_name text,email text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select i.id,i.book_user_id,coalesce(b.data->>'name','Buku Kas Keluarga'),i.email,i.created_at
 from public.book_invites i join public.books b on b.user_id=i.book_user_id
 where i.status='pending' and lower(i.email)=lower(coalesce(auth.jwt()->>'email','')) order by i.created_at desc
$$;

create or replace function public.accept_book_invite(p_invite_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_invite public.book_invites%rowtype;
begin
 select * into v_invite from public.book_invites where id=p_invite_id and status='pending' for update;
 if v_invite.id is null or lower(v_invite.email)<>lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Undangan tidak ditemukan.'; end if;
 if exists(select 1 from public.book_members where user_id=auth.uid()) then raise exception 'Akun ini sudah terhubung ke sebuah buku kas.'; end if;
 insert into public.book_members(book_user_id,user_id,role) values(v_invite.book_user_id,auth.uid(),'partner');
 update public.book_invites set status='accepted' where id=p_invite_id;
 return v_invite.book_user_id;
end $$;

create or replace function public.decline_book_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.book_invites set status='declined' where id=p_invite_id and status='pending' and lower(email)=lower(coalesce(auth.jwt()->>'email',''));
end $$;

create or replace function public.book_member_list(p_book_user_id uuid)
returns table(user_id uuid,email text,role text,joined_at timestamptz)
language sql stable security definer set search_path=public,auth as $$
 select m.user_id,u.email::text,m.role,m.joined_at from public.book_members m join auth.users u on u.id=m.user_id
 where m.book_user_id=p_book_user_id and public.can_access_book(p_book_user_id)
 order by case when m.role='owner' then 0 else 1 end,m.joined_at
$$;

alter table public.books enable row level security;
alter table public.book_members enable row level security;
alter table public.book_invites enable row level security;
drop policy if exists "Owner can read book" on public.books;
drop policy if exists "Owner can create book" on public.books;
drop policy if exists "Owner can update book" on public.books;
drop policy if exists "Members can read book" on public.books;
drop policy if exists "Members can update book" on public.books;
create policy "Members can read book" on public.books for select to authenticated using ((select auth.uid())=user_id or public.can_access_book(user_id));
create policy "Owner can create book" on public.books for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Members can update book" on public.books for update to authenticated using ((select auth.uid())=user_id or public.can_access_book(user_id)) with check ((select auth.uid())=user_id or public.can_access_book(user_id));

revoke all on public.books,public.book_members,public.book_invites from anon;
revoke all on public.book_members,public.book_invites from authenticated;
grant select,insert,update on public.books to authenticated;
grant execute on function public.invite_partner(text),public.pending_book_invites(),public.accept_book_invite(uuid),public.decline_book_invite(uuid),public.book_member_list(uuid) to authenticated;
