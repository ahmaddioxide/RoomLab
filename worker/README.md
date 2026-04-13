# Cloudflare Worker Backend

This Worker keeps Supabase secrets on the server and exposes safe read-only endpoints for the dashboard frontend.

## 1) Install + Login

```bash
npm i -g wrangler
wrangler login
```

## 2) Set Secrets

Run these inside the `worker` directory:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_TABLE
```

Suggested values:
- `SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = your Supabase service-role key
- `SUPABASE_TABLE` = `room_monitor`

## 3) Run Locally

```bash
wrangler dev
```

## 4) Deploy

```bash
wrangler deploy
```

Copy the Worker URL and set it in `index.html` as `API_BASE`.

## Endpoints

- `GET /health`
- `GET /range?range=1h|6h|24h|7d|30d`
- `GET /latest`
- `GET /insights?days=7`
