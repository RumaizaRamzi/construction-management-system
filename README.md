# BuildTrack — Construction Management System

React (Vite) frontend + Laravel API + MySQL, all in this one folder:

- `src/` — React source, `resources/static/` — favicon, images (copied into `public/` on build)
- `app/`, `routes/`, `config/`, `database/`, `vendor/`, `artisan` — Laravel
- `public/` — web root (Laravel `index.php` + the built React app)

## Local development

```bash
cp .env.example .env
# set local DB credentials (VITE_API_BASE_URL=http://127.0.0.1:8000/api is for the dev server), then:
composer install
npm install
php artisan key:generate
php artisan migrate
php artisan storage:link
php artisan serve        # API + built app on http://127.0.0.1:8000
npm run dev              # optional: frontend dev server with hot reload on http://localhost:5173
```

Dev admin (local seed only — change immediately in production):

- Email: `admin@buildtrack.local`
- Password: set via seeder locally; never reuse on production

## Production

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for full go-live steps, backups, CORS/HTTPS, and checklists.

Quick production build (cPanel):

```bash
npm ci
npm run build   # builds the React app into public/ (API is always /api on the same domain)
# upload the whole project folder; web root = public/
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend development server |
| `npm run build` | Frontend production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Lint frontend |

## Security notes

- Never commit `.env` files or real passwords.
- Never put database credentials in `VITE_*` variables.
- Production must use `APP_DEBUG=false` and HTTPS.
