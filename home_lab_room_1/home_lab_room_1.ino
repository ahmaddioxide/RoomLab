#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecureBearSSL.h>
#include <ArduinoJson.h>
#include "secrets.h"

extern "C" {
  #include "user_interface.h"
}

#define DHTPIN D4
#define DHTTYPE DHT11
#define MQ2_PIN A0
#define BUZZER_PIN D0

#ifndef WIFI_SSID
#error "Missing WIFI_SSID. Copy secrets.example.h to secrets.h and fill your values."
#endif

#ifndef WIFI_PASSWORD
#error "Missing WIFI_PASSWORD. Copy secrets.example.h to secrets.h and fill your values."
#endif

#ifndef SUPABASE_URL
#error "Missing SUPABASE_URL. Copy secrets.example.h to secrets.h and fill your values."
#endif

#ifndef SUPABASE_KEY
#error "Missing SUPABASE_KEY. Copy secrets.example.h to secrets.h and fill your values."
#endif

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* supabaseUrl = SUPABASE_URL;
const char* supabaseKey = SUPABASE_KEY;
DHT dht(DHTPIN, DHTTYPE);
ESP8266WebServer server(80);

bool gasAlert = false;
unsigned long lastSupabase = 0;
unsigned long lastRead = 0;
const unsigned long SUPABASE_INTERVAL = 120000;
const unsigned long SUPABASE_RETRY_INTERVAL = 15000;
bool sendPending = false;
float currentTemp = 0;
float currentHum = 0;
int currentGas = 0;

void playAlarm() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 1000); delay(200);
    tone(BUZZER_PIN, 1500); delay(200);
    tone(BUZZER_PIN, 2000); delay(200);
  }
  noTone(BUZZER_PIN);
}

void playWelcome() {
  tone(BUZZER_PIN, 1000); delay(100);
  tone(BUZZER_PIN, 1500); delay(100);
  noTone(BUZZER_PIN);
}

void playError() {
  tone(BUZZER_PIN, 400); delay(150);
  tone(BUZZER_PIN, 300); delay(150);
  noTone(BUZZER_PIN);
}

void sendToSupabase() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Supabase] Skipped — WiFi not connected");
    sendPending = true;
    return;
  }

  Serial.println("[Supabase] Sending data...");
  BearSSL::WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(10000);
  HTTPClient http;
  http.setTimeout(10000);
  http.begin(client, supabaseUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseKey);
  http.addHeader("Prefer", "return=minimal");

  DynamicJsonDocument doc(256);
  doc["temperature"] = currentTemp;
  doc["humidity"] = currentHum;
  doc["gas_level"] = currentGas;
  doc["gas_alert"] = gasAlert;
  doc["motion"] = false;

  String body;
  serializeJson(doc, body);
  Serial.println("[Supabase] Payload: " + body);
  int code = http.POST(body);
  Serial.println("[Supabase] Response: " + String(code));
  http.end();

  if (code == 201) {
    sendPending = false;
  } else {
    Serial.println("[Supabase] ERROR: expected 201, got " + String(code));
    sendPending = true;
    playError();
  }
}

