/* ============================================================
   Selah — deployment config
   Fill these in and cloud sync, friends, and push switch on.
   Everything still works offline and on-device if they stay blank.
   ============================================================ */
window.SELAH_CONFIG = {
  /* Supabase → Project Settings → API */
  SUPABASE_URL: '',        // e.g. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: '',   // the "anon / public" key — safe in the browser, RLS guards the data

  /* Web push → generate with:  npx web-push generate-vapid-keys
     The PUBLIC key goes here. The PRIVATE key goes in Supabase secrets, never here. */
  VAPID_PUBLIC_KEY: '',

  /* Where the app lives. Used for share links and friend invites. */
  SITE_URL: 'https://codedbycb-afk.github.io/selah/',
};
