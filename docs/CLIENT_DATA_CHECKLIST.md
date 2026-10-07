# BuildTrack — Client Data Checklist (internal)

Tick each item only when the **real** value has been supplied by the client and entered in the
application. Never fill a missing item with invented data — leave it blank; the app shows a
"CLIENT DATA REQUIRED" notice on Settings, invoices and rental agreements until it is set.

Where to enter: **Settings → Company** (company items), **Products / Categories**,
**Customers**, **Suppliers**.

## COMPANY

- [ ] Company name — currently empty
- [ ] Address — currently empty
- [ ] Phone — currently empty
- [ ] Email — currently empty
- [ ] Tax number — currently empty (hidden on documents while empty)
- [ ] Logo — not uploaded (Settings → Company → Logo, PNG/JPG/WebP)
- [ ] Bank details — currently empty (hidden on invoices while empty)
- [ ] Invoice prefix — default `INV-` (confirm or change; applies to new invoices only)
- [ ] Tax rate — currently `0` % (confirm; applies to new sales only, never retroactively)
- [ ] Rental terms — currently empty (agreements print standard generic terms until set)

Also confirm: currency (`LKR`), rental deposit % (`20`), late fee per day (`2500`),
invoice footer, company subtitle, website, business registration.

## PRODUCTS

- [ ] Product list
- [ ] Categories
- [ ] Purchase prices
- [ ] Sale prices
- [ ] Rental prices
- [ ] Stock quantities
- [ ] Low-stock thresholds
- [ ] Product images (note: the product form currently offers only built-in placeholder
      illustrations; uploading real product photos is not supported yet)

## CUSTOMERS

- [ ] Customer list
- [ ] Contact details

## SUPPLIERS

- [ ] Supplier list
- [ ] Contact details

## USERS / ACCESS

- [ ] Change the initial admin password (`admin@buildtrack.local` / `password`)
- [ ] Rename the admin user (currently the demo name "Alex Morgan") and create real staff accounts
- [ ] Remove or disable the `staff@buildtrack.local` test account

## Existing demo / test records in the development database

The development database (`buildtrack_db`) currently contains **only demo seed data and
records created during testing** — no real client data. None of it has been deleted.
Decide with the client before entering real data whether to start from an empty database.

| Area | Demo / test records |
|------|---------------------|
| Customers | CUST-001 … CUST-006 (ABC Construction, BuildPro, Metro Builders, GreenLine, Royal Construction, Summit Structures) |
| Suppliers | SUP-001 … SUP-005 (seed), SUP-006 "Phase23 Supplier …" (test) |
| Categories | 8 seed categories + "Phase23 Test Cat …" (test) |
| Products | CME-001 … RHM-008 (seed), P23-9549AA "Phase23 Test Product" (test) |
| Sales | INV-2026-001 … INV-2026-007 |
| Rentals | RNT-2026-001 … RNT-2026-005 |
| Bookings | BKG-2026-001 … BKG-2026-004 |
| Income / Expenses | INC-001 … INC-003, EXP-001 … EXP-003 |
| Checks / Maintenance | CHK/MNT records assigned to fictional names (Mike Torres, Sara Patel, Nimal Fernando) |
| Reminders | "Inspect scaffolding", "Phase 24 reminder", "Dismiss test", "Monthly service" |
| Notifications, stock history, activity logs | generated from the records above |

To clear these records safely (backup first, dry run, then confirm), follow
`docs/CLEAR_DEMO_DATA.md` — `php artisan buildtrack:clear-demo-data`.

A fresh client installation does **not** receive this data: `php artisan migrate --seed`
seeds only roles, permissions and the initial admin. Demo data is opt-in
(`php artisan db:seed --class=DemoDataSeeder`) and refuses to run in production.
