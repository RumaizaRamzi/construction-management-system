# BuildTrack Backend (Laravel)

REST API for **BuildTrack Construction Management System**.

## Requirements

- PHP 8.3+
- Composer
- MySQL / MariaDB (XAMPP recommended for local Windows)

## Local database note

MySQL Server 8.0 on port `3306` on this machine requires a root password that is not configured in the project.

For local development this backend uses **XAMPP MariaDB on port `3307`**:

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3307
DB_DATABASE=buildtrack_db
DB_USERNAME=root
DB_PASSWORD=
```

Start XAMPP MySQL (or the standalone `mysqld` on 3307) before migrating.

## Setup

```bash
composer install
copy .env.example .env   # if needed
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

`--seed` creates only roles, permissions and the initial admin account. Fictional demo
business data (customers, products, sales…) is opt-in for local development only and
refuses to run in production:

```bash
php artisan db:seed --class=DemoDataSeeder
```

To remove demo/test business data from a development database before real client data entry
(development only, refuses to run in production, keeps users/roles/permissions/settings), see
[`docs/CLEAR_DEMO_DATA.md`](../docs/CLEAR_DEMO_DATA.md):

```bash
php artisan buildtrack:clear-demo-data --dry-run
```

API base URL: `http://127.0.0.1:8000/api`

## Dev login (seeded)

- Email: `admin@buildtrack.local`
- Password: `password` (initial only — change it immediately on any client/production install;
  re-running the seeder does not reset an existing password)

## Example endpoints

- `GET /api/health`
- `GET /api/products`
- `GET /api/customers`
- `GET /api/sales`
- `GET /api/rentals`
- `GET /api/bookings`
- `GET /api/income`
- `GET /api/expenses`

## CORS

Allowed origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`