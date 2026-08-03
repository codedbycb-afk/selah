# Selah — backend

**STATUS: provisioned and live as of 2026-08-02.** The steps below are kept as a
record of what was done and as a runbook for rebuilding from scratch.

| | |
|---|---|
| Project ref | `kooikpwljxwsrokonpth` |
| Region | `us-east-1` |
| Org | CB's personal org (`coozaqdwxmfoatjmfrfo`) |
| Dashboard | https://supabase.com/dashboard/project/kooikpwljxwsrokonpth |

**Where the secrets live** — none of these are in the repo:

| Secret | Location |
|---|---|
| VAPID private key | Supabase function secrets + `~/.config/selah/vapid.json` (600) |
| Cron shared secret | Supabase Vault as `selah_cron_secret` + `~/.config/selah/cron-secret.txt` (600) |
| Database password | `~/.config/selah/db-password.txt` (600) |

The pg_cron job reads the shared secret out of Vault at run time, which is why
`migrations/20260803011000_cron.sql` is safe to publish. The migration that
inserted the Vault secret was applied once and never committed; its history row
is marked `reverted`, so rebuilding on a fresh project means re-running:

```sql
select vault.create_secret('<new secret>', 'selah_cron_secret');
```

### Known limit — email
Supabase's built-in mailer is rate limited to a handful of messages per hour and
is meant for testing. It is fine for CB signing in on his own devices. Before
other people can sign in and add each other as friends, point Auth at a real
SMTP provider (Resend's free tier is plenty) under
**Authentication → Emails → SMTP Settings**.

---

Everything here is optional. With `config.js` left blank, Selah runs exactly as
it does today: on-device, offline, free. Filling it in adds cross-device sync,
friends, and real push notifications.

Budget: all of this fits inside Supabase's free tier.

---

## 1. Create the project

1. supabase.com → **New project**. Any region near Cleveland (`us-east-1`) is fine.
2. Wait for it to finish provisioning.
3. **Project Settings → API** — copy the **Project URL** and the **anon / public** key.

Paste both into `config.js` at the repo root:

```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGci...',
```

The anon key is *meant* to be public — row level security is what protects the
data, and the schema below locks every table down to its owner.

## 2. Run the schema

**SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
It's idempotent, so re-running after a change is safe.

## 3. Make the sign-in email send a code, not a link

Selah asks for a 6-digit code. Supabase's default magic-link template only
contains a link.

**Authentication → Emails → Magic Link** — make sure the body includes the
token, e.g.:

```html
<h2>Your Selah code</h2>
<p>Enter this in the app:</p>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
```

Also under **Authentication → URL Configuration**, add the site URL
(`https://codedbycb-afk.github.io/selah/`) to the redirect allow-list.

## 4. Push notifications

### Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

- **Public key** → `config.js` → `VAPID_PUBLIC_KEY`
- **Private key** → Supabase secret (next step). It never goes in the repo.

### Set the function secrets

```bash
supabase login
supabase link --project-ref <your-project-ref>

supabase secrets set \
  VAPID_PUBLIC_KEY="<public>" \
  VAPID_PRIVATE_KEY="<private>" \
  VAPID_SUBJECT="mailto:codedbycb@gmail.com" \
  CRON_SECRET="$(openssl rand -hex 24)"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

### Deploy the function

```bash
supabase functions deploy daily-push --no-verify-jwt
```

`--no-verify-jwt` is deliberate: cron calls it machine-to-machine, and the
`CRON_SECRET` header is what gates it.

### Schedule it

The function checks every subscription against its own timezone, so it only
needs to run on a fixed interval. Every 10 minutes is plenty — a reminder set
for 07:00 fires between 07:00 and 07:15.

**SQL Editor**, once:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'selah-daily-push',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/daily-push',
    headers := jsonb_build_object(
                 'Content-Type',   'application/json',
                 'x-cron-secret',  '<the CRON_SECRET you generated>'),
    body    := '{}'::jsonb
  );
  $$
);
```

Check on it later with `select * from cron.job_run_details order by start_time desc limit 20;`

### Test it by hand

```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/daily-push' \
     -H 'x-cron-secret: <secret>'
# → {"ok":true,"subs":1,"sent":0,"pruned":0}
```

`sent` stays 0 until a device's local clock reaches its chosen reminder time.

---

## iPhone notes

Web push on iOS only works when the app has been **added to the Home Screen**
(iOS 16.4+). Selah detects this and says so instead of failing quietly — the
in-app install bar walks through Share → Add to Home Screen.

Android/Chrome will prompt to install on its own.

---

## What's stored where

| Table | Holds | Who can read it |
|---|---|---|
| `profiles` | handle, name, avatar, public stats | you, and your accepted friends |
| `progress` | the synced blob: chapters read, activity, SRS, kept verses | only you |
| `highlights` | verses you kept, with text | you, and your accepted friends |
| `friendships` | the edges, pending or accepted | only the two people on the edge |
| `push_subs` | browser push endpoints + reminder times | only you |

Deliberately **not** synced: your ESV/NLT API keys and your profile PIN. Those
never leave the device.

Strangers can't read the `profiles` table — adding a friend goes through the
`find_profile()` function, which returns only a handle, name, and avatar.
