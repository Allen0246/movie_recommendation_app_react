-- Admin-only audit trail, replacing views/logs.py's rotating log file viewer.
-- There's no app server anymore to write log files, so this is a structured,
-- queryable table instead: written only via SECURITY DEFINER triggers (below)
-- and the tmdb-sync edge function's service-role client, readable only by admins.

create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references auth.users(id),
  action text not null,
  details jsonb
);

alter table public.audit_log enable row level security;

create policy "audit_log admin read" on public.audit_log
  for select to authenticated
  using (public.has_role('admin'));

-- No insert/update/delete policy for authenticated/anon: rows are only ever
-- written by SECURITY DEFINER trigger functions (running as postgres) or by
-- the service_role client in the tmdb-sync edge function, both of which bypass RLS.

grant select on public.audit_log to authenticated;
-- service_role bypasses RLS but still needs a baseline grant to insert directly.
grant select, insert on public.audit_log to service_role;

create or replace function public.log_user_movie_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, details)
  values (
    auth.uid(),
    lower(tg_op) || '_user_movie',
    jsonb_build_object(
      'movie_id', coalesce(new.movie_id, old.movie_id),
      'rating', coalesce(new.rating, old.rating),
      'watched_date', coalesce(new.watched_date, old.watched_date)
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger user_movies_audit
  after insert or update or delete on public.user_movies
  for each row execute function public.log_user_movie_change();

create or replace function public.log_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, details)
  values (
    auth.uid(),
    lower(tg_op) || '_user_role',
    jsonb_build_object(
      'user_id', coalesce(new.user_id, old.user_id),
      'role', coalesce(new.role_name, old.role_name)
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger user_roles_audit
  after insert or delete on public.user_roles
  for each row execute function public.log_role_change();
