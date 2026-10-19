# Campus Lost & Found

A full-stack web app for a college campus: students report lost items, post found items, claim what's theirs, and chat to arrange the handover — without their phone number or email being shown to strangers.

**Stack:** React 18 + Vite (own design system, no UI framework) · Node.js + Express · MongoDB/Mongoose · JWT in an HttpOnly cookie · Nodemailer (OTP & notifications) · Multer uploads · node-cron

## Features

| | |
|---|---|
| **Board** | Browse/search lost & found items. Search, type, category and sort **combine**; filters live in the URL, so any view can be shared; paginated. |
| **Reporting** | Post with title/description/category/date/location and an optional photo (type, size and real file header are validated server-side). |
| **Claims** | On a *found* item, "This is mine" asks for proof. The finder **reviews** it and approves/rejects; approving matches the item, closes rival claims and opens a chat. |
| **Chat** | Private per-item chat. Phone/email are revealed **only after both people choose to share** — enforced by the API, not just hidden in the UI. |
| **Accounts** | Email-OTP registration, password or email-code login, forgot/change password, one account per college ID, admin suspend/reinstate. |
| **Admin** | Overview, searchable/paginated items, claims, students; delete content, resolve claims, suspend accounts. |
| **Housekeeping** | Posts auto-close after 30 days; abandoned sign-ups are cleaned up daily. |

## Quick start (development)

Prerequisites: Node 20+, MongoDB running locally (or an Atlas URI).

```bash
# 1. API
cd backend
cp .env.example .env        # set JWT_SECRET; leave EMAIL_* blank to print OTP codes in the console
npm install
npm run dev                 # http://localhost:5000

# 2. Website (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:3000  (proxies /api and /uploads to :5000)

# 3. An admin account (optional)
cd backend && node scripts/seedAdmin.js     # uses SEED_ADMIN_* from .env
```

With no `EMAIL_USER`/`EMAIL_PASS`, verification codes are printed in the API console (`[DEV EMAIL] … OTP for you@x.edu: 123456`), so sign-up works offline.

## Production

### Docker (API + website + MongoDB)

```bash
cp .env.example .env     # JWT_SECRET (32+ chars), EMAIL_USER, EMAIL_PASS, FRONTEND_URL
docker compose up --build
docker compose exec backend node scripts/seedAdmin.js   # needs SEED_ADMIN_EMAIL/PASSWORD in .env
```

The website is served by nginx on `:8080` and proxies `/api` and `/uploads` to the API, so everything is same-origin (cookies just work). Photos are stored on the `uploads` volume.

### Without Docker

* Run `npm run build` in `frontend/` and serve `dist/` from any static host / reverse proxy that forwards `/api` and `/uploads` to the API, and falls back to `index.html` for unknown paths (see `frontend/nginx.conf`).
* Set `NODE_ENV=production`. The API **refuses to start** without `MONGO_URI`, `JWT_SECRET` (32+ chars), `FRONTEND_URL`, `EMAIL_USER` and `EMAIL_PASS`.
* Behind a proxy/PaaS set `TRUST_PROXY=1` so rate limiting sees real client IPs.
* Hosting the site and API on **different domains**? Set `VITE_API_URL` when building the frontend, and `COOKIE_SAMESITE=none` on the API.
* Point `UPLOAD_DIR` at a persistent disk. (On hosts with ephemeral disks — Render free tier, Heroku — move uploads to object storage such as S3/Cloudinary; the upload code is isolated in `itemController.js` and `services/itemCleanup.js`.)
* Health check: `GET /api/health` (returns 503 if the database is unreachable).

### Environment variables

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) — every variable is documented there.

## Testing

```bash
cd backend  && npm test     # Jest + Supertest, models mocked — no MongoDB needed
cd frontend && npm test     # Vitest + React Testing Library
```

CI (`.github/workflows/ci.yml`) runs both suites and the production build on Node 20 and 22.

## Security notes

* Poster email/phone are never returned by public item APIs; conversation APIs only include the other person's contact after **both** consented.
* OTPs are generated with `crypto.randomInt`, expire in 10 minutes, are limited to 5 wrong guesses, and can only be re-requested every 30 s. Login/reset requests never reveal whether an email is registered.
* `helmet`, request-size limits, per-IP and per-user rate limits, strict input type checks (no NoSQL-operator injection), HTML-escaped emails, magic-byte image checks, production error masking.
* Only name + phone are user-editable; password changes require the current password.

See [`CHANGES.md`](CHANGES.md) for what was changed in this overhaul and why.
