# BuildTrack — Production Deployment Guide

This document prepares **BuildTrack Construction Management System** for production.

Architecture:

- One folder: Laravel (`app/`, `routes/`, `config/`, `vendor/`, ...) and the React source (`src/`) live together in the project root
- Frontend: React + Vite, built **into `public/`** (`npm run build`)
- Backend: Laravel API (`public/` as web root) — also serves the frontend
- Database: MySQL
- Auth: Laravel Sanctum (Bearer tokens)

Frontend and backend run as **one Laravel app on one domain**. The API is at `/api`, every other URL loads the React app.

**Do not invent domains, IPs, or credentials.** Replace placeholders with the client’s real hosting values.

---

## 0. cPanel (single app) — quick guide

### Build on your computer (cPanel usually has no Node.js)

```bash
npm ci
npm run build        # writes index.html, assets/, images/, icons into public/
```

Production builds always call the API at `/api` on the same domain (set in `vite.config.js`).

### Upload

Upload the project folder (zip it, upload with File Manager, extract). `node_modules/` is not needed on the server.

```text
/home/CPANEL_USER/rn-trading/          <- the project folder (app, bootstrap, config, public, src, vendor, artisan, ...)
/home/CPANEL_USER/rn-trading/public    <- web root
```

Recommended: point the domain/subdomain **Document Root** to `rn-trading/public` (cPanel → Domains → Manage).

If the Document Root cannot be changed (files extracted straight into `public_html`), the root `.htaccess`
forwards every request into `public/`, so `.env`, `vendor/` and the source code stay private.

If `vendor/` is not uploaded, run `composer install --no-dev --optimize-autoloader` via cPanel Terminal.

### Server `.env` (in `rn-trading/.env`)

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://YOUR-DOMAIN
DB_HOST=localhost
DB_DATABASE=CPANEL_DB_NAME
DB_USERNAME=CPANEL_DB_USER
DB_PASSWORD=...
```

`CORS_ALLOWED_ORIGINS` is not needed when everything runs on one domain.

### Then (cPanel Terminal)

```bash
cd ~/rn-trading
php artisan storage:link
php artisan migrate --force        # only after a database backup
php artisan config:cache && php artisan route:cache && php artisan view:cache
```

Cron (cPanel → Cron Jobs): `* * * * * cd ~/rn-trading && php artisan schedule:run >> /dev/null 2>&1`

### Updating later

Run `npm run build` again and re-upload `public/index.html`, `public/assets/` (plus any changed PHP files).

---

## 1. Completed locally (preparation)

| Item | Status |
|------|--------|
| Frontend production build (`npm run build`) | Prepared / verify before each release |
| Frontend `.env.example` | Ready |
| Backend `.env.example` (production-oriented) | Ready |
| `.gitignore` protects secrets/build artifacts | Ready |
| SPA fallback samples (`public/_redirects`, `public/web.config`) | Ready |
| API base URL uses `VITE_API_BASE_URL` | Ready |
| Login rate limiting + API throttle | Ready (Phase 19) |
| Sanctum token expiration | Ready (Phase 19) |
| CORS via `CORS_ALLOWED_ORIGINS` | Ready (Phase 19) |
| Security headers middleware | Ready (Phase 19) |
| Notification scheduler command | `notifications:generate` hourly in `routes/console.php` |
| Database backup example scripts | `scripts/` |

---

## 2. Requires client / hosting action

These **cannot** be completed without real hosting access:

1. Provision frontend host (static) and API host (PHP/Laravel).
2. Provision MySQL database and strong credentials.
3. Set production `.env` on the server (never commit it).
4. Point DNS to frontend + API (HTTPS certificates).
5. Create database backup **before** first production migrate.
6. Run `php artisan migrate --force` on production after backup.
7. Configure cron: `* * * * * php /path/to/project/artisan schedule:run`
8. Optional queue worker if `QUEUE_CONNECTION` is not `sync`/`database` idle.
9. Rotate seed/demo admin password; create real admin accounts.
10. Remove or disable demo data if not wanted.

---

## 3. Suggested domain layout

Use placeholders until the client provides names:

- Frontend: `https://YOUR-FRONTEND-DOMAIN`
- API: `https://YOUR-API-DOMAIN` (document root = `public`)
- SPA may call API at `https://YOUR-API-DOMAIN/api`

---

## 4. Frontend deployment

### Environment

Create `.env.production` on the build machine (do not commit):

```env
VITE_API_BASE_URL=https://YOUR-API-DOMAIN/api
```

### Build

Create `.env.production` from `.env.production.example` (do not commit):

```env
VITE_API_BASE_URL=https://YOUR-API-DOMAIN/api
```

Then:

```bash
npm ci
npm run build
```

