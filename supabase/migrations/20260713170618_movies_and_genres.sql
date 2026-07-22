-- Movie/genre catalog, replacing the Flask app's Movie/Genre/movie_genre tables.
-- These are populated exclusively by the tmdb-sync edge function (service_role),
-- so authenticated users only ever get a select policy here.

create table public.genres (
  id bigint generated always as identity primary key,
  tmdb_id integer not null unique,
  name text not null
);

create table public.movies (
  id bigint generated always as identity primary key,
  tmdb_id integer not null unique,
  title text not null,
  overview text,
  popularity numeric,
  release_date date,
  created_at timestamptz not null default now()
);

create table public.movie_genres (
  movie_id bigint not null references public.movies(id) on delete cascade,
  genre_id bigint not null references public.genres(id) on delete cascade,
  primary key (movie_id, genre_id)
);

alter table public.genres enable row level security;
alter table public.movies enable row level security;
alter table public.movie_genres enable row level security;

create policy "genres read" on public.genres
  for select to authenticated using (true);
create policy "movies read" on public.movies
  for select to authenticated using (true);
create policy "movie_genres read" on public.movie_genres
  for select to authenticated using (true);

-- Deliberately no insert/update/delete policies: only the service_role key
-- (used exclusively by the tmdb-sync edge function) can write to these tables,
-- since service_role bypasses RLS entirely.

grant select on public.genres, public.movies, public.movie_genres to authenticated;
-- service_role bypasses RLS but still needs baseline table grants.
grant select, insert, update, delete on public.genres, public.movies, public.movie_genres to service_role;
