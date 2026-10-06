# Worker Booking API database foundation

This shared Express API uses PostgreSQL and Prisma ORM 7.10.0. Node.js 22.12+ in the 22.x release line is supported; the existing Node 22.17 setup can remain unchanged.

## Local setup

1. Install and start PostgreSQL. Create an empty development database named `worker_booking` and a database user with access to it. Prisma development migrations also need permission to create a shadow database (or a separately configured shadow database). Use a development database, not production.
2. Run `npm install` inside `backend`.
3. Copy `.env.example` to `.env` if `.env` does not already exist. Keep existing `PORT`, `NODE_ENV`, and `FRONTEND_URL` values. Replace the `DATABASE_URL` placeholders with your actual PostgreSQL user, password, host, port, and database name. URL-encode special characters in credentials. `.env` is ignored by Git.

   Example structure only, with no real credentials:

   ```dotenv
   DATABASE_URL="postgresql://DB_USER:REPLACE_WITH_PASSWORD@localhost:5432/worker_booking?schema=public"
   ```

4. Run these commands from `backend`:

   ```powershell
   npm run db:validate
   npm run db:migrate -- --name init
   npm run db:generate
   npm run db:seed
   npm run typecheck
   npm run build
   npm run dev
   ```

Prisma 7 runs seeds only when explicitly requested. The seed upserts eight categories and example services by unique slug, so rerunning it does not duplicate records or replace existing prices. It creates no customer, worker, or admin accounts.

Validation, client generation, typechecking, and compilation work without a database URL. Migrations and seeding require a valid `DATABASE_URL` and a reachable PostgreSQL server. Client output is generated in `src/generated/prisma` and excluded from Git; `pretypecheck` and `prebuild` regenerate it automatically. `prisma.config.ts` configures the datasource, migrations path, and seed command.

## Commands

- `npm run dev`: TypeScript development server using tsx watch.
- `npm run build`: Generate the client, then compile the backend into `dist`.
- `npm start`: Run the compiled backend after building.
- `npm run typecheck`: Check application code, Prisma configuration, and seed script.
- `npm run db:validate`: Validate the Prisma schema without applying changes.
- `npm run db:generate`: Regenerate the Prisma client.
- `npm run db:migrate -- --name init`: Create and apply the initial development migration once PostgreSQL is configured.
- `npm run db:deploy`: Apply committed migrations in deployment environments. This does not create migrations.
- `npm run db:seed`: Seed categories and services explicitly.
- `npm run db:studio`: Open Prisma Studio for a configured database.

## API checks

- `GET http://localhost:5000/`: Existing root response.
- `GET http://localhost:5000/api/health`: Existing success/message fields plus `database`: `connected`, `not_configured`, or `unavailable`. This remains HTTP 200 for API liveness; database connection failures do not expose credentials or error details. Connection acquisition and query timeouts are bounded.
- Unknown routes continue to return JSON HTTP 404.

## Schema decisions

Models: User, WorkerProfile, Category, Service, WorkerService, Address, Booking, BookingStatusHistory, Review, and Payment.

- UUID primary keys; timezone-aware audit timestamps; booking dates stored as PostgreSQL dates.
- Monetary fields use Decimal/Numeric, not floating point. Worker aggregate rating uses Decimal; individual review ratings use Int.
- Unique phone, optional unique email, unique category/service slugs and booking numbers, unique worker/service pairs, and one review/payment per booking. Unique constraints already supply indexes; no redundant indexes are added for these fields.
- Query indexes cover customer bookings, worker/status/date lookups, availability/verification, category services, address defaults, and history/review lists.
- Booking address/contact fields are snapshots and have no dependency on a saved Address. Editing or deleting a saved address cannot alter historical bookings.
- Historical relations use restrictive deletes. Only optional history attribution uses `SetNull`; bookings, reviews, payments, and status history are never cascade-deleted. Prefer user/category/service deactivation.
- User-role rules, one-default-address business logic, and review rating range validation will be implemented with later business APIs. No role validation, authentication, status transition, or payment API is included here.

No migrations or seed records are applied unless you configure PostgreSQL and run the commands above. Generated code and a valid schema alone do not create database tables.

## Customer authentication (phone + password)

