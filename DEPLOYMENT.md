# Deployment guide

How to put Campus Lost & Found on the internet and keep it healthy. Written for one person setting this up for a college, so it favours **simple and recoverable** over clever.

**Contents**
0. [Choose a setup](#0-choose-a-setup) · what was tested

1. [Before you start](#1-before-you-start)
2. [Environment variables](#2-environment-variables) · [generating secrets](#generate-the-secrets)
3. [Email (verification codes)](#3-email-verification-codes)
4. [Setup A — Docker Compose on one server](#4-setup-a--docker-compose-on-one-server-recommended) · [HTTPS](#44-https-with-caddy)
5. [Setup B — Manual (Node + nginx + PM2)](#5-setup-b--manual-node--nginx--pm2)
6. [Setup C — Website and API on different hosts](#6-setup-c--website-and-api-on-different-hosts)
7. [MongoDB: Atlas or self-hosted](#7-mongodb)
8. [Push notifications](#8-push-notifications)
9. [Go-live checklist](#9-go-live-checklist)
10. [Running it: updates, backups, logs, monitoring](#10-running-it)
11. [Security checklist](#11-security-checklist)
12. [Troubleshooting](#12-troubleshooting)
13. [Appendix: how the pieces fit](#13-appendix)

---

## 0. Choose a setup

| | Best for | Effort | Notes |
| --- | --- | --- | --- |
| **A. Docker Compose on one VPS** | Almost everyone. A college pilot. | ★☆☆ | One command starts MongoDB + API + website. Photos live on a Docker volume. **Recommended.** |
| **B. Manual: Node + nginx + PM2** | You already run servers and don't want Docker. | ★★☆ | Same result, more steps. MongoDB Atlas or your own. |
| **C. Split hosting** (static host + API host) | You want the website on a CDN/static host. | ★★★ | Needs a persistent disk for photos and a few extra settings. Least tested path. |

A single small server is plenty for a campus: **1 vCPU, 1–2 GB RAM, 20 GB disk** runs everything in Setup A.

### What has and hasn't been verified

Be aware of how far this guide has been proven:

| Verified (actually run) | Not run here — follow carefully |
| --- | --- |
| Clean production install (`npm ci --omit=dev`) and boot of the API with production settings; refusal to start with missing/weak config; CORS in production; graceful shutdown; `npm run vapid` | **`docker build` / `docker compose up` themselves** (no Docker in the test environment — the steps inside the Dockerfiles were run by hand) |
| `frontend/nginx.conf` + `security-headers.conf` in **real nginx** in front of the production API: security headers on every route, SPA deep links, caching, gzip, upload size limit, API proxying | The backup/restore commands (`mongodump`, `mongorestore`, `tar` inside containers) |
| **Setup B §5.3 executed literally** (the `cp` and `sed` lines, `nginx -t`, then requests through it) | Package installs in Setup B (NodeSource, PM2, certbot) and the Caddy/certbot HTTPS steps — standard commands, not executed |
| The full user journey in a real browser through nginx (a CSP-blocked injected script, service worker registration, deep links, API calls) | Real Gmail delivery; real Google/Mozilla/Apple push delivery; Setup C on any specific hosting provider |

If something in Setup A doesn't behave as written, jump to [Troubleshooting](#12-troubleshooting) first.

---

## 1. Before you start

You need:

- [ ] **A server** (Setup A/B): Ubuntu 22.04 or 24.04 with a public IP and SSH access. Any VPS provider works.
- [ ] **A domain name** (e.g. `lostfound.yourcollege.edu`) with an **A record** pointing at the server's IP. HTTPS is not optional — logins, service workers and push notifications all require it.
- [ ] **An email account for sending codes.** Easiest: a dedicated Gmail account with 2-step verification (see [§3](#3-email-verification-codes)).
- [ ] **About an hour**, most of it waiting for DNS and installs.

Ports to open on the server's firewall: **22** (SSH), **80** and **443** (web). Nothing else — in particular **not** 27017 (MongoDB) or 5000 (API).

---

## 2. Environment variables

Settings are environment variables. In Setup A you put them in a **`.env` file in the project root**; in Setup B in **`backend/.env`**. (`backend/.env.example`, the root `.env.example` and `frontend/.env.example` are annotated templates.)

### Backend / Docker

| Variable | Required? | Default | What it does |
| --- | --- | --- | --- |
| `NODE_ENV` | set to `production` | *(unset = development)* | Enables production safeguards: strict config checks, no localhost CORS, errors masked. Docker sets it for you. |
| `MONGO_URI` | **yes** | – | MongoDB connection string. Docker sets it to the bundled MongoDB. |
| `JWT_SECRET` | **yes** | – | Signs login tokens. **32+ random characters in production** (the API won't start otherwise). Changing it signs everyone out. |
| `FRONTEND_URL` | **yes in production** | – | The site's public address, e.g. `https://lostfound.yourcollege.edu`. Used for CORS and links in emails. Several origins: comma-separated. Must match what's in the browser's address bar exactly (scheme + host, no path). |
| `EMAIL_USER` | **yes in production** | – | Gmail address that sends codes and notices. |
| `EMAIL_PASS` | **yes in production** | – | That account's **app password** (not its normal password). |
| `PORT` | no | `5000` | Port the API listens on. |
| `TRUST_PROXY` | **set correctly behind any proxy** | *(unset)* | **How many proxies sit between the internet and the API.** Needed so rate limits count each visitor separately. Docker alone = `1`; Docker + Caddy/another proxy in front = `2`; manual nginx → API = `1`. Wrong value ⇒ everyone shares one rate-limit bucket (or can spoof their IP). |
| `UPLOAD_DIR` | no | `backend/uploads` | Where photos are stored. **Put it on persistent storage and outside the code folder.** Docker already maps `/data/uploads` to a volume. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | no — set **both or neither** | – | Switch on push notifications. See [§8](#8-push-notifications). |
| `VAPID_SUBJECT` | no | `mailto:<EMAIL_USER>` | Contact for push services; must be `mailto:…` or an `https://` URL. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | only to create the first admin | – | Read by `scripts/seedAdmin.js`. Password ≥ 8 characters. |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_COLLEGE_ID`, `SEED_ADMIN_PHONE` | no | `Admin User`, `ADMIN001`, `0000000000` | Details of that admin. |

### Frontend (build time only)

| Variable | Default | What it does |
|---|---|---|
| `VITE_API_URL` | *(empty → same origin `/api`)* | Only for [Setup C](#6-setup-c--website-and-api-on-different-hosts): the API's full URL, e.g. `https://api.yourcollege.edu/api`. It is baked into the build, so rebuild after changing it. |

### Generate the secrets

```bash
# JWT_SECRET (96 hex characters)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# or, with no Node installed:  openssl rand -hex 48

# VAPID keys for push (optional) — prints a public and a private key
cd backend && npm install && npm run vapid
```

Keep the **private** VAPID key and `JWT_SECRET` out of git (`.env` is git-ignored) and out of chat messages.

---

## 3. Email (verification codes)

Sign-up and login codes are emailed, so the API **will not start in production without `EMAIL_USER`/`EMAIL_PASS`**.

**Gmail (what the code supports today):**

1. Create (or pick) a Gmail account just for the app, e.g. `campuslostfound.noreply@gmail.com`.
2. Turn on **2-Step Verification** for it (Google Account → Security).
3. Create an **App password** (Google Account → Security → 2-Step Verification → *App passwords*). Google shows a 16-character password once.
4. Put the address in `EMAIL_USER` and the 16 characters (**no spaces**) in `EMAIL_PASS`.

Good to know:

- Gmail limits how many messages an account may send per day (roughly 500 for a personal account), which is ample for a pilot. If you outgrow it, switch to a transactional-email provider — that needs a small change in `backend/utils/sendOTP.js` (the transporter is currently fixed to Gmail).
- Codes go to people's inboxes, sometimes the **spam folder**; mention that to your first users.
- In **development** you can leave both blank: codes are printed in the API console instead.

---

## 4. Setup A — Docker Compose on one server (recommended)

The repository's `docker-compose.yml` starts three containers: **mongo** (data on a volume), **backend** (the API; photos on a volume) and **frontend** (nginx serving the site and proxying `/api` and `/uploads` to the API).

### 4.1 Prepare the server

```bash
# Ubuntu 22.04/24.04, as a sudo user
sudo apt-get update && sudo apt-get upgrade -y

# Docker (official convenience script) + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER          # log out and back in afterwards

# Firewall: SSH + web only
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw enable
```

Point your domain's **A record** at the server's IP now, so DNS has time to spread.

### 4.2 Get the code and configure it

```bash
sudo mkdir -p /opt/lostfound && sudo chown $USER /opt/lostfound
git clone <your-repository-url> /opt/lostfound
cd /opt/lostfound
cp .env.example .env
nano .env
```

Fill in `.env` (root folder):

```ini
JWT_SECRET=<96 hex characters from §2>
EMAIL_USER=campuslostfound.noreply@gmail.com
EMAIL_PASS=<16-character app password>
FRONTEND_URL=https://lostfound.yourcollege.edu     # your real https address
TRUST_PROXY=2                                       # 2 because Caddy (§4.4) sits in front of the bundled nginx
# Optional push:
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
# First admin:
SEED_ADMIN_EMAIL=you@yourcollege.edu
SEED_ADMIN_PASSWORD=<a strong password>
```

> **`TRUST_PROXY` rule of thumb:** count the proxies a request passes through before reaching the API. Only the bundled nginx → `1`. Caddy (or any HTTPS proxy / load balancer) **plus** the bundled nginx → `2`.

If you'll put Caddy (or another proxy) on the same machine, stop Docker from publishing the site to the whole internet over plain HTTP: edit `docker-compose.yml` and change the frontend's port line to

```yaml
    ports:
      - "127.0.0.1:8080:80"
```

### 4.3 Start it

```bash
docker compose up -d --build        # first build takes a few minutes
docker compose ps                   # all three should be "running" (backend: "healthy")
docker compose logs -f backend      # look for: "MongoDB connected" and "Server running on port 5000 (production)"
```

Create the first admin (uses `SEED_ADMIN_*` from `.env`):

```bash
docker compose exec backend node scripts/seedAdmin.js
```

Quick local check (before HTTPS): `curl http://127.0.0.1:8080/api/health` → `{"status":"ok","db":"connected",…}`.

If the backend keeps restarting, its first log lines say precisely which setting is wrong — see [Troubleshooting](#12-troubleshooting).

### 4.4 HTTPS with Caddy

[Caddy](https://caddyserver.com) gets and renews free HTTPS certificates automatically. Install it on the host (see Caddy's install docs for your OS), then create `/etc/caddy/Caddyfile`:

```caddyfile
lostfound.yourcollege.edu {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

```bash
sudo systemctl reload caddy
```

Open `https://lostfound.yourcollege.edu` — Caddy fetches the certificate on first visit (DNS must already point here and ports 80/443 must be open).

*Prefer nginx + certbot on the host?* Use the same idea: nginx listening on 443 with `proxy_pass http://127.0.0.1:8080;` and the headers `Host`, `X-Forwarded-For $proxy_add_x_forwarded_for`, `X-Forwarded-Proto $scheme`; certbot's `--nginx` plugin sets up the certificate. Keep `TRUST_PROXY=2`.

### 4.5 Everyday commands

```bash
cd /opt/lostfound
docker compose ps                         # status
docker compose logs -f backend            # live API logs      (also: frontend, mongo)
docker compose restart backend            # restart one service
docker compose down                       # stop (data volumes are kept)
docker compose up -d --build              # apply code or .env changes
```

Data lives in two named volumes — `mongo-data` (database) and `uploads` (photos). `docker compose down` keeps them; **`docker compose down -v` deletes them** — never run that on a live site.

Updates and backups: see [§10](#10-running-it).

---

## 5. Setup B — Manual (Node + nginx + PM2)

For when you'd rather not use Docker. You run the API under PM2, serve the built website with nginx, and use MongoDB Atlas (or your own MongoDB, [§7](#7-mongodb)).

```bash
# Node 20 (NodeSource), nginx, certbot, PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm install -g pm2

sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 5.1 API

```bash
sudo mkdir -p /opt/lostfound /var/lib/lostfound/uploads
sudo chown -R $USER /opt/lostfound /var/lib/lostfound
git clone <your-repository-url> /opt/lostfound
cd /opt/lostfound/backend
npm ci --omit=dev
cp .env.example .env && nano .env
```

`backend/.env` for production:

```ini
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/campus_lost_found?retryWrites=true&w=majority
JWT_SECRET=<96 hex characters>
FRONTEND_URL=https://lostfound.yourcollege.edu
EMAIL_USER=...
EMAIL_PASS=...
TRUST_PROXY=1                          # just nginx in front of the API
UPLOAD_DIR=/var/lib/lostfound/uploads  # persistent, outside the code folder
```

Run it with PM2 **from the `backend` folder** (the `.env` is read from there) and make it survive reboots:

```bash
pm2 start server.js --name lostfound-api
pm2 save
pm2 startup            # run the one command it prints, then:  pm2 save
node scripts/seedAdmin.js       # first admin (needs SEED_ADMIN_* in .env)
curl http://127.0.0.1:5000/api/health
```

### 5.2 Website

```bash
cd /opt/lostfound/frontend
npm ci
npm run build                                   # produces frontend/dist
sudo mkdir -p /var/www/lostfound
sudo rsync -a --delete dist/ /var/www/lostfound/
```

### 5.3 nginx

The repository's `frontend/nginx.conf` is already the right site configuration; adapt four things:

```bash
cd /opt/lostfound/frontend
sudo cp security-headers.conf /etc/nginx/security-headers.conf
sudo cp nginx.conf /etc/nginx/conf.d/lostfound.conf
sudo sed -i \
  -e 's#server_name _;#server_name lostfound.yourcollege.edu;#' \
  -e 's#/usr/share/nginx/html#/var/www/lostfound#' \
  -e 's#http://backend:5000#http://127.0.0.1:5000#g' \
  /etc/nginx/conf.d/lostfound.conf
sudo rm -f /etc/nginx/sites-enabled/default      # avoid the stock welcome site shadowing yours
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lostfound.yourcollege.edu   # adds HTTPS + auto-renewal + http→https redirect
```

> **Why `security-headers.conf` is a separate file:** nginx only inherits a server's `add_header` lines into a location that sets **none of its own**. The config therefore `include`s that file in each location that sets a header (cache rules). If you edit the config and add an `add_header` somewhere, include the file there too — otherwise that route silently loses the Content-Security-Policy.

Verify:

```bash
curl -sI https://lostfound.yourcollege.edu/ | grep -iE "content-security-policy|x-frame|cache-control"
curl -s  https://lostfound.yourcollege.edu/api/health
```

### 5.4 Deploying an update

```bash
cd /opt/lostfound && git pull
cd backend  && npm ci --omit=dev && pm2 restart lostfound-api
cd ../frontend && npm ci && npm run build && sudo rsync -a --delete dist/ /var/www/lostfound/
```

---

## 6. Setup C — Website and API on different hosts

Use this only if you specifically want the static site on a static/CDN host and the API elsewhere. **This is the least-tested path** — treat it as a map, not a recipe.

1. **API host**: run the backend as in Setup A/B. Set `FRONTEND_URL=https://lostfound.yourcollege.edu` (the *website's* origin). It needs **persistent disk** for photos (`UPLOAD_DIR` on a mounted volume); hosts with ephemeral disks lose photos on every deploy.
2. **Build the website pointing at the API**:

   ```bash
   cd frontend
   VITE_API_URL=https://api.yourcollege.edu/api npm run build
   ```

   Photo URLs automatically use the API's origin.
3. **Static host** must: serve `frontend/dist`; rewrite unknown paths to `/index.html` (it's a single-page app); serve `/sw.js` and `/manifest.webmanifest` with `Cache-Control: no-cache`.
4. **Add the same security headers** as `frontend/security-headers.conf`, but extend the Content-Security-Policy with the API's origin:
   `connect-src 'self' https://api.yourcollege.edu; img-src 'self' data: blob: https://api.yourcollege.edu`.
   Without that, the browser blocks every API call and the page appears blank (the console shows *Content Security Policy* errors).
5. **Rate limiting:** the API sits behind the host's proxy, so set `TRUST_PROXY` to the number of proxies in front of it (usually `1`).
6. No cookie settings are needed — sessions use a Bearer token, so cross-domain logins just work once CORS (`FRONTEND_URL`) matches.

---

## 7. MongoDB

The API needs MongoDB 6 or 7 (Docker uses 7). Indexes are created automatically on start.

### 7.1 MongoDB Atlas (managed — easiest for Setup B/C)

1. Create a project and a cluster at <https://www.mongodb.com/atlas>. The free shared tier is fine for a pilot.
2. **Database Access** → add a user with a strong password and the *Read and write to any database* role (or restrict it to `campus_lost_found`).
3. **Network Access** → allow your server's public IP. (Avoid `0.0.0.0/0`; if you must use it, rely on a strong password.)
4. **Connect → Drivers** → copy the connection string and put the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/campus_lost_found?retryWrites=true&w=majority`
   If the password has special characters (`@ : / ? # %`), **URL-encode** them.
5. Check your tier for **backups** — free tiers generally don't include scheduled ones, so take your own (see [§10.3](#103-backups)).

### 7.2 Self-hosted

Setup A already includes MongoDB in a container (not exposed to the internet — there is deliberately no `ports:` entry). For Setup B you can run the same container on the server:

```bash
docker run -d --name mongo --restart unless-stopped -p 127.0.0.1:27017:27017 \
  -v mongo-data:/data/db mongo:7
# MONGO_URI=mongodb://127.0.0.1:27017/campus_lost_found
```

It listens on localhost only. If you ever expose MongoDB beyond the machine, enable authentication first.

### 7.3 Two indexes worth knowing about

The app creates unique indexes: *one verified account per college ID* and *one pending claim per person per item*. On a **brand-new** database this is invisible. If you import older data that contains duplicate verified college IDs, MongoDB logs an index-build error at startup until you resolve the duplicates.

---

## 8. Push notifications

Optional; off until configured. When off, the "Turn on notifications" controls hide themselves.

1. Generate keys once: `cd backend && npm install && npm run vapid` (or, with Docker: `docker compose run --rm backend npm run vapid`).
2. Put both in the environment as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`; restart the API.
3. Make sure the site is on **HTTPS** (browsers only allow push on HTTPS or `localhost`).
4. Check: `curl https://lostfound.yourcollege.edu/api/push/config` → `{"enabled":true,"publicKey":"…"}`.
5. Sign in, open **Profile → Push notifications → Turn on notifications → Send a test**.

Notes:

- **Don't change the keys later** unless you must: everyone then has to turn notifications on again.
- Delivery goes through Google/Mozilla/Apple push services; the app only talks to them when sending.
- On **iPhone/iPad** it works only after the site is added to the Home Screen (iOS 16.4+).
- Several people signed in on one browser (different tabs) each receive only their own notifications.
- Notifications carry no message text, only who wrote and about which item.

---

## 9. Go-live checklist

Run through this once everything is up. Each line is something that is easy to get wrong.

- [ ] `https://<your domain>/api/health` shows `"db":"connected"`.
- [ ] The site loads over **HTTPS** with no certificate warning, and `http://` redirects to `https://`.
- [ ] **Register a new account** → the code **arrives by email** (check spam) → you land on the dashboard.
- [ ] Post an item **with a photo**; the photo displays.
- [ ] **Restart the stack** (`docker compose restart` / `pm2 restart …`) → the photo is still there. *(If not, photos aren't on persistent storage — fix `UPLOAD_DIR`/volume now.)*
- [ ] Log in as the admin; open `/admin`; the overview loads.
- [ ] Open the site in a **second tab** → it's signed out (that's correct: sessions are per tab).
- [ ] `curl -sI https://<your domain>/ | grep -i content-security-policy` prints a policy.
- [ ] *(If push is on)* Profile → Turn on notifications → **Send a test** arrives.
- [ ] Rate limiting sees real visitors: from two different networks, hammer a login with wrong passwords — each network gets its own limit. *(If everyone is limited together, `TRUST_PROXY` is wrong.)*
- [ ] A backup has been taken **and a restore has been tried** ([§10.3](#103-backups)).
- [ ] An uptime monitor is checking `/api/health` ([§10.4](#104-monitoring)).

---

## 10. Running it

### 10.1 Updating

**Docker**

```bash
cd /opt/lostfound
# 1. back up first (§10.3)
git pull
docker compose up -d --build
docker compose logs --tail=50 backend      # check it came up cleanly
```

Database indexes and schema changes apply automatically at start-up. **Roll back** by checking out the previous commit (`git checkout <old-commit>`) and running the same `up -d --build`.

**Manual**: see [§5.4](#54-deploying-an-update).

After a deploy, users may need a hard refresh once; `sw.js` and `index.html` are never cached, hashed assets are cached for a year.

### 10.2 Logs

```bash
docker compose logs -f backend            # Docker
pm2 logs lostfound-api                    # Manual
```

You'll see lines such as `MongoDB connected`, `Server running on port 5000 (production)`, the nightly `[CRON] …` jobs (expired posts are closed at 00:00 and abandoned sign-ups removed at 00:30, **server time**), and `Push delivery failed` / `Failed to send OTP email` when something external misbehaves. Docker keeps logs until the container is recreated; for long-running servers set a size cap in `docker-compose.yml` under each service:

```yaml
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }
```

### 10.3 Backups

Two things hold data: **the database** and **the photos**. Back up both.

**Docker (database + photos)**

```bash
mkdir -p /var/backups/lostfound && cd /opt/lostfound
docker compose exec -T mongo mongodump --db campus_lost_found --archive --gzip \
  > /var/backups/lostfound/db-$(date +%F).archive.gz
docker compose exec -T backend tar czf - -C /data uploads \
  > /var/backups/lostfound/uploads-$(date +%F).tgz
```

**Restore** (into a running stack; `--drop` replaces existing collections):

```bash
docker compose exec -T mongo mongorestore --archive --gzip --drop < /var/backups/lostfound/db-2026-01-31.archive.gz
docker compose exec -T backend tar xzf - -C /data < /var/backups/lostfound/uploads-2026-01-31.tgz
```

**Nightly, automatically** — `crontab -e`:

```cron
15 3 * * * cd /opt/lostfound && docker compose exec -T mongo mongodump --db campus_lost_found --archive --gzip > /var/backups/lostfound/db-$(date +\%F).archive.gz && docker compose exec -T backend tar czf - -C /data uploads > /var/backups/lostfound/uploads-$(date +\%F).tgz && find /var/backups/lostfound -mtime +14 -delete
```

(`%` must be escaped as `\%` in crontab; the last command keeps two weeks.)

**Manual/Atlas:** `mongodump --uri="<your MONGO_URI>" --gzip --archive=backup.gz` (from the MongoDB Database Tools), and `tar czf uploads.tgz -C /var/lib/lostfound uploads` for photos.

**Copy backups off the server** (another machine, object storage). A backup on the same disk doesn't survive that disk. And **test a restore** on a spare machine at least once — an untested backup is a hope, not a backup.

### 10.4 Monitoring

- Point a free uptime monitor (UptimeRobot, Better Stack, …) at `https://<your domain>/api/health`. It returns **503** when the database is unreachable and 200 otherwise.
- Docker's own healthcheck marks the backend `unhealthy` in `docker compose ps` if `/api/health` fails.
- Watch disk space (`df -h`) — photos grow over time (each ≤ 5 MB).

### 10.5 Scaling notes

Run **one API instance**. Rate-limit counters and the nightly jobs live inside the process; several replicas would each count separately and run the jobs repeatedly. A single small server comfortably serves a campus; if you ever need more, move the rate-limit store to Redis and run the cron on one node first.

---

## 11. Security checklist

- [ ] HTTPS everywhere; certificates auto-renew (Caddy and certbot do this).
- [ ] `JWT_SECRET` is random, 32+ characters, only in `.env`; `.env` is not in git and not world-readable (`chmod 600 .env`).
- [ ] The admin password is strong and unique; only people who need admin have it.
- [ ] MongoDB is **not** reachable from the internet (no `27017` in the firewall; Atlas allow-list is narrow).
- [ ] Firewall allows only 22/80/443; SSH uses keys (disable password login), ideally not as root.
- [ ] The sending Gmail account has 2-step verification; the app password is only in `.env`.
- [ ] Backups are encrypted or kept somewhere only you can reach (they contain names, emails and phone numbers).
- [ ] `TRUST_PROXY` matches your real proxy count.
- [ ] You keep dependencies current: `npm audit` in `backend/` and `frontend/` now and then, and rebuild.
- [ ] You know who to contact if an account must be suspended (Admin → Students → Suspend).
- [ ] If this is public to your campus, add a **Privacy Policy and Terms** page and a way to report abusive posts — see *Known limitations* in the README.

---

## 12. Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| **API won't start**, logs say *Invalid environment configuration* | Read the `[config]` lines just above it — each names a missing/weak setting (`JWT_SECRET` < 32 chars, no `FRONTEND_URL`, no `EMAIL_*`, only one VAPID key). Fix `.env`, then `docker compose up -d` / `pm2 restart`. |
| `docker compose up` stops at `Set JWT_SECRET in .env` | Compose requires `JWT_SECRET`, `EMAIL_USER`, `EMAIL_PASS` to be set in the root `.env`. |
| Browser console: **CORS error** / API answers **403 "Not allowed by CORS"** | `FRONTEND_URL` doesn't match the site's address exactly (scheme `https://` vs `http://`, `www.` or not). In production `localhost` is not allowed. Multiple origins: comma-separate. |
| **Blank page**; console says *Content Security Policy* | The API is on another origin (Setup C) and the CSP wasn't extended, or something added an inline script. Add the API origin to `connect-src`/`img-src`. |
| Everyone gets **"Too many requests"** at once | `TRUST_PROXY` is wrong/unset, so all visitors share the proxy's IP. Set it to the number of proxies (Docker alone `1`, with Caddy `2`) and restart. |
| **Codes never arrive** | Check backend logs for `Failed to send OTP email` (wrong app password, 2-step verification off, Gmail blocked the login). Look in spam. The site shows *"We could not send the email right now"*. |
| **Photos disappear after a redeploy/restart** | Uploads aren't on persistent storage. Docker: keep the `uploads` volume (never `down -v`). Manual: set `UPLOAD_DIR` outside the code folder. |
| Photo upload fails with **413** | The file is over 5 MB (API limit) or the proxy's body limit is lower than ~6 MB (`client_max_body_size 6m` in the bundled nginx). |
| After a deploy the **old version** still shows | Hard refresh once. If it persists, a proxy/CDN is caching `index.html` or `sw.js` — both must be `Cache-Control: no-cache`. |
| **Push controls are missing** | `GET /api/push/config` shows `enabled:false` (VAPID keys not set), the site isn't HTTPS, or the browser lacks push (iPhone needs Home Screen install). |
| Push turned on but **nothing arrives** | Browser permission is "blocked"; or the subscription expired (the server removes dead ones — turn it off/on); check logs for `Push delivery failed`; try **Send a test**. |
| `/api/health` returns **503** | MongoDB unreachable: container down (`docker compose ps mongo`), Atlas IP allow-list, wrong `MONGO_URI`. |
| Logs mention a **duplicate key** index error at start | Imported data contains duplicate verified college IDs (or duplicate pending claims). Fix the duplicates; the indexes then build. |
| People are **logged out when they close a tab** | By design — each tab has its own session ([README → Security](README.md#security)). |
| Admin can't sign in | The admin was never created: run the seed script ([§4.3](#43-start-it) / [§5.1](#51-api)). It prints "Admin user already exists" if the email is taken. |
| nginx: `host not found in upstream "backend"` (manual setup) | You skipped the `sed` that replaces `http://backend:5000` with `http://127.0.0.1:5000` ([§5.3](#53-nginx)). |

Still stuck? Collect `docker compose logs --tail=200 backend` (or `pm2 logs --lines 200`) — the first error is usually the answer.

---

## 13. Appendix

### How requests flow (Setup A with Caddy)

```
Browser ──HTTPS──▶ Caddy :443 ──HTTP──▶ nginx container :80 ──▶ files  (index.html, assets, sw.js)
                                                       └──/api, /uploads──▶ API container :5000 ──▶ MongoDB
```

Two proxies sit before the API, hence `TRUST_PROXY=2`. The bundled nginx also adds the security headers, enforces the 6 MB upload limit, serves hashed assets with year-long caching and everything else uncached.

### Ports

| Port | Who | Exposed? |
| --- | --- | --- |
| 80 / 443 | Caddy or nginx on the host | public |
| 8080 | bundled website container | bind to `127.0.0.1` when a proxy is in front |
| 5000 | API | internal only |
| 27017 | MongoDB | internal only |

### Files you may want to edit

| File | For |
| --- | --- |
| `.env` (root) / `backend/.env` | all settings |
| `docker-compose.yml` | ports, log limits, MongoDB version |
| `frontend/security-headers.conf` | Content-Security-Policy and other security headers |
| `frontend/nginx.conf` | caching, upload size limit, proxy rules |
| `backend/utils/cronJobs.js` | when expired posts are closed (default: daily 00:00, post lifetime 30 days is in `models/Item.js`) |
| `backend/middleware/rateLimiters.js` | abuse limits (API 600/15 min per IP; codes 5/10 min; logins 10/15 min; per user: 20 posts/h, 15 claims/h, 40 messages/min) |
