# BuildTrack production go-live checklist

Mark each item during the real hosting deployment.

## Source control
- [ ] Git repository initialized / remote configured
- [ ] `.gitignore` excludes `.env`, `vendor`, `node_modules`, `dist`, dumps
- [ ] No secrets in tracked files (`git status` / `git diff` reviewed)

## Frontend
- [ ] `VITE_API_BASE_URL` set for production build
- [ ] `npm ci && npm run build` succeeds
- [ ] `dist/` deployed to static host
- [ ] SPA fallback configured (deep links work)
- [ ] Assets load over HTTPS

## Backend
- [ ] Document root = `public`
- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_KEY` set (not rotated casually)
- [ ] `composer install --no-dev --optimize-autoloader`
- [ ] `php artisan storage:link`
- [ ] `config/route/view/event` caches built after correct `.env`

## Database
- [ ] Backup taken **before** migrate
- [ ] Backup file verified / restore tested on **test** DB
- [ ] `php artisan migrate --force` only (no fresh/wipe)
- [ ] Demo seed data not applied over live data

## Security
- [ ] HTTPS on frontend and API
- [ ] CORS origins restricted to frontend domain(s)
- [ ] `.env` not web-accessible
- [ ] Strong admin password
- [ ] Seed/demo weak accounts removed or disabled
- [ ] Logs do not contain passwords/tokens

## Automation
- [ ] Scheduler cron configured (`schedule:run`)
- [ ] Queue worker configured **if** required
- [ ] `notifications:generate` runs without duplicates storm

## Smoke test
- [ ] Login / logout
- [ ] Dashboard, Products, Customers, Sales, Rentals, Bookings
- [ ] Calendar, Income, Expenses, Checks, Maintenance
- [ ] Notifications, Reports, Users, Settings
- [ ] 403/404 pages behave professionally
- [ ] API health + authenticated me endpoint