Set `JWT_SECRET` in your ignored `.env` to a securely generated random secret of at least 32 bytes. The example placeholder is rejected; there is no hardcoded fallback. `JWT_EXPIRES_IN` defaults to `7d` and supports positive durations such as `30m`, `1h`, `7d`, or an integer number of seconds. JWTs contain only `userId`, `role`, and standard issued-at/expiry claims, and use HS256.

`User.passwordHash` is nullable to support future OTP accounts. Password registration stores only bcrypt hashes (cost 12). Password input is 8+ characters and at most 72 UTF-8 bytes to avoid bcrypt truncation. Phone input is normalized to ten digits; email is optional and lowercased. Customer registration always sets CUSTOMER, ignoring any requested role.

If you have already applied the initial database migration, run:

```powershell
npm run db:migrate -- --name add_user_auth
npm run db:generate
npm run typecheck
npm run build
npm run dev
```

If PostgreSQL has never been configured, first create the database and configure `DATABASE_URL`, then run `npm run db:migrate -- --name init` to create the entire current schema, including the password hash. Do not run a reset against existing data.

Endpoints:

- `POST /api/auth/register/customer`: body `{ "name": "Rahul Kumar", "phone": "9876543210", "email": "rahul@example.com", "password": "StrongPassword123" }`; returns HTTP 201, a safe user object, and `data.accessToken`.
- `POST /api/auth/login`: body `{ "phone": "9876543210", "password": "StrongPassword123" }`; returns HTTP 200 with safe user information and a JWT. Unknown users, wrong passwords, inactive accounts, and accounts without a password hash all get the same HTTP 401 credential failure.
- `GET /api/auth/me`: `Authorization: Bearer <accessToken>`; returns the current active user without a password hash. Missing/invalid tokens return HTTP 401; an inactive authenticated account returns HTTP 403.
- `GET /api/customer/test`: same header; requires CUSTOMER and returns `Customer protected route`. The middleware rechecks the current database role and activation on every protected request.

For a local manual test in PowerShell (sample credentials only):

```powershell
$body = @{ name = 'Rahul Kumar'; phone = '9876543210'; email = 'rahul@example.com'; password = 'StrongPassword123' } | ConvertTo-Json
$registration = Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/register/customer' -ContentType 'application/json' -Body $body
$loginBody = @{ phone = '9876543210'; password = 'StrongPassword123' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:5000/api/auth/login' -ContentType 'application/json' -Body $loginBody
$headers = @{ Authorization = "Bearer $($login.data.accessToken)" }
Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/me' -Headers $headers
Invoke-RestMethod -Uri 'http://localhost:5000/api/customer/test' -Headers $headers
```

Repeat registration to check HTTP 409, use a wrong password to check HTTP 401, and call `/me` without a token to check HTTP 401. Failed server/configuration/database operations return safe JSON without internal stack traces. Missing JWT or database configuration returns HTTP 503. The public root and health routes remain available.

Registration is limited to 10 requests per 15 minutes per IP, login to 30. The established Express rate limiter uses an in-memory single-process store; multi-instance deployments will need a shared store. No proxy is trusted automatically: configure Express `trust proxy` for your actual reverse proxy before deployment rather than trusting arbitrary forwarded headers.

Run `npm test` for isolated authentication/HTTP tests using an in-memory Prisma test double with real bcrypt and JWT libraries. These tests do not establish that migrations, registration, or login work against PostgreSQL. Real end-to-end database testing requires a configured database and applied migrations. There is no OTP, public worker/admin registration, or frontend integration in this step.

Public marketplace endpoints (no token required):

- GET /api/categories
- GET /api/categories/:slug/services
- GET /api/services?category=plumber
- GET /api/workers?category=plumber&availability=true&sort=rating
- GET /api/workers/:id

Worker filters: category/service slugs, availability=true|false, sort=rating|price|experience. Only active WORKER accounts with VERIFIED profiles and active offerings are public. Money and aggregate ratings are decimal strings. Worker locations are not modeled yet.

Optional fictional workers for development (PowerShell, after migrations):

```powershell
$env:NODE_ENV = "development"
$env:SEED_DEVELOPMENT_WORKERS = "true"
npm run db:seed
Remove-Item Env:SEED_DEVELOPMENT_WORKERS
```

