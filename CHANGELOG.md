# Changelog

All notable changes to AirPulse Home Lab are documented here.

## [2.0.0] — 2026-04-24

### Added
- **React + Vite dashboard** replacing the monolithic `index.html`
  - Component architecture: 8 shared components, 3 view modules
  - Hash-based routing between Room 1, Room 2, and Combined views
  - `useRoomData` and `useCombinedData` hooks for data fetching and polling
  - Chart.js integration via react-chartjs-2 (Line, Bar, time-series)
- **Combined view** — side-by-side room comparison with temperature, humidity, and air quality deltas
- **Device status indicator** — shows online / stale / offline per device with last update timestamp
- **Comfort section** — canvas gauge with heat index, dew point, and comfort score
- **Occupancy heatmap** — 7-day × 24-hour grid with configurable accent color
- **Comparison chart** — today vs yesterday overlay with mode tabs (Room 1)
- **Presence log** — arrival / departure event list (Room 2)
- **Summary cards** — weekly and monthly temperature and occupancy aggregates
- **GitHub Actions workflow** (`.github/workflows/deploy.yml`) — auto-deploy dashboard to GitHub Pages on push to `main`
- **Sensor disconnect handling** — BMP280 pressure value of `0` treated as sensor unavailable; filtered from charts, stats, and live card

### Changed
- **Worker API** — multi-table support with `ALLOWED_TABLES` whitelist; new endpoints: `/presence`, `/combined`, table-aware `/latest`, `/range`, `/insights`
- **Project structure** — firmware moved to `home_lab_room_1/` and `home_lab_room_2/` subdirectories
- **README** — fully rewritten with architecture diagram, table schemas, updated setup instructions

### Removed
- Old monolithic `index.html` (1235 lines) — replaced by `dashboard/` React app
- `index.html.bak` backup file
- `PROJECT_CONTEXT.md`

### Fixed
- Room 1 PIR motion sensor disabled in firmware (hardware damaged) — always reports `false`
- Room 2 secrets extracted to separate `secrets_room2.h`

---

## [1.0.0] — 2026-04-01

### Added
- ESP8266 firmware for Room 1 — DHT11, MQ2 gas sensor, buzzer alerts
- ESP32 firmware for Room 2 — DHT22, BMP280, MQ135, LDR, PIR, 16×2 LCD
- Phone presence detection via TCP probing (ESP32)
- Supabase integration for data storage (`room_monitor`, `esp32_monitor`, `presence_events`)
- Cloudflare Worker API proxy with server-side Supabase credentials
- Single-page vanilla JS dashboard (`index.html`) with Chart.js
- Local LAN dashboards served from each device
- Secret templates (`secrets.example.h`, `secrets_room2.example.h`)
- MIT license, CONTRIBUTING.md, SECURITY.md