**Important:** Vite bakes `VITE_*` values at build time. If your local `.env` still points at `127.0.0.1`, a production build may embed localhost. Always set `.env.production` (or export `VITE_API_BASE_URL`) for release builds.

The build output goes into `public/` (served by Laravel). See section 0 for cPanel.

### SPA routing

React Router needs fallback to `index.html` for deep links (`/products`, `/reports`, etc.).

Examples included:

- Netlify-style: `public/_redirects` → copied into `dist/`
- IIS: `public/web.config`

Nginx example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

### Preview locally

```bash
npm run preview
```

Ensure the preview build uses the intended API URL (rebuild after changing env).

---

## 5. Backend deployment

### Web root

Point the vhost **only** at:

```text
public
```

Do **not** expose the project root, `.env`, `vendor/`, or `storage/` internals.

### Install

```bash
cd /path/to/project
composer install --no-dev --optimize-autoloader
cp .env.example .env   # then edit production values
php artisan key:generate   # ONLY on first install — do not rotate casually later
php artisan storage:link
```

### Required production `.env` concepts

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://YOUR-API-DOMAIN

DB_CONNECTION=mysql
DB_HOST=...
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

CORS_ALLOWED_ORIGINS=https://YOUR-FRONTEND-DOMAIN
SANCTUM_STATEFUL_DOMAINS=YOUR-FRONTEND-DOMAIN
SANCTUM_TOKEN_EXPIRATION=10080
SESSION_SECURE_COOKIE=true
LOG_LEVEL=warning
```

### Migrations (after backup)

```bash
php artisan migrate --force
```

**Never** on production:

- `migrate:fresh`
- `db:wipe`
- `migrate:fresh --seed`

Seeders: only run intentional, data-safe seeders. Do **not** overwrite live client data with demo seeders.

### Optimize

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan event:cache
```

Re-run caches after any `.env` change.

### Queues

Default queue driver in `.env.example` is `database`. If the app does not process async jobs in production yet, either:

- keep queue idle (acceptable if nothing is queued), or
- run a worker: `php artisan queue:work --sleep=3 --tries=3`

### Scheduler

`routes/console.php` schedules:

```text
notifications:generate  (hourly)
```

Production cron (example):

```cron
* * * * * cd /path/to/project && php artisan schedule:run >> /dev/null 2>&1
```

---

## 6. Database backup & restore

### Backup (example — fill credentials at runtime, not in Git)

PowerShell example: `scripts/backup-database.example.ps1`  
Bash example: `scripts/backup-database.example.sh`

Recommended practice:

- Daily automated backups
- Retain multiple versions
- Store backups off the production DB server
- Periodically restore to a **test** database (never overwrite live for drills)

### Restore (test DB only)

```bash
mysql -h HOST -u USER -p TEST_DATABASE < backup.sql
```

---

## 7. HTTPS / CORS / auth

- Serve frontend and API over **HTTPS**.
- Set `CORS_ALLOWED_ORIGINS` to exact frontend origin(s) — not `*`.
- Keep `APP_DEBUG=false`.
- Confirm `/api/health` returns JSON without stack traces.
- Confirm login → Bearer token → protected routes → logout.

---

## 8. Smoke test checklist (live)

After go-live, with a non-destructive test account:

1. Open frontend HTTPS URL  
2. Login  
3. Dashboard  
4. Products / Customers / Suppliers  
5. Sales / Rentals / Bookings / Calendar  
6. Income / Expenses  
7. Checks / Maintenance / Notifications  
8. Reports  
9. Users (admin only)  
10. Settings / Profile  
11. Logout  

API checks:

- `GET /api/health`
- Authenticated `GET /api/auth/me`
- Sample list endpoints return 200/403 appropriately

---

## 9. Admin account security

Before handing over:

- Replace any local/seed passwords with strong unique passwords.
- Confirm Admin role is assigned via `role_id`.
- Disable unused demo accounts.

---

## 10. Troubleshooting

| Symptom | Check |
|---------|--------|
| Frontend blank API errors | `VITE_API_BASE_URL` at **build** time |
| CORS blocked | `CORS_ALLOWED_ORIGINS` matches frontend origin exactly |
| 401 loops | Token expired / logout; Sanctum expiration |
| 403 on modules | Role permissions |
| Deep links 404 | SPA fallback config |
| Images missing | `php artisan storage:link` + disk permissions |
| Alerts not generating | Scheduler cron running |

---

## 11. Git

This workspace may not have Git initialized yet. Before first remote push:

```bash
git init
# confirm .gitignore covers .env, vendor, node_modules, dist, backups
git add .
git status   # ensure no secrets
git commit -m "Initial BuildTrack production-ready snapshot"
```

Never commit `.env`, database dumps, or private keys.
