# Uang Rumah

A responsive Indonesian household finance web app based on the supplied Figma screenshots. React + Vite, deployable to Vercel.

## Start

Requires Node.js 22 or newer. Run `npm install`, then `npm run dev`. Production: `npm run build`. Tests: `npm test`.

## Working now

- Separate demo mode with browser-local persistence; no fake password authentication.
- New demo book setup; opening balance is not counted as income.
- Dashboard, month navigation, transaction create/edit/delete, search/type/category filtering.
- Monthly budgets, custom categories, profile editing, CSV export with spreadsheet formula escaping.
- Responsive phone/tablet/desktop layouts, keyboard accessible dialogs and forms.
- Supabase email/password registration, email recovery and private book persistence code, enabled only after configuration.

## Enable real accounts

1. Create a Supabase project, run `supabase/schema.sql` in its SQL editor. This is an initial migration, not an idempotent repeated script.
2. Copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and the public anon/publishable key in `VITE_SUPABASE_ANON_KEY`. Never use a service-role key in frontend variables.
3. Configure email confirmation and Site URL / allowed redirect URLs in Supabase Auth for localhost and your deployment domain. Configure SMTP for production delivery.
4. On Vercel import this directory as a Vite project and set the same two environment variables, then redeploy.
5. Verify sign-up, email confirmation, login, reset password, save/reload and cross-account RLS isolation on the live backend before production use.

The database restricts each row to its authenticated owner. Revision comparisons reject stale updates rather than overwriting another device's changes. Google Sheets sync, family invitations, receipt upload, push notifications and full offline app installation are not implemented. The UI clearly labels these limitations instead of claiming connected services. Demo persistence is not a substitute for a secure database. Cloud integration cannot be end-to-end tested until a project is configured.

Google Sheets can currently receive the exported CSV manually. Automatic OAuth and synchronization require a server integration and credentials. No Google tokens or private credentials are included.
