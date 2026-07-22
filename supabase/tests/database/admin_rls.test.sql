-- RLS test: only admins can write roles/user_roles, and admins can read every
-- profile while ordinary users can only read their own.
create extension if not exists pgtap with schema extensions;

begin;
select plan(5);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'rls-admin@test.com'),
  ('cccccccc-0000-0000-0000-000000000002', 'rls-plain-user@test.com');

insert into public.user_roles (user_id, role_name) values ('cccccccc-0000-0000-0000-000000000001', 'admin');

-- Act as the plain user: cannot grant themselves admin, cannot read other profiles.
set local role authenticated;
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000002';

select throws_ok(
  $$ insert into public.user_roles (user_id, role_name) values ('cccccccc-0000-0000-0000-000000000002', 'admin') $$,
  '42501',
  null,
  'a non-admin cannot grant themselves the admin role'
);

select throws_ok(
  $$ insert into public.roles (name) values ('superuser') $$,
  '42501',
  null,
  'a non-admin cannot create new roles'
);

select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-0000-0000-000000000001'),
  0,
  'a non-admin cannot read another user''s profile'
);

-- Act as the admin: can read every profile and can manage user_roles.
set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.profiles where id = 'cccccccc-0000-0000-0000-000000000002'),
  1,
  'an admin can read another user''s profile'
);

select lives_ok(
  $$ insert into public.user_roles (user_id, role_name) values ('cccccccc-0000-0000-0000-000000000002', 'admin') $$,
  'an admin can grant a role to another user'
);

select * from finish();
rollback;
