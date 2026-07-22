-- Per-user watched/rated movies, replacing the Flask app's PK-less `user_movie`
-- association table. This is the core "private data" table: RLS's owner check
-- is the entire authorization mechanism, replacing views/movies.py's
-- saw/rewatch/not_seen handlers and all of views/my_movies.py.

create table public.user_movies (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id bigint not null references public.movies(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  watched_date date not null check (watched_date <= current_date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, movie_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_movies_set_updated_at
  before update on public.user_movies
  for each row execute function public.set_updated_at();

alter table public.user_movies enable row level security;

create policy "user_movies owner all" on public.user_movies
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.user_movies to authenticated;
