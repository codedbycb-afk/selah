/* ============================================================
   Selah — deployment config
   These three values are PUBLIC by design. The anon key is meant to
   ship in the browser; row level security in supabase/schema.sql is
   what protects the data. The VAPID private key is NOT here — it
   lives only in Supabase's function secrets.
   ============================================================ */
window.SELAH_CONFIG = {
  /* Supabase → Project Settings → API */
  SUPABASE_URL: 'https://kooikpwljxwsrokonpth.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtvb2lrcHdsanh3c3Jva29ucHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MjAzNDMsImV4cCI6MjEwMTI5NjM0M30.py8mvIjpMJIB-Tl6JH3pee-ZCT7VjmDZVWlk6YoFmPk',

  /* Web push. Public half only — the private half is a Supabase secret. */
  VAPID_PUBLIC_KEY: 'BOfdq6WEhTH2bIYZYfhiSv56zdI7zQt-cm3NUnXT0hoLy-uBVVY0AvlQH3FB1iE2XHJ1xQ0EaawTb7AwDR1lxUQ',

  /* Used for share links and friend invites. */
  SITE_URL: 'https://codedbycb-afk.github.io/selah/',
};
