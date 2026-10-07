# Clearing demo/test data before real client data entry

`php artisan buildtrack:clear-demo-data` removes the demo and test **business records** from a
development database so the client's real data can be entered on a clean system.

> **Never run this on a production/live database.** The command refuses to run when
> `APP_ENV=production`, but that is only a safety net. On any database that might hold real
> client data, take a full backup and review the dry-run output first. Deleted records cannot be
> recovered without a backup.

## What it deletes

All rows in these business tables, children first so foreign keys are respected
(`DELETE`, never `TRUNCATE`, inside a single transaction — if anything fails, nothing is deleted):

| Area | Tables |
|------|--------|
| Rental returns | `rental_return_items`, `rental_returns` |
| Payments | `rental_payments`, `sale_payments`, `income_payments`, `expense_payments` |
| Sales | `sale_items`, `sales` |
| Bookings | `booking_items`, `bookings` |
| Rentals | `rental_items`, `rentals` |
| Operations | `equipment_checks`, `maintenance_records`, `reminders` |
| Inventory | `stock_movements`, `products`, `categories` |
| Contacts | `customers`, `suppliers` |
| Finance | `income`, `expenses`, `cheques` |
| Staff | `attendances`, `staff_assignments`, `staff` |
| Vehicles | `vehicle_maintenance`, `vehicle_rentals`, `vehicles` |
| Logs & alerts | `notifications`, `activity_logs`, `audit_logs` |

After the cleanup it writes **one** activity/audit entry ("Demo/test business data cleared")
listing how many records were deleted from each table.

## What it preserves

- `users` — every account, including the admin (password and name are not touched)
- `roles`, `permissions`, `role_permissions`
- `personal_access_tokens`, `sessions`, `password_reset_tokens`
- `settings` — company fields, tax rate, invoice prefix, rental terms, logo path, notification
  toggles are left exactly as they are (currently the company fields are empty)
- `staff_roles` (Manager, Driver, …) and `branches` — configuration, not demo records
- `migrations`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`
- The database schema (no tables or columns are dropped)
- Uploaded files in `storage/app/public` (e.g. the company logo)

## How to run it safely

1. Confirm you are pointing at the **development** database:
   check `.env` (`APP_ENV`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`).
2. Back up the database, e.g. with XAMPP MariaDB on port 3307:

   ```bash
   mysqldump -h 127.0.0.1 -P 3307 -u root buildtrack_db > buildtrack_db_backup.sql
   ```

3. Preview (deletes nothing):

   ```bash
      php artisan buildtrack:clear-demo-data --dry-run
   ```

4. Run it. Without `--confirm` it shows the counts and asks for a yes/no confirmation
   (default **no**):

   ```bash
   php artisan buildtrack:clear-demo-data
   ```

   `--confirm` skips the prompt (use only when you have already reviewed the dry run).

5. Log in, change the admin password, fill in **Settings → Company**, then enter real
   products, categories, customers and suppliers (see `docs/CLIENT_DATA_CHECKLIST.md`).

## Notes

- Record IDs continue from the previous auto-increment values (e.g. the first new product may
  be ID 10). Document numbers restart: the next invoice is `INV-<year>-001`.
- The `staff@buildtrack.local` test account is a user and is therefore kept — disable or remove
  it manually from **Users** if it is not wanted.
- Restore from the backup if needed:
  `mysql -h 127.0.0.1 -P 3307 -u root buildtrack_db < buildtrack_db_backup.sql`