This creates three fictional worker accounts with reserved dummy phone values (0000000001?0000000003), VERIFIED profiles and plumbing offerings. No worker passwords or review history are seeded. Repeated seeding preserves existing records. The flag is rejected in production. Ordinary seeding creates catalogue data only.

Customer booking API (CUSTOMER Bearer token required):

- POST /api/bookings
- GET /api/bookings/my?status=REQUESTED
- GET /api/bookings/:bookingNumber
- PATCH /api/bookings/:bookingNumber/cancel

Creation accepts workerId, serviceId, bookingDate (YYYY-MM-DD), bookingTime (HH:mm), address (label optional; houseFlat, streetArea, city, state, six-digit pincode required; landmark optional), and optional problemDescription. Never send customerId, customerPhone, status or bookingNumber: the API rejects them. Client price is ignored; the price is read from WorkerService. Customer identity/phone come from the authenticated active CUSTOMER.

Dates and time slots use Asia/Kolkata. Slots: 09:00, 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00, 18:00. Past dates are rejected; this is not a scheduling engine.

Booking creation and its initial REQUESTED history are atomic. Only owned REQUESTED bookings can be cancelled; a conditional UPDATE and history insert share a transaction. Unknown or unowned booking numbers both return 404. Prices remain decimal strings. Legacy frontend local bookings are not imported.

Run npm test for isolated auth, marketplace and booking HTTP/security tests. These use a database double and do not prove PostgreSQL persistence. Configure backend .env (DATABASE_URL and JWT_SECRET), apply migrations, and enable the documented development-worker seed to test the actual browser flow. For direct database inspection use npm run db:studio: verify Booking.customerId, WorkerService-derived price, address/contact snapshots, and REQUESTED/CANCELLED BookingStatusHistory rows.

Customer saved-address API (CUSTOMER Bearer token required):

- GET /api/addresses
- POST /api/addresses
- PATCH /api/addresses/:id
- DELETE /api/addresses/:id
- PATCH /api/addresses/:id/default

Required fields: label, houseFlat, streetArea, city, state, six-digit pincode. Landmark is optional. PATCH accepts partial address fields. IDs, ownership, coordinates, default flags and timestamps cannot be assigned through the request body. Latitude/longitude remain null for new addresses.

Each mutation locks the authenticated customer's User row with parameterized SELECT FOR UPDATE inside a transaction. This serializes default-affecting operations, including concurrent first-address creations. The first address is automatically default; deleting a default promotes the newest remaining address (ID descending breaks timestamp ties). List results are default first, then newest first. Unknown and unowned IDs both return 404.

Booking address snapshots do not reference saved address IDs and remain unchanged after edits/deletion. Legacy local addresses are neither displayed nor automatically imported. Address tests use an isolated database double; configure DATABASE_URL/JWT_SECRET to verify real PostgreSQL persistence and row locking.

Customer profile API (active CUSTOMER Bearer token required):

- GET /api/profile returns the same safe user representation as GET /api/auth/me, including createdAt.
- PATCH /api/profile accepts name (required, trimmed, 2–100 characters) and optional email. Email is trimmed/lowercased; blank or null clears it. Omitting email preserves it.

Unsupported fields, including phone, role, ownership and account flags, return 400. An email already owned by another user returns 409. PostgreSQL uniqueness protects concurrent email changes. No schema migration is needed. The customer UI updates shared auth state after saving and keeps address operations independent. Run npm test for isolated profile security/regression tests; actual PostgreSQL persistence requires DATABASE_URL and JWT_SECRET.

Worker authentication:

- POST /api/auth/register/worker accepts name, phone, profession (active category slug), city, password. No other fields are accepted.
- POST /api/auth/login and GET /api/auth/me are shared across roles.
- GET /api/worker/profile requires an active WORKER token and returns only the authenticated worker's basic onboarding profile.

Registration hashes passwords with bcrypt cost 12 and creates User plus WorkerProfile in one transaction. Workers start PENDING, unavailable, with zero experience/prices/ratings. Registration has the same rate limiting as customer registration. City and optional primaryCategoryId are new nullable WorkerProfile fields; primaryCategory records the onboarding profession, while WorkerService remains the source of offered services/prices and marketplace discovery. Existing public visibility rules are unchanged.

