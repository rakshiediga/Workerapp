# WorkerBooking Worker Portal

Next.js, TypeScript, Tailwind CSS and App Router UI foundation.

Run `npm install`, then `npm run dev`. Open http://localhost:3001.
Customer app remains on port 3000. Run `npm run lint` and `npm run build` for validation.

Routes: `/`, `/login`, `/register`, `/dashboard`.

Registration loads professions from GET /api/categories and submits to POST /api/auth/register/worker. Login uses the shared POST /api/auth/login endpoint. Only WORKER accounts are accepted; session restoration uses the WORKER-protected GET /api/worker/profile, which returns safe account and professional profile data together. Dashboard requires authentication and displays actual identity/verification, while job statistics remain placeholders.

Copy `.env.example` to an ignored `.env.local` to configure NEXT_PUBLIC_API_URL. Backend requires PostgreSQL, migrations, seeded categories and JWT_SECRET. Configure ALLOWED_ORIGINS to include both app origins.

Worker JWT storage is centralized under workerBooking.workerAccessToken. No passwords are persisted. Production should move to an appropriate HttpOnly cookie/session architecture. Logout clears the worker session only. Job APIs are not implemented.

`/profile` is protected and supports name/email, bio (1000 characters with counter), experience, city, service area and general display starting price. It updates shared auth/profile state immediately. Phone, profession, availability, ratings and verification are read-only. Dashboard completion derives basic/professional readiness from actual fields, including zero experience as valid. Profile changes do not grant verification or marketplace visibility.

`/services` manages real WorkerService offerings from the worker's registered category. Add a service with a Decimal price, edit its price or confirm removal. The dropdown excludes configured services; the backend enforces category, ownership and uniqueness. `/availability` persists the overall worker preference, without optimistic success. At least one active offering is required to turn on; verification still independently controls customer bookings. Removing the last active offering turns availability off. Dashboard service setup and availability reflect API data.

Marketplace starting price derives from current offered services. The general price in the professional profile is legacy metadata. No job request/workflow, earnings, verification approval or scheduling APIs are implemented.
