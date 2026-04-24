# AirPulse Home Lab — Project Context

## Overview

A multi-room home environment monitoring system using microcontrollers, Supabase cloud storage, a Cloudflare Worker API proxy, and a static web dashboard. The system collects temperature, humidity, air quality, motion, and other environmental data from two separate rooms and visualizes it in real time.

---

## Devices

### Device 1 — NodeMCU ESP8266 (Room 1)

- **File:** `home_lab.ino`
- **Board:** ESP8266 (NodeMCU)
- **Supabase table:** `room_monitor`

#### Sensors & Pins

| Sensor       | Type           | Pin   | Purpose                  |
|-------------|----------------|-------|--------------------------|
| DHT11       | Temp/Humidity  | D4    | Temperature & humidity   |
| MQ2         | Gas (analog)   | A0    | Air quality / gas alert  |
| Buzzer      | Passive        | D0    | Audio alerts & feedback  |

> **Note:** PIR motion sensor (D6) has been removed — the hardware sensor is damaged and was sending constant false positives. Motion is always reported as `false` to Supabase. The local web UI shows "Sensor offline" for motion.

#### Behavior

- Reads sensors continuously; DHT11 every 2 seconds, gas (analog) every loop
- Sends data to Supabase every **2 minutes** (`SUPABASE_INTERVAL = 120000`)
- On failed send, retries every **15 seconds**
- Gas level > 700 triggers alarm buzzer + immediate data send
- Built-in ESP8266WebServer on port 80 serves a local status dashboard (dark themed card UI with auto-refresh every 5s)
- WiFi auto-reconnect with 10s timeout on disconnect
- Secrets stored in `secrets.h` (gitignored), template in `secrets.example.h`
- Compile-time checks for missing secrets via `#error` directives

#### Supabase Payload (room_monitor)

```json
{
  "temperature": 25.0,
  "humidity": 60.0,
  "gas_level": 310,
  "gas_alert": false,
  "motion": false
}
```

---

### Device 2 — ESP32 WROOM-32 (Room 2)

- **File:** `home_lab_room_2.ino`
- **Board:** ESP32 WROOM-32 (CP2102 USB)
- **Supabase tables:** `esp32_monitor`, `presence_events`

#### Sensors & Pins

| Sensor       | Type           | Pin(s)        | Purpose                     |
|-------------|----------------|---------------|-----------------------------|
| DHT22       | Temp/Humidity  | GPIO4         | Temperature & humidity       |
| BMP280      | Pressure       | I2C (SDA=21, SCL=22), addr 0x76 | Atmospheric pressure |
| MQ135       | Gas (analog)   | GPIO34        | Air quality                  |
| LDR         | Light (analog) | GPIO35        | Ambient light level          |
| HC-SR501    | PIR motion     | GPIO27        | Motion detection             |
| Buzzer      | Passive        | GPIO26        | Audio alerts & feedback      |
| 16x2 LCD    | I2C            | addr 0x27, SDA=21, SCL=22 | Status display    |

#### Behavior

- Reads all sensors every **2 seconds**
- Sends data to Supabase every **10 seconds** (`SUPABASE_INTERVAL = 10000`)
- Phone presence detection via TCP connection to `192.168.18.20` (ports 62078, 443, 80) every **5 minutes**
- Logs presence events (arrived/left) to `presence_events` table
- LCD auto-off after **1 minute** of no motion, auto-on when motion detected
- 4 rotating LCD slides every 4 seconds:
  1. Temperature, humidity, pressure
  2. Air quality label, light label
  3. Motion status, presence status
  4. WiFi RSSI, IP address
- Gas alert: raw > 700 → alarm buzzer + LCD alert + immediate data send
- Heat alert: temp > 35°C → LCD warning
- Welcome/goodbye buzzer tones on presence change
- Startup: sequential sensor self-test displayed on LCD
- Built-in WebServer on port 80 serves a local status dashboard (dark themed card UI with 7 sensor cards + alert banners, auto-refresh every 5s)
- Secrets stored in `secrets_room2.h` (gitignored), template in `secrets_room2.example.h`
- Compile-time checks for missing secrets via `#error` directives

#### Supabase Payload (esp32_monitor)