void handleRoot() {
  int gasLevel = currentGas;
  String gasLabel, gasColor;
  if (gasLevel < 300) { gasLabel = "Good"; gasColor = "#1dde8f"; }
  else if (gasLevel < 500) { gasLabel = "Moderate"; gasColor = "#ffd60a"; }
  else if (gasLevel < 700) { gasLabel = "Poor"; gasColor = "#ff9f1c"; }
  else { gasLabel = "Hazardous"; gasColor = "#ff3b30"; }

  String html = R"rawhtml(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Room Monitor</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080c0f;color:#e0e8f0;font-family:'Syne',sans-serif;min-height:100vh;padding:24px 16px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:480px;margin:0 auto;}
  .header{max-width:480px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-end;}
  .header h1{font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#e0e8f0;}
  .header .dot{width:8px;height:8px;border-radius:50%;background:#1dde8f;animation:pulse 2s infinite;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .card{background:#0d1318;border:1px solid #1a2530;border-radius:16px;padding:20px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
  .card.temp::before{background:linear-gradient(90deg,#ff6b35,#ff9f1c);}
  .card.hum::before{background:linear-gradient(90deg,#00b4d8,#90e0ef);}
  .card.gas::before{background:linear-gradient(90deg,#8338ec,#3a86ff);}
  .card.motion::before{background:linear-gradient(90deg,#1dde8f,#06d6a0);}
  .card-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a6070;margin-bottom:12px;}
  .card-value{font-family:'Space Mono',monospace;font-size:42px;font-weight:700;line-height:1;}
  .card-unit{font-size:16px;font-weight:400;color:#4a6070;margin-left:2px;}
  .card.temp .card-value{color:#ff9f1c;}
  .card.hum .card-value{color:#00b4d8;}
  .card.gas .card-value{color:#8338ec;}
  .card.motion .card-value{font-size:28px;color:#1dde8f;}
  .card.alert-card{border-color:#ff3b30;background:#1a0a0a;grid-column:1/-1;}
  .card.alert-card::before{background:linear-gradient(90deg,#ff3b30,#ff6b35);height:3px;}
  .alert-text{font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#ff3b30;letter-spacing:2px;}
  .alert-sub{font-size:12px;color:#ff6b35;margin-top:6px;letter-spacing:1px;}
  .gas-label{font-size:13px;font-weight:700;margin-top:8px;letter-spacing:1px;}
</style>
</head>
<body>
<div class="header">
  <h1>Room Monitor</h1>
  <div class="dot"></div>
</div>
<div class="grid">
)rawhtml";

  if (gasAlert) {
    html += R"(<div class="card alert-card"><div class="card-label">Warning</div><div class="alert-text">GAS DETECTED</div><div class="alert-sub">Ventilate immediately</div></div>)";
  }

  html += R"(<div class="card temp"><div class="card-label">Temperature</div><div class="card-value">)" + String((int)currentTemp) + R"(<span class="card-unit">°C</span></div></div>)";
  html += R"(<div class="card hum"><div class="card-label">Humidity</div><div class="card-value">)" + String((int)currentHum) + R"(<span class="card-unit">%</span></div></div>)";
  html += R"(<div class="card gas"><div class="card-label">Air Quality</div><div class="card-value">)" + String(currentGas) + R"(<span class="card-unit">raw</span></div><div class="gas-label" style="color:)" + gasColor + R"(;">)" + gasLabel + R"(</div></div>)";
  html += R"(<div class="card motion"><div class="card-label">Motion</div><div class="card-value" style="color:#4a6070;font-size:18px;">Sensor offline</div></div>)";

  html += R"rawhtml(
</div>
</body></html>
)rawhtml";

  server.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  Serial.println("[Setup] Starting...");
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  dht.begin();
  WiFi.begin(ssid, password);
  Serial.println("[WiFi] Connecting...");
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("[WiFi] Connected!");
  Serial.print("[WiFi] IP: ");
  Serial.println(WiFi.localIP());
  wifi_status_led_uninstall();
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);
  server.on("/", handleRoot);
  server.begin();
  Serial.println("[Server] Started!");
  currentTemp = dht.readTemperature();
  currentHum = dht.readHumidity();
  currentGas = analogRead(MQ2_PIN);
  Serial.println("[Sensors] Initial read done");
}

void loop() {
  server.handleClient();
  currentGas = analogRead(MQ2_PIN);

  if (currentGas > 700) {
    if (!gasAlert) {
      gasAlert = true;
      Serial.println("[ALERT] GAS DETECTED! Level: " + String(currentGas));
      playAlarm();
      sendToSupabase();
    }
  } else {
    if (gasAlert) Serial.println("[Alert] Gas cleared");
    gasAlert = false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost, reconnecting...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) delay(500);
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[WiFi] Reconnected! IP: " + WiFi.localIP().toString());
    } else {
      Serial.println("[WiFi] Reconnect failed, will retry next loop");
    }
  }

  if (millis() - lastRead > 2000) {
    lastRead = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) currentTemp = t;
    if (!isnan(h)) currentHum = h;
    Serial.println("[Temp] " + String(currentTemp) + "C [Hum] " + String(currentHum) + "%");
  }

  unsigned long supabaseInterval = sendPending ? SUPABASE_RETRY_INTERVAL : SUPABASE_INTERVAL;
  if (millis() - lastSupabase > supabaseInterval) {
    lastSupabase = millis();
    sendToSupabase();
  }

  delay(100);
}