-- Fixes found during a security review of the RLS/audit-log layer:
--
-- 1. audit_log.actor_id had no ON DELETE behavior (default NO ACTION), so deleting
--    any user who had ever triggered a logged action (e.g. rated one movie) failed
--    outright with a FK violation -- undermining the one thing an admin most needs
--    to do in an incident (remove a compromised/abusive account). ON DELETE SET NULL
--    preserves the audit trail while letting the account actually be removed.
--
-- 2. admin-users now records which account a create/delete/reset_password action
--    targeted, separately from the actor (the admin performing it) -- those actions
--    never touched a trigger-covered table, so without this they were untraceable.
--    Same ON DELETE SET NULL reasoning applies to the target.
--
-- 3. profiles.username came from fully client-controlled signup metadata with only
--    a uniqueness constraint -- no bound on length or on embedded control/newline
--    characters. Bounding it here is defense-in-depth independent of the existing
--    frontend Zod check, which a direct API call bypasses entirely.

alter table public.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references auth.users(id) on delete set null;

alter table public.audit_log
  add column if not exists target_user_id uuid references auth.users(id) on delete set null;

alter table public.profiles
  add constraint profiles_username_length check (char_length(username) between 1 and 100),
  add constraint profiles_username_no_control_chars check (username !~ '[[:cntrl:]]');