```json
{
  "temperature": 26.5,
  "humidity": 55.0,
  "pressure": 1013.25,
  "air_quality": 280,
  "air_label": "Good",
  "light_value": 2100,
  "light_label": "Medium",
  "motion": false,
  "is_home": true,
  "gas_alert": false,
  "heat_alert": false
}
```

#### Supabase Payload (presence_events)

```json
{
  "event_type": "arrived",
  "person": "Ahmad"
}
```

---

## Supabase

- **Project ref:** `qzhgdrwcxryfeiwojctw`
- **URL:** `https://qzhgdrwcxryfeiwojctw.supabase.co`

### Tables

| Table              | Source Device   | Purpose                              |
|-------------------|-----------------|--------------------------------------|
| `room_monitor`    | ESP8266 (Room 1)| Sensor readings (temp, humidity, gas, motion) |
| `esp32_monitor`   | ESP32 (Room 2)  | Sensor readings (temp, humidity, pressure, air, light, motion, presence) |
| `presence_events` | ESP32 (Room 2)  | Arrival/departure events             |

### Table Schemas

#### room_monitor

| Column       | Type                     |
|-------------|--------------------------|
| id          | primary key              |
| temperature | numeric                  |
| humidity    | numeric                  |
| gas_level   | numeric                  |
| gas_alert   | boolean                  |
| motion      | boolean                  |
| created_at  | timestamptz (default now()) |

#### esp32_monitor

| Column       | Type                     |
|-------------|--------------------------|
| temperature | numeric                  |
| humidity    | numeric                  |
| pressure    | numeric                  |
| air_quality | numeric                  |
| air_label   | text                     |
| light_value | numeric                  |
| light_label | text                     |
| motion      | boolean                  |
| is_home     | boolean                  |
| gas_alert   | boolean                  |
| heat_alert  | boolean                  |
| created_at  | timestamptz (default now()) |

#### presence_events

| Column      | Type                     |
|------------|--------------------------|
| event_type | text (arrived / left)    |
| person     | text                     |
| created_at | timestamptz (default now()) |

---

## Cloudflare Worker API (`worker/`)

- **Name:** `home-lab-api`
- **File:** `worker/src/index.js`
- **Config:** `worker/wrangler.toml`
- **Deployed URL:** `https://home-lab-api.ahmadmahmood296.workers.dev`
- **Purpose:** Secure read-only API proxy — keeps Supabase service role key server-side, exposes safe endpoints to the frontend

### Environment Variables (Secrets)

| Variable                   | Value                                         |
|---------------------------|-----------------------------------------------|
| `SUPABASE_URL`            | `https://qzhgdrwcxryfeiwojctw.supabase.co`    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key                    |
| `SUPABASE_TABLE`          | `room_monitor`                                |

### Endpoints

| Method | Path                          | Description                                |
|--------|-------------------------------|--------------------------------------------|
| GET    | `/health`                     | Service health check (`{ ok: true }`)      |
| GET    | `/latest`                     | Latest single reading from table           |
| GET    | `/range?range=1h\|6h\|24h\|7d\|30d` | Readings within time window, ascending |
| GET    | `/insights?days=1..30`        | Compact fields for analytics (motion, temp, humidity) |
| OPTIONS | `*`                          | CORS preflight                             |

### Architecture Notes

- Uses `SUPABASE_SERVICE_ROLE_KEY` for authenticated Supabase REST queries
- Returns JSON with CORS headers (currently `Access-Control-Allow-Origin: *`)
- Input validation: range values whitelist, days clamped 1–30
- Currently only queries the single table set in `SUPABASE_TABLE` env var
- **Limitation:** Worker currently only serves Room 1 (`room_monitor`) data. Room 2 (`esp32_monitor`, `presence_events`) is not yet exposed via the Worker.

---

## Web Dashboard (`index.html`)

- **Type:** Static single-page HTML file
- **Hosting:** GitHub Pages
- **API Base:** `https://home-lab-api.ahmadmahmood296.workers.dev`
- **Libraries:** Chart.js 4.4.0, chartjs-adapter-date-fns
- **Fonts:** Inter, JetBrains Mono

### Features