Configure DATABASE_URL/JWT_SECRET before actual registration. No migration has been applied in an unconfigured environment. With an existing initialized database run `npm run db:migrate -- --name add_worker_city`, then `npm run db:generate`. If no initial migration/database exists yet, create the initial schema with `npm run db:migrate -- --name init`, generate, and run `npm run db:seed` for categories/services.

ALLOWED_ORIGINS is a comma-separated browser origin allowlist. Set both http://localhost:3000 and http://localhost:3001 for development. It overrides FRONTEND_URL. Production permits only explicitly configured origins; no wildcard is used. Isolated worker tests cover rollback, role separation, duplicates and customer regression; they do not prove actual PostgreSQL persistence.

Worker professional profile:

GET /api/worker/profile now returns safe user and professional profile data together. PATCH on the same path accepts only name, email, bio, experienceYears, city, serviceArea and startingPrice. PATCH supports partial updates. Name/city cannot be blank when supplied; bio has a 1000-character limit, serviceArea 200, experience is integer 0–60. Prices must be decimal strings (non-negative, at most two decimal places, fitting Decimal(12,2)). Empty optional text/email is stored as null. Duplicate email returns 409.

User and WorkerProfile updates share a transaction. Phone, role, availability, ratings, verification and profession cannot be changed here. Authenticated user ID determines ownership; there is no editable-ID route. Public worker queries still require VERIFIED workers with active accounts/services; public location/bio/price changes are shown without exposing phone/email.

The only schema addition for this step is nullable WorkerProfile.serviceArea. After configuring an existing database, run `npm run db:migrate -- --name add_worker_profile_fields` and `npm run db:generate`. For a never-initialized database use the initial migration workflow above. No migration or real database persistence test is claimed without PostgreSQL configuration.

Worker services and availability (active WORKER Bearer token required):

- GET /api/worker/services lists the worker's offered services and Decimal price strings.
- GET /api/worker/available-services lists active services in the registered primary category.
- POST /api/worker/services accepts only serviceId and price.
- PATCH /api/worker/services/:id accepts only price.
- DELETE /api/worker/services/:id removes only an owned offering.
- PATCH /api/worker/availability accepts only isAvailable (boolean).

Prices must be decimal strings, greater than zero, at most 1000000.00, with no more than two decimal places. Existing workerId/serviceId uniqueness protects duplicates (409). Unknown and unowned offering IDs both return 404. No schema change or migration is required.

Availability is a worker preference: pending workers with at least one active service may turn it on, but only VERIFIED active workers with an active offering are publicly discoverable; availability must also be on for booking. Unavailable verified workers can remain visible with unavailable status, as before. Service and availability mutations lock the worker's User row inside a transaction to serialize last-service removal against turning availability on. Removing the final active offering turns availability off automatically.

Public starting price is derived from minimum active WorkerService.price (matching the service/category filter for lists), and price sorting uses that Decimal value. WorkerProfile.startingPrice remains legacy profile metadata and does not control marketplace or booking prices. Historical bookings reference Service and retain their price/address snapshots, so deleting an offering does not delete bookings. New bookings require a current offering and derive price server-side. Tests use database doubles; live persistence/concurrency requires configured PostgreSQL.

## Worker booking actions (Step 24)

WORKER-authenticated routes:

- PATCH `/api/worker/job-requests/:bookingNumber/accept` takes no body.
- PATCH `/api/worker/job-requests/:bookingNumber/reject` optionally takes `{ "reason": "Unavailable at requested time" }` (trimmed, maximum 500 characters).
- GET `/api/worker/jobs` returns only the assigned worker's ACCEPTED bookings.
- GET `/api/worker/jobs/:bookingNumber` returns an assigned booking's details, including real status history.

Accept/reject performs a conditional, worker-owned REQUESTED update and writes history in one transaction. Unowned bookings return 404; stale requests return 409. Retries cannot add duplicate transition history. The existing REQUESTED-only customer cancellation races against the same booking row. Booking price and address snapshots are unchanged. Worker detail responses return Booking.customerPhone only while ACCEPTED; request lists, accepted-job cards and cancelled details omit it. History returns safe actor role and optional reason, not actor IDs or private account fields.

### Migration setup

