-- Roles / RBAC / profiles, replacing the Flask app's User/Role/RoleAssignment tables.
-- Supabase Auth owns auth.users (id, email, password hash); this migration layers
-- application-level identity (username) and authorization (roles) on top of it.

create table public.roles (
  name text primary key,
  active boolean not null default true
);

insert into public.roles (name) values ('admin'), ('user');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null references public.roles(name),
  created_at timestamptz not null default now(),
  primary key (user_id, role_name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

-- security definer avoids infinite RLS recursion when a user_roles policy calls this function.
create or replace function public.has_role(_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.name = ur.role_name
    where ur.user_id = auth.uid()
      and ur.role_name = _role
      and r.active
  );
$$;

-- Fires on every new Supabase Auth signup: creates the profile row and grants the
-- default 'user' role, mirroring the original app's registration flow.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  insert into public.user_roles (user_id, role_name) values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;

create policy "roles read" on public.roles
  for select to authenticated using (true);
create policy "roles admin write" on public.roles
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

create policy "profiles self or admin read" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_role('admin'));
create policy "profiles self or admin update" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

create policy "user_roles self or admin read" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));
create policy "user_roles admin insert" on public.user_roles
  for insert to authenticated
  with check (public.has_role('admin'));
create policy "user_roles admin delete" on public.user_roles
  for delete to authenticated
  using (public.has_role('admin'));

-- RLS only restricts rows; Postgres still requires these baseline table grants
-- before a role can run the statement at all. The policies above then narrow
-- what each statement can actually see/touch.
grant select, insert, update, delete on public.roles to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;

-- service_role bypasses RLS but still needs baseline grants: used directly by
-- scripts/seed-admin-users.mjs and the admin-users edge function.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.user_roles to service_role;
