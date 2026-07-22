-- Daily scheduled TMDB sync, replacing the Flask app's startup fetch of movies
-- released "today". The service-role key and function URL are NOT set here —
-- they must never be committed — see the one-time manual setup documented in
-- README.md ("Post-deploy: scheduling tmdb-sync"), which runs:
--
--   select vault.create_secret('<service-role-key>', 'tmdb_sync_service_key');
--   alter database postgres set app.settings.tmdb_sync_url = 'https://<project-ref>.supabase.co/functions/v1/tmdb-sync';
--
-- Until that manual step is done, this job will simply fail silently each run
-- (net.http_post against a null/placeholder URL), which is safe.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'tmdb-daily-sync',
    '0 6 * * *',
    $$
    select net.http_post(
      url := current_setting('app.settings.tmdb_sync_url', true),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'tmdb_sync_service_key'
        ),
        'Content-Type', 'application/json'
      ),
      -- No from/to: the edge function defaults to "today" when the body is empty,
      -- keeping every routine run fast (see supabase/functions/tmdb-sync/index.ts).
      body := '{}'::jsonb
    );
    $$
  );
