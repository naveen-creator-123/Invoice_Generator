# Naveen Tex – Invoice Generator (Vercel edition)

GST tax invoices with A4 print (logo + bank details), payment tracking, search, CSV export and JSON backup/restore.

**Stack:** static HTML/CSS/JS in `public/`, the Express app in `server.js`, Postgres database (Neon).

## Deploy on Vercel
1. Put this folder in a GitHub repository (the `.gitignore` already excludes secrets).
2. On vercel.com: **Add New → Project → import the repo** (framework preset: Express or Other; no build command).
3. In the Vercel project: **Storage → Create Database → Neon (Postgres)** and connect it to the project. This adds `DATABASE_URL` automatically.
4. **Settings → Environment Variables**, add for Production:
   - `ADMIN_USERNAME` – your login name
   - `ADMIN_PASSWORD` – a strong password (this replaces the old "create administrator" screen)
   - `SESSION_SECRET` – a long random string. Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the variables take effect, then open the site and sign in.
6. Open **Settings** to check the bank details and add phone, UPI and terms.

Tables are created automatically on the first request.

## Moving your old invoices
In the old app go to All Invoices → **Download backup**. In the new app go to All Invoices → **Restore backup** and pick that JSON file. (Business and bank settings are re-entered in Settings.)

## Backups
- Use **Download backup** (JSON) regularly and keep a copy on your PC / Drive.
- Neon also keeps its own history that can be restored from the Neon dashboard.

## Notes
- Login uses a signed HttpOnly cookie that lasts 12 hours; changing `SESSION_SECRET` signs everyone out. To change the password, edit `ADMIN_PASSWORD` and redeploy.
- Wrong-password attempts are limited (8 per 15 minutes per IP).
- Restore accepts files up to about 4 MB (Vercel's request limit).
- Vercel's free Hobby plan is meant for personal, non-commercial use. For a real business, check Vercel's current terms; the Pro plan is the compliant choice.

## Run locally (optional)
`npm install`, then set `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` in your environment and run `npm start` → http://localhost:3000