This repository previously had no committed migration history. `20261002000000_existing_schema` establishes the pre-Step-24 schema; `20261003000000_add_booking_status_reason` adds only nullable `BookingStatusHistory.reason`. Neither migration has been applied in the unconfigured development workspace.

For a new empty PostgreSQL database, configure `.env`, then run:

```powershell
npm run db:deploy
npm run db:generate
```

For an existing database without Prisma migration history, first confirm its schema matches the pre-Step-24 baseline. Mark that baseline as applied instead of attempting to recreate existing tables, then apply the reason migration:

```powershell
npx prisma migrate resolve --applied 20261002000000_existing_schema
npm run db:deploy
npm run db:generate
```

If the existing database has a different schema or migration history, reconcile that history before deployment. Do not reset existing data. Run `npm test` for isolated HTTP/transaction tests; live PostgreSQL concurrency and persistence still require a configured database.

## Worker job lifecycle (Step 25)

- PATCH `/api/worker/jobs/:bookingNumber/start`: ACCEPTED to IN_PROGRESS.
- PATCH `/api/worker/jobs/:bookingNumber/complete`: IN_PROGRESS to COMPLETED.

Both actions require an active authenticated WORKER and take no body. Unsupported fields are rejected. The existing centralized transition transaction maps each explicit action to its required source/destination statuses, conditionally updates the assigned booking and records its history/actor atomically. Duplicate or stale Start/Complete returns 409; an unowned booking returns safe 404. No generic client-selected status endpoint exists. Customer cancellation remains REQUESTED-only.

GET `/api/worker/jobs` now returns ACCEPTED, IN_PROGRESS and COMPLETED jobs only. Optional `status` accepts exactly one of these three values; invalid filters return 400. New requests stay under `/api/worker/job-requests`. Job detail exposes the booking phone snapshot to its assigned worker for ACCEPTED, IN_PROGRESS and COMPLETED, while REQUESTED/CANCELLED and list responses omit it. Price and address snapshots never change during workflow transitions.

Worker My Jobs has Active (ACCEPTED/IN_PROGRESS) and Completed tabs. Dashboard counts use REQUESTED, ACCEPTED/IN_PROGRESS and COMPLETED respectively; earnings remain a development placeholder. Status history uses backend timestamps. Existing customer status tabs/timeline already support the full lifecycle, so no customer source changes are needed. Step 25 changes no Prisma schema and adds no migration. Tests use isolated database doubles; live PostgreSQL verification remains dependent on database configuration.

## Worker job history and dashboard (Step 26)

GET `/api/worker/jobs` returns worker-owned non-REQUESTED bookings, including CANCELLED. The optional `status` filter accepts ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED, or a comma-separated combination of those values. REQUESTED and invalid/repeated query parameters are rejected where ambiguous. Pagination defaults to `page=1&limit=20`; limit is capped at 50. The response contains `data.jobs` and `data.pagination` (page, limit, total, totalPages). Ordering is updatedAt descending, then id descending. Count and page queries use a repeatable-read transaction.

GET `/api/worker/dashboard` requires an active WORKER. It returns newRequests, activeJobs, completedJobs, cancelledJobs and at most three request/active previews each. Counts use database count queries scoped to JWT ownership, never full-list downloads. No earnings are calculated. My Jobs uses Active, Completed and Cancelled tabs with real summary counts and Previous/Next pagination. Completed dates come from history, cancellation labels/reasons come from recorded actors, and cancelled contacts remain hidden. Existing Start/Complete actions and customer REQUESTED-only cancellation remain unchanged.

No Prisma schema or migration changes are made for Step 26. HTTP tests use an isolated transactional database double; browser checks use controlled API fixtures. Live PostgreSQL persistence and database connection concurrency tests require DATABASE_URL, which is not configured in this workspace.

## Worker gross earnings (Step 27)

GET `/api/worker/earnings/summary` returns totalGrossEarnings, todayGrossEarnings, monthGrossEarnings as two-decimal strings, completedJobs, and timezone. GET `/api/worker/earnings?page=1&limit=20` returns safe completed-booking history and the existing pagination structure (maximum limit 50). Both require an active WORKER; ownership always comes from JWT. Dashboard reuses the same aggregation service for todayGrossEarnings.

