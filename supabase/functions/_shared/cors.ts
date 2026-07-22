// Defaults to '*' so local dev (which may run the frontend from several ports —
// 5173 direct, 8090 via the optional nginx/Docker setup) keeps working out of the
// box. Set the ALLOWED_ORIGIN secret in production (`npx supabase secrets set
// ALLOWED_ORIGIN=https://your-app.example`) to scope this down, particularly for
// admin-users which performs highly privileged operations.
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

export const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
