-- RLS test: movies/genres are readable by any authenticated user but writable
-- only by service_role (the tmdb-sync edge function), not by ordinary users.
create extension if not exists pgtap with schema extensions;

begin;
select plan(4);

insert into auth.users (id, email) values ('bbbbbbbb-0000-0000-0000-000000000001', 'rls-reader@test.com');
insert into public.genres (tmdb_id, name) values (900101, 'RLS Test Genre');
insert into public.movies (tmdb_id, title) values (900101, 'RLS Read Movie');

set local role authenticated;
set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.movies where tmdb_id = 900101),
  1,
  'authenticated user can read movies'
);

select is(
  (select count(*)::int from public.genres where tmdb_id = 900101),
  1,
  'authenticated user can read genres'
);

select throws_ok(
  $$ insert into public.movies (tmdb_id, title) values (900102, 'Should Not Insert') $$,
  '42501',
  null,
  'authenticated user cannot insert into movies'
);

select throws_ok(
  $$ update public.genres set name = 'Hacked' where tmdb_id = 900101 $$,
  '42501',
  null,
  'authenticated user cannot update genres'
);

select * from finish();
rollback;
