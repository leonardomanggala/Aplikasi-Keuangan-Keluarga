# FamBudget

A responsive Indonesian household finance web app based on the supplied Figma screenshots. React + Vite, deployable to Vercel.

## Start

Requires Node.js 22 or newer. Run `npm install`, then `npm run dev`. Production: `npm run build`. Tests: `npm test`.

## Working now

- Separate demo mode with browser-local persistence; no fake password authentication.
- New demo book setup; opening balance is not counted as income.
- Dashboard, month navigation, transaction create/edit/delete, search/type/category filtering.
- Monthly budgets, custom categories, profile editing, CSV export with spreadsheet formula escaping.
- Responsive phone/tablet/desktop layouts, keyboard accessible dialogs and forms.
- Supabase email/password registration, email recovery, and private cloud persistence for every account.

## Cloud accounts and database

The Vercel project is connected to Supabase. Public browser variables use the `NEXT_PUBLIC_SUPABASE_*` names supplied by the Vercel integration; the Vite configuration exposes only the `NEXT_PUBLIC_` and `VITE_` prefixes.

After pulling the project's development environment variables into `.env.local`, run `npm run db:setup` to apply the repeatable database schema. Never place the service-role or database credentials in frontend variables.

Before inviting users beyond a limited test, configure the Supabase Auth Site URL and allowed redirect URLs for `https://uang-rumah-one.vercel.app`, and use production SMTP for dependable confirmation and password-reset email delivery.

The database restricts each row to its authenticated owner. Revision comparisons reject stale updates rather than overwriting another device's changes. Authentication, create/read/update persistence, and cross-account isolation have been tested against the connected database. Google Sheets sync, family invitations, receipt upload, push notifications, and full offline app installation are not implemented. Demo data remains local to one browser and is separate from cloud accounts.

Google Sheets can currently receive the exported CSV manually. Automatic OAuth and synchronization require a server integration and credentials. No Google tokens or private credentials are included.