Gross earnings mean COMPLETED Booking.price snapshots, not received payments, net earnings, commission or payouts. Parameterized PostgreSQL SUM/COUNT perform aggregation without loading all bookings. Each booking contributes once; MIN(COMPLETED history.createdAt) defensively chooses its first completion event. History sorts by this timestamp descending with stable booking ID ordering. Completed legacy rows missing an event still contribute to all-time totals/counts, but never to today/month; history exposes a null completedAt rather than inventing a date.

APP_TIMEZONE defaults to Asia/Kolkata and is documented in .env.example. Native Intl validates the timezone; PostgreSQL classifies completion timestamps against CURRENT_TIMESTAMP in that timezone. Browser display follows the returned timezone. No timezone package, Prisma schema change, earnings model or migration is needed. Payment rows are not read or changed.

Tests use isolated database doubles and browser API fixtures. Configure DATABASE_URL to verify actual PostgreSQL queries, persistence and live end-to-end behavior; this workspace has no configured database. No customer/admin source changes are required.

## Worker verification / KYC (Step 28)

GET and multipart POST `/api/worker/verification` require an active WORKER. Ownership comes only from JWT. Existing PENDING/VERIFIED/REJECTED/SUSPENDED statuses remain unchanged. PENDING with null verificationSubmittedAt means Not Submitted; a submission timestamp means Pending Review. Workers may submit initially or after REJECTED only. Pending review returns 409, VERIFIED returns 409, SUSPENDED returns 403. There is no worker/admin approval endpoint in this step.

Fields: fullLegalName (2–100 characters), documentType (AADHAAR/PAN/DRIVING_LICENSE/VOTER_ID), documentNumber (format-validated in memory). Only the last four characters are persisted; responses contain a masked value. Front file is mandatory; back is mandatory except for PAN. No bank data or address-proof collection is added. Unknown/protected fields are rejected. API responses expose safe own metadata, never file keys, full document numbers, or public URLs.

Multer memory uploads enforce at most two files, 5 MB each, strict multipart field/part limits, and submission rate limiting. File-type validates byte signatures; supported filenames and MIME types must be JPEG, PNG or PDF. Original filenames never become storage paths. The replaceable local adapter writes generated UUID filenames into backend/uploads/verification, outside source directories, with restrictive permissions where supported. uploads/ is gitignored and is not statically served. There is no document download endpoint. Protect host filesystem access/ACLs; this is a local development storage adapter, not a production object-storage deployment.

A conditional profile update and one-per-worker verification upsert run atomically. Concurrent submissions cannot overwrite a pending review or an admin status change. Failed database writes remove newly written files; rejected resubmissions remove old documents only after successful commit. Filesystem failures log only a generic cleanup warning. A process crash between filesystem and database operations may require manual orphan-file maintenance; no background cleanup service is introduced.

Migration: 20261007000000_add_worker_verification. Prisma format/validate/generate succeeded; migration is NOT applied because DATABASE_URL is unconfigured. After configuring an appropriate development database, run `npm run db:deploy` from backend (see existing baseline instructions before deploying to an existing database). No public marketplace or booking verification filters were weakened.

Tests use isolated database doubles, real synthetic local files, and browser API fixtures. No genuine identity documents are used. Live PostgreSQL persistence/concurrency and migration application require database configuration. Dependency audit reports four existing high-severity Prisma development-toolchain advisories; new upload packages have no reported advisory. No forced Prisma downgrade or unrelated dependency change is made.

## Initial administrator

Set DATABASE_URL and strong JWT_SECRET as usual, then set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD in your ignored backend/.env. The password must be 12?72 UTF-8 bytes with uppercase, lowercase and a number. Example environment values are placeholders, not usable credentials. Run `npm run admin:create` explicitly, then start the backend and sign in at the Admin Panel using email/password. This command never runs on server startup, resets passwords, or promotes customer/worker accounts. Repeating matching email/phone returns an already-existing message. No public admin registration exists.

POST /api/auth/login now accepts either email/password or the existing phone/password. GET /api/auth/me returns safe account data. GET /api/admin/health requires active ADMIN authentication. Add the Admin Panel origin to ALLOWED_ORIGINS when using an existing .env; no wildcard is permitted.
