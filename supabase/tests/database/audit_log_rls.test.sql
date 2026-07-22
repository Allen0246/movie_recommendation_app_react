-- RLS test: audit_log is admin-read-only, and no role may write to or tamper with
-- it directly -- rows are only ever inserted by SECURITY DEFINER triggers or the
-- service_role client in edge functions, both of which bypass RLS and grants
-- entirely (see supabase/migrations/..._audit_log.sql).
create extension if not exists pgtap with schema extensions;

begin;
select plan(8);

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-000000000001', 'audit-admin@test.com'),
  ('dddddddd-0000-0000-0000-000000000002', 'audit-plain-user@test.com');

insert into public.user_roles (user_id, role_name) values ('dddddddd-0000-0000-0000-000000000001', 'admin');

-- Seed a row the way the app actually would: as postgres, bypassing RLS/grants.
insert into public.audit_log (actor_id, action, details)
  values ('dddddddd-0000-0000-0000-000000000002', 'test_action', '{}'::jsonb);

-- Act as a plain (non-admin) user.
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000002';

select is(
  (select count(*)::int from public.audit_log),
  0,
  'a non-admin cannot read any audit_log rows, including their own'
);

select throws_ok(
  $$ insert into public.audit_log (action) values ('forged') $$,
  '42501',
  null,
  'a non-admin cannot insert into audit_log'
);

select throws_ok(
  $$ update public.audit_log set action = 'tampered' $$,
  '42501',
  null,
  'a non-admin cannot update audit_log rows'
);

select throws_ok(
  $$ delete from public.audit_log $$,
  '42501',
  null,
  'a non-admin cannot delete audit_log rows, including their own'
);

-- Act as an anonymous (unauthenticated) request: no grant on the table at all.
set local role anon;

select throws_ok(
  $$ select count(*) from public.audit_log $$,
  '42501',
  null,
  'an anonymous request cannot query audit_log at all (no grant, not just RLS)'
);

-- Act as the admin.
set local role authenticated;
set local request.jwt.claim.sub = 'dddddddd-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.audit_log where action = 'test_action' and actor_id = 'dddddddd-0000-0000-0000-000000000002'),
  1,
  'an admin can read audit_log rows (including the one seeded above)'
);

select throws_ok(
  $$ insert into public.audit_log (action) values ('forged-by-admin') $$,
  '42501',
  null,
  'even an admin cannot insert into audit_log directly (grant-level, not just RLS)'
);

select throws_ok(
  $$ delete from public.audit_log $$,
  '42501',
  null,
  'even an admin cannot delete audit_log rows directly'
);

select * from finish();
rollback;