- Live sensor cards: temperature, humidity, air quality score, motion state
- Time range selector: 1h, 6h, 24h, 7d, 30d
- Historical charts for temperature, humidity, gas levels
- Climate trends and comfort metrics (heat index, dew point, comfort score gauge)
- Gas trend visualization with air quality categorization
- Motion analytics: timeline, occupancy heatmap, peak activity hours, weekday/weekend comparison
- Trend indicators (up/down/stable)
- Responsive design with dark theme
- Auto-polling for live updates

### Limitation

- Currently only displays Room 1 data (whatever table the Worker is configured with)
- No Room 2 data display yet

---

## Project File Structure

```
home_lab/
├── home_lab.ino             # ESP8266 firmware (Room 1: DHT11, MQ2, buzzer — PIR disabled)
├── home_lab_room_2.ino      # ESP32 firmware (Room 2: DHT22, BMP280, MQ135, LDR, PIR, LCD, buzzer)
├── secrets.example.h        # Template for ESP8266 secrets (WiFi, Supabase)
├── secrets.h                # [gitignored] Actual ESP8266 secrets
├── secrets_room2.example.h  # Template for ESP32 secrets (WiFi, Supabase, phone IP)
├── secrets_room2.h          # [gitignored] Actual ESP32 secrets
├── index.html               # Static web dashboard (Chart.js, fetches from Worker API)
├── worker/
│   ├── src/index.js          # Cloudflare Worker — API proxy for Supabase
│   ├── wrangler.toml         # Worker deployment config
│   └── README.md             # Worker setup guide
├── README.md                 # Project overview and setup instructions
├── CONTRIBUTING.md           # Contribution guidelines
├── SECURITY.md               # Security policy
├── LICENSE                   # MIT License
└── PROJECT_CONTEXT.md        # This file
```

---

## Libraries & Dependencies

### ESP8266 (Room 1)

| Library              | Purpose              |
|---------------------|----------------------|
| DHT                 | DHT11 sensor driver  |
| ESP8266WiFi         | WiFi connectivity    |
| ESP8266WebServer    | Local HTTP server    |
| ESP8266HTTPClient   | Supabase HTTP POST   |
| WiFiClientSecureBearSSL | HTTPS support    |
| ArduinoJson         | JSON serialization   |

### ESP32 (Room 2)

| Library              | Purpose              |
|---------------------|----------------------|
| DHT                 | DHT22 sensor driver  |
| Adafruit_BMP280     | Pressure sensor      |
| LiquidCrystal_I2C   | LCD display          |
| WiFi (ESP32)        | WiFi connectivity    |
| WebServer           | Local HTTP server    |
| HTTPClient          | Supabase HTTP POST   |
| WiFiClientSecure    | HTTPS support        |
| ArduinoJson         | JSON serialization   |

### Worker

| Tool       | Purpose                |
|-----------|------------------------|
| Wrangler  | Cloudflare Worker CLI  |

### Dashboard

| Library                    | Purpose            |
|---------------------------|---------------------|
| Chart.js 4.4.0            | Charts & graphs     |
| chartjs-adapter-date-fns  | Time axis adapter   |

---

## Network & Connectivity

- **WiFi SSID:** `StackPebbles`
- **ESP8266:** connects via `secrets.h` credentials, auto-reconnects on disconnect
- **ESP32:** connects via `secrets_room2.h` credentials, phone IP also from secrets
- **Phone presence target:** configured via `PHONE_IP` in `secrets_room2.h` (Ahmad's phone on local network)
- **Supabase:** HTTPS REST API via service/anon keys
- **Worker:** Cloudflare edge network, proxies to Supabase

---

## Known Issues & TODO

1. **Room 2 not in Worker/Dashboard** — `esp32_monitor` and `presence_events` tables have no Worker endpoints or dashboard UI yet
2. **Room 1 PIR disabled** — Motion sensor hardware is damaged; always reports `false`
3. **CORS wide open** — Worker allows `Origin: *`; should restrict to GitHub Pages domain in production
4. **No authentication** — Dashboard and API are publicly accessible
5. **No data retention** — No cleanup/rollup policy for old sensor data
6. **Presence detection** — TCP-based phone detection can be unreliable (phone may sleep)
