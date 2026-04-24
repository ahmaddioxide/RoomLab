# AirPulse Home Lab
Multi-room environment monitoring with ESP8266 + ESP32 sensors, Supabase storage, and Cloudflare Worker-secured API.

[![Live Dashboard](https://img.shields.io/badge/Live-Dashboard-0ea5e9?style=for-the-badge)](https://<username>.github.io/<repo>/)
[![Cloudflare Worker](https://img.shields.io/badge/API-Cloudflare%20Worker-f97316?style=for-the-badge)](https://home-lab-api.ahmadmahmood296.workers.dev/health)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

Real-time room environment monitoring system with:
- ESP8266 sensor node — Room 1 (`home_lab.ino`)
- ESP32 sensor node — Room 2 (`home_lab_room_2.ino`)
- Supabase data storage
- Static web dashboard (`index.html`)
- Cloudflare Worker API proxy (`worker/`) to keep secrets off the frontend

Both devices serve a local web dashboard on port 80 for direct LAN access. The public dashboard is designed for static hosting (for example, GitHub Pages), while sensitive credentials stay in Cloudflare Worker secrets and gitignored secrets files.

## Why this project

This project turns low-cost sensors into a full monitoring stack:
- edge device collection (ESP8266 + ESP32, two rooms)
- cloud-backed historical storage (Supabase)
- secure public dashboard (GitHub Pages + Worker API proxy)
- local LAN dashboards served directly from each device

It is built to be understandable, deployable, and safe to share publicly.

## Quick Start

1. Configure firmware secrets and flash both devices.
2. Deploy the Worker backend and set Worker secrets.
3. Set `API_BASE` in `index.html`.
4. Deploy frontend to GitHub Pages.
5. Open the live URL and confirm cards/charts update.

## Project Structure

```text
home_lab/
├── index.html                # Static dashboard UI (charts, analytics, trends)
├── home_lab.ino              # ESP8266 firmware (Room 1: DHT11, MQ2, buzzer)
├── home_lab_room_2.ino       # ESP32 firmware (Room 2: DHT22, BMP280, MQ135, LDR, PIR, LCD, buzzer)
├── secrets.example.h         # Template for ESP8266 secrets
├── secrets_room2.example.h   # Template for ESP32 secrets
├── worker/
│   ├── src/index.js          # Cloudflare Worker backend API
│   ├── wrangler.toml         # Worker config
│   └── README.md             # Worker-specific quick guide
└── README.md                 # This file
```

## Architecture

### Room 1 — ESP8266 (NodeMCU)
1. ESP8266 reads sensors:
   - Temperature/Humidity: DHT11
   - Gas level: MQ2 (analog)
   - ~~Motion: PIR~~ (disabled — sensor damaged)
2. ESP8266 sends readings to Supabase table (`room_monitor`).
3. Serves a local web dashboard on port 80.

### Room 2 — ESP32 (WROOM-32)
1. ESP32 reads sensors:
   - Temperature/Humidity: DHT22
   - Pressure: BMP280 (I2C)
   - Air quality: MQ135 (analog)
   - Light: LDR (analog)
   - Motion: PIR
2. ESP32 sends readings to Supabase tables (`esp32_monitor`, `presence_events`).
3. Phone presence detection via TCP probing on the local network.
4. 16x2 LCD with rotating sensor slides.
5. Serves a local web dashboard on port 80.

### Cloud
1. Cloudflare Worker reads from Supabase using secret server-side credentials.
2. `index.html` calls Worker API endpoints (`/latest`, `/range`, `/insights`).
3. Dashboard renders charts, live cards, trends, occupancy analysis, and stats.

## Features

- Live sensor cards: temperature, humidity, air quality score, motion state
- Historical windows: `1h`, `6h`, `24h`, `7d`, `30d`
- Climate trends and comfort metrics (heat index, dew point, comfort score)
- Gas trend visualization and air quality categorization
- Motion analytics:
  - motion timeline
  - occupancy heatmap
  - peak activity hours
  - weekday/weekend comparison
- Backend-proxied data access (no Supabase secrets in frontend)

## Prerequisites

- GitHub account (for GitHub Pages deployment)
- Cloudflare account (for Worker deployment)
- Supabase project with `room_monitor` and `esp32_monitor` tables
- Node.js + npm (for Wrangler CLI)
- Arduino IDE (for firmware flashing)

## Supabase Tables

Expected columns in `room_monitor` (Room 1):

- `id` (primary key)
- `temperature` (numeric)
- `humidity` (numeric)
- `gas_level` (numeric)
- `gas_alert` (boolean)
- `motion` (boolean)
- `created_at` (timestamp with timezone, default now())

Expected columns in `esp32_monitor` (Room 2):

- `id` (primary key)
- `temperature` (numeric)
- `humidity` (numeric)
- `pressure` (numeric)
- `air_quality` (numeric)
- `air_label` (text)
- `light_value` (numeric)
- `light_label` (text)
- `motion` (boolean)
- `is_home` (boolean)
- `gas_alert` (boolean)
- `heat_alert` (boolean)
- `created_at` (timestamp with timezone, default now())

Expected columns in `presence_events` (Room 2):

- `id` (primary key)
- `event_type` (text)
- `person` (text)
- `created_at` (timestamp with timezone, default now())

## Backend Setup (Cloudflare Worker)

From project root:

```bash
cd worker
npm i -g wrangler
wrangler login
```

### Configure Worker secrets

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_TABLE
```

Use:
- `SUPABASE_URL`: `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `SUPABASE_TABLE`: `room_monitor`

### Deploy Worker

```bash
wrangler deploy
```

Example deployed URL:
`https://home-lab-api.ahmadmahmood296.workers.dev`

## API Endpoints

Base URL: your Worker URL

- `GET /health`  
  Returns service status.

- `GET /latest`  
  Returns newest reading.

- `GET /range?range=1h|6h|24h|7d|30d`  
  Returns readings in time window.

- `GET /insights?days=7`  
  Returns compact fields for occupancy/insight charts.

## Frontend Setup

`index.html` is configured with:

```js
const API_BASE = 'https://home-lab-api.ahmadmahmood296.workers.dev';
```

If your Worker URL changes, update this value.

## Deploy Frontend (GitHub Pages)

1. Push repository to GitHub.
2. Open repository `Settings -> Pages`.
3. Under `Build and deployment`:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. Save and wait for deployment.
5. Access site at:
   - `https://<username>.github.io/<repo>/`

## Local Testing

### Test deployed Worker

```bash
curl -sS "https://home-lab-api.ahmadmahmood296.workers.dev/health"
curl -sS "https://home-lab-api.ahmadmahmood296.workers.dev/latest"
curl -sS "https://home-lab-api.ahmadmahmood296.workers.dev/range?range=6h"
```

### Run Worker locally

```bash
cd worker
wrangler dev
```

Note: local dev may require local secret config if account-level secrets are not loaded automatically.

## Firmware Notes

### Room 1 (`home_lab.ino`) — ESP8266

- Sensor read loop continuously tracks temperature/humidity/gas.
- PIR motion sensor is disabled (hardware damaged); always reports `false`.
- Periodic intervals trigger Supabase upload.
- Buzzer provides audible alerts and status tones.
- Built-in web server serves a lightweight local status UI.

#### Secret Setup

1. Copy the template:

```bash
cp secrets.example.h secrets.h
```

2. Edit `secrets.h` and set:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `SUPABASE_URL` (full REST table endpoint)
   - `SUPABASE_KEY`

3. Compile/upload `home_lab.ino`.

### Room 2 (`home_lab_room_2.ino`) — ESP32

- Reads DHT22, BMP280, MQ135, LDR, and PIR sensors every 2 seconds.
- Logs data to Supabase (`esp32_monitor`) every 10 seconds.
- Detects phone presence via TCP probing every 5 minutes.
- Logs arrival/departure events to `presence_events` table.
- 16x2 LCD with 4 rotating slides; auto-off after 1 minute of no motion.
- Built-in web server serves a local dashboard with all sensor cards.

#### Secret Setup

1. Copy the template:

```bash
cp secrets_room2.example.h secrets_room2.h
```

2. Edit `secrets_room2.h` and set:
   - `WIFI_SSID`
   - `WIFI_PASSWORD`
   - `SUPABASE_URL` (base URL, no `/rest/v1/` suffix)
   - `SUPABASE_KEY`
   - `PHONE_IP` (local IP of phone for presence detection)

3. Compile/upload `home_lab_room_2.ino`.

Both firmwares import their secrets file and fail fast at compile time if required keys are missing.

## Security Notes

- Do not put service keys in `index.html` or other frontend files.
- Keep Supabase service role key only in Worker secrets.
- Rotate keys immediately if exposed.
- Restrict CORS in Worker to your GitHub Pages domain for production hardening.

## Important Cleanup Recommended

Before sharing or making repository public:

- Keep real credentials only in `secrets.h` and `secrets_room2.h` (both ignored by git).
- Commit only `secrets.example.h` and `secrets_room2.example.h` with placeholder values.

## Troubleshooting

- **Dashboard shows "Bad API_BASE"**  
  Ensure `API_BASE` points to a valid `https://*.workers.dev` URL.

- **Worker returns missing env vars**  
  Re-run `wrangler secret put ...` commands.

- **No data on dashboard**  
  Confirm devices are sending to Supabase and rows exist in the relevant tables.

- **CORS errors in browser**  
  Verify Worker response includes CORS headers and origin rules allow your domain.

- **GitHub Pages loads but charts are empty**  
  Open DevTools network tab and verify API requests to Worker succeed (200 + JSON body).

## Next Improvements

- Integrate Room 2 data into Worker API and web dashboard
- Add authentication for dashboard/API access
- Add alerting (email/telegram) on gas threshold or motion events
- Add data retention policies and rollups in Supabase
- Add CI checks for Worker and frontend changes

## Contributing

Contributions are welcome. Please read `CONTRIBUTING.md` before opening a PR.

## Security

If you find a vulnerability, do not open a public issue first. See `SECURITY.md`.

## License

This project is licensed under the MIT License. See `LICENSE`.

