# AirPulse — Home Lab

Multi-room IoT environment monitoring with ESP8266 + ESP32 sensors, a React dashboard, Supabase storage, and a Cloudflare Worker API proxy.

[![Live Dashboard](https://img.shields.io/badge/Live-Dashboard-0ea5e9?style=for-the-badge)](https://ahmaddioxide.github.io/RoomLab/)
[![Cloudflare Worker](https://img.shields.io/badge/API-Cloudflare%20Worker-f97316?style=for-the-badge)](https://home-lab-api.ahmadmahmood296.workers.dev/health)
[![License: MIT](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](./LICENSE)

## What it does

Two sensor nodes collect environment data from separate rooms and push it to Supabase. A Cloudflare Worker proxies reads so no credentials reach the browser. A React + Vite dashboard visualises everything in real time.

| | Room 1 — ESP8266 | Room 2 — ESP32 |
|---|---|---|
| **Sensors** | DHT11, MQ2, Buzzer | DHT22, BMP280, MQ135, LDR, PIR, 16×2 LCD |
| **Metrics** | Temperature, humidity, gas level | Temperature, humidity, pressure, air quality, light, motion, presence |
| **Supabase table** | `room_monitor` | `esp32_monitor` + `presence_events` |
| **Upload interval** | 2 min | 10 s |
| **LAN dashboard** | `http://<device-ip>/` | `http://<device-ip>/` |

## Dashboard features

- Live sensor cards with trend arrows and air quality scoring
- Comfort metrics — heat index, dew point, comfort score with gauge
- Device availability — online / stale / offline status per device
- Time range selector — 1 h, 6 h, 24 h, 7 d, 30 d
- Charts — climate, gas, pressure, light, motion timeline
- Comparison mode — today vs yesterday with mode tabs
- Occupancy heatmap — 7-day × 24-hour grid
- Combined view — side-by-side room comparison with deltas
- Presence log — arrival / departure events (Room 2)
- Summary cards — weekly & monthly aggregates
- Min / avg / max stats grid
- Fully responsive — works on mobile

## Project structure

```
home_lab/
├── dashboard/                  # React + Vite web dashboard
│   ├── src/
│   │   ├── main.jsx            # Entry — Chart.js registration
│   │   ├── App.jsx             # Hash routing between views
│   │   ├── App.css             # All styles
│   │   ├── config.js           # API base, ranges, thresholds
│   │   ├── api.js              # Fetch wrapper
│   │   ├── utils.js            # AQI, comfort, trends, bucketing
│   │   ├── hooks/              # useInterval, useRoomData
│   │   ├── components/         # TopBar, LiveCard, ChartCard, Heatmap, …
│   │   └── views/              # Room1View, Room2View, CombinedView
│   ├── index.html
│   ├── package.json
│   └── vite.config.js          # base: '/RoomLab/'
├── home_lab_room_1/
│   └── home_lab_room_1.ino     # ESP8266 firmware
├── home_lab_room_2/
│   └── home_lab_room_2.ino     # ESP32 firmware
├── worker/
│   ├── src/index.js            # Cloudflare Worker API
│   ├── wrangler.toml
│   └── README.md
├── secrets.example.h           # ESP8266 secrets template
├── secrets_room2.example.h     # ESP32 secrets template
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions → Pages deploy
└── README.md
```

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  ESP8266     │     │  ESP32       │
│  Room 1      │     │  Room 2      │
└──────┬───────┘     └──────┬───────┘
       │  HTTPS POST        │  HTTPS POST
       ▼                    ▼
   ┌──────────────────────────┐
   │        Supabase          │
   │  room_monitor            │
   │  esp32_monitor           │
   │  presence_events         │
   └────────────┬─────────────┘
                │  REST API (service key)
                ▼
   ┌──────────────────────────┐
   │   Cloudflare Worker      │
   │   /latest /range /insights│
   │   /presence /combined    │
   └────────────┬─────────────┘
                │  CORS-allowed fetch
                ▼
   ┌──────────────────────────┐
   │   React Dashboard        │
   │   GitHub Pages           │
   │   ahmaddioxide.github.io │
   └──────────────────────────┘
```

## Quick start

### 1. Flash firmware

```bash
# Room 1
cp secrets.example.h secrets.h        # edit with your creds
# Open home_lab_room_1/home_lab_room_1.ino in Arduino IDE → Upload

# Room 2
cp secrets_room2.example.h secrets_room2.h   # edit with your creds
# Open home_lab_room_2/home_lab_room_2.ino → Upload
```

### 2. Deploy Worker

```bash
cd worker
npm install
wrangler login
wrangler secret put SUPABASE_URL           # https://<ref>.supabase.co
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_TABLE         # room_monitor
wrangler deploy
```

### 3. Deploy dashboard

The dashboard deploys automatically via GitHub Actions when you push to `main`.

**First-time setup:**
1. Go to **Settings → Pages** on your GitHub repo
2. Set Source to **GitHub Actions**
3. Push to `main` — the workflow builds `dashboard/` and deploys to Pages

**Local development:**
```bash
cd dashboard
npm install
npm run dev          # http://localhost:5173/RoomLab/
```

## API endpoints

Base: `https://home-lab-api.ahmadmahmood296.workers.dev`

| Endpoint | Params | Description |
|---|---|---|
| `GET /health` | — | Service status |
| `GET /latest` | `table` | Most recent reading |
| `GET /range` | `table`, `range` (1h/6h/24h/7d/30d) | Historical readings |
| `GET /insights` | `table`, `days` | Compact fields for analytics |
| `GET /presence` | `days` | Presence events (Room 2) |
| `GET /combined` | — | Latest from both rooms |

`table` defaults to `room_monitor`. Allowed values: `room_monitor`, `esp32_monitor`, `presence_events`.

## Supabase tables

<details>
<summary><code>room_monitor</code> — Room 1</summary>

| Column | Type |
|---|---|
| `id` | int8, PK |
| `temperature` | numeric |
| `humidity` | numeric |
| `gas_level` | numeric |
| `gas_alert` | boolean |
| `motion` | boolean |
| `created_at` | timestamptz |

</details>

<details>
<summary><code>esp32_monitor</code> — Room 2</summary>

| Column | Type |
|---|---|
| `id` | int8, PK |
| `temperature` | numeric |
| `humidity` | numeric |
| `pressure` | numeric |
| `air_quality` | numeric |
| `air_label` | text |
| `light_value` | numeric |
| `light_label` | text |
| `motion` | boolean |
| `is_home` | boolean |
| `gas_alert` | boolean |
| `heat_alert` | boolean |
| `created_at` | timestamptz |

</details>

<details>
<summary><code>presence_events</code> — Room 2</summary>

| Column | Type |
|---|---|
| `id` | int8, PK |
| `event_type` | text |
| `person` | text |
| `created_at` | timestamptz |

</details>

## Firmware notes

### Room 1 — ESP8266 (`home_lab_room_1.ino`)
- Reads DHT11 + MQ2 continuously
- PIR motion sensor disabled (hardware damaged) — always reports `false`
- Uploads to `room_monitor` every 2 minutes
- Buzzer alerts on gas threshold
- Serves local dashboard on port 80

### Room 2 — ESP32 (`home_lab_room_2.ino`)
- Reads DHT22, BMP280, MQ135, LDR, PIR every 2 s
- Uploads to `esp32_monitor` every 10 s
- Detects phone presence via TCP probing every 5 min
- Logs arrival/departure to `presence_events`
- 16×2 LCD with rotating sensor slides; auto-off after 1 min idle
- Handles BMP280 disconnect gracefully (pressure = 0 → treated as unavailable)
- Serves local dashboard on port 80

## Security

- Supabase service key lives only in Cloudflare Worker secrets
- Firmware secrets are in gitignored `secrets.h` / `secrets_room2.h`
- Only example templates are committed
- Restrict Worker CORS origin to your Pages domain for production

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard shows no data | Verify devices are sending to Supabase and rows exist |
| CORS errors in browser | Check Worker CORS headers and allowed origin |
| Charts empty | Open DevTools → Network, confirm Worker returns 200 + JSON |
| Worker returns env error | Re-run `wrangler secret put` commands |
| GitHub Pages shows old site | Settings → Pages → Source must be **GitHub Actions** |
| Pressure shows 0 / — | BMP280 sensor disconnected; dashboard handles this gracefully |

## Future ideas

- Email / Telegram alerts on gas threshold or motion events
- Authentication for dashboard and API
- Data retention policies and rollups in Supabase
- CI checks for Worker and dashboard
- Multi-floor support

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
