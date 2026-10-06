# WorkerBooking Admin Panel

Run npm install, then npm run dev (port 3002). Copy .env.example for NEXT_PUBLIC_API_URL configuration.

Step 30 uses the shared backend POST /api/auth/login with email/password and GET /api/auth/me for role/active-account validation and restoration. All management routes use a client auth guard and render a session loading state first. Backend /api/admin routes enforce authentication and ADMIN authorization independently. No public admin signup exists. Bootstrap instructions are in backend/README.md.

The MVP stores only the token using the admin-specific workerbooking_admin_token key. Production should prefer secure HttpOnly cookie/session architecture. Logout removes only that key. No secrets or bootstrap credentials belong in the frontend.

Dashboard metrics and management pages remain placeholders until later steps.
