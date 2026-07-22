-- RLS test: a user can only see/modify their own user_movies rows, even though
-- both anon-key and authenticated-role clients share the same table grants.
create extension if not exists pgtap with schema extensions;

begin;
select plan(6);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'rls-user-a@test.com'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'rls-user-b@test.com');

insert into public.movies (tmdb_id, title) values (900001, 'RLS Test Movie');

-- Act as user A: insert own watched-movie row.
set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select lives_ok(
  $$ insert into public.user_movies (user_id, movie_id, rating, watched_date)
     select 'aaaaaaaa-0000-0000-0000-000000000001', id, 5, current_date from public.movies where tmdb_id = 900001 $$,
  'user A can insert their own user_movies row'
);

select throws_ok(
  $$ insert into public.user_movies (user_id, movie_id, rating, watched_date)
     select 'aaaaaaaa-0000-0000-0000-000000000002', id, 5, current_date from public.movies where tmdb_id = 900001 $$,
  '42501',
  null,
  'user A cannot insert a user_movies row on behalf of user B'
);

select is(
  (select count(*)::int from public.user_movies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'user A sees exactly their own row'
);

-- Act as user B: should see zero rows, and be unable to update/delete A's row.
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.user_movies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'user B cannot see user A''s row'
);

-- RLS silently filters rows it can't see rather than erroring on UPDATE/DELETE,
-- so run the statement (as user B) then verify the row as user A afterward.
update public.user_movies set rating = 1 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select rating::int from public.user_movies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  5,
  'user B''s update did not affect user A''s row'
);

set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.user_movies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.user_movies where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1,
  'user B''s delete did not remove user A''s row'
);

select * from finish();
rollback;
