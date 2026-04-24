#include <Wire.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "secrets_room2.h"

#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ135_PIN 34
#define LIGHT_PIN 35
#define PIR_PIN 27
#define BUZZER_PIN 26

#ifndef WIFI_SSID
#error "Missing WIFI_SSID. Copy secrets_room2.example.h to secrets_room2.h and fill your values."
#endif

#ifndef WIFI_PASSWORD
#error "Missing WIFI_PASSWORD. Copy secrets_room2.example.h to secrets_room2.h and fill your values."
#endif

#ifndef SUPABASE_URL
#error "Missing SUPABASE_URL. Copy secrets_room2.example.h to secrets_room2.h and fill your values."
#endif

#ifndef SUPABASE_KEY
#error "Missing SUPABASE_KEY. Copy secrets_room2.example.h to secrets_room2.h and fill your values."
#endif

#ifndef PHONE_IP
#error "Missing PHONE_IP. Copy secrets_room2.example.h to secrets_room2.h and fill your values."
#endif

const char* ssid = WIFI_SSID;
const char* password = WIFI_PASSWORD;
const char* supabaseUrl = SUPABASE_URL;
const char* supabaseKey = SUPABASE_KEY;
const char* phoneIP = PHONE_IP;

DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP280 bmp;
LiquidCrystal_I2C lcd(0x27, 16, 2);
WebServer webServer(80);

bool bmpFound = false;
bool dhtFound = false;
bool isHome = false;
bool lastHomeState = false;
bool lcdOn = true;
bool lastMotionState = false;

float currentTemp = 0;
float currentHum = 0;
float currentPressure = 0;
int currentAir = 0;
int currentLight = 0;
bool currentMotion = false;

unsigned long lastPresenceScan = 0;
unsigned long lastSensorRead = 0;
unsigned long lastSupabaseLog = 0;
unsigned long lastMotionDetected = 0;
unsigned long lastSlideChange = 0;

const unsigned long PRESENCE_INTERVAL = 300000; // 5 minutes
const unsigned long SENSOR_INTERVAL = 2000;
const unsigned long SUPABASE_INTERVAL = 10000;
const unsigned long LCD_TIMEOUT = 60000; // 1 minute
const unsigned long SLIDE_INTERVAL = 4000;

int currentSlide = 0;

String getLightLabel(int value) {
  if (value > 3000) return "Bright";
  else if (value > 1500) return "Medium";
  else if (value > 500) return "Dim";
  else return "Dark";
}

String getAirLabel(int value) {
  if (value < 300) return "Good";
  else if (value < 500) return "Moderate";
  else if (value < 700) return "Poor";
  else return "Hazardous";
}

void showLCD(String line1, String line2) {
  if (!lcdOn) return;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void lcdTurnOn() {
  if (!lcdOn) {
    lcdOn = true;
    lcd.backlight();
    Serial.println("[LCD] ON");
  }
}

void lcdTurnOff() {
  if (lcdOn) {
    lcdOn = false;
    lcd.noBacklight();
    lcd.clear();
    Serial.println("[LCD] OFF — no motion for 1 min");
  }
}

void playWelcome() {
  tone(BUZZER_PIN, 1000); delay(100);
  tone(BUZZER_PIN, 1500); delay(100);
  tone(BUZZER_PIN, 2000); delay(150);
  noTone(BUZZER_PIN);
}

void playGoodbye() {
  tone(BUZZER_PIN, 2000); delay(100);
  tone(BUZZER_PIN, 1500); delay(100);
  tone(BUZZER_PIN, 1000); delay(150);
  noTone(BUZZER_PIN);
}

void playAlert() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 1000); delay(200);
    tone(BUZZER_PIN, 2000); delay(200);
  }
  noTone(BUZZER_PIN);
}

void postToSupabase(String table, String body) {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String(supabaseUrl) + "/rest/v1/" + table;
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabaseKey);
  http.addHeader("Authorization", String("Bearer ") + supabaseKey);
  http.addHeader("Prefer", "return=minimal");
  int code = http.POST(body);
  Serial.println("[Supabase] " + table + " → " + String(code));
  http.end();
}

void logSensorData() {
  DynamicJsonDocument doc(512);
  doc["temperature"] = currentTemp;
  doc["humidity"] = currentHum;
  doc["pressure"] = currentPressure;
  doc["air_quality"] = currentAir;
  doc["air_label"] = getAirLabel(currentAir);
  doc["light_value"] = currentLight;
  doc["light_label"] = getLightLabel(currentLight);
  doc["motion"] = currentMotion;
  doc["is_home"] = isHome;
  doc["gas_alert"] = (currentAir > 700);
  doc["heat_alert"] = (currentTemp > 35);
  String body;
  serializeJson(doc, body);
  postToSupabase("esp32_monitor", body);
}

void logPresenceEvent(String person, String eventType) {
  DynamicJsonDocument doc(256);
  doc["event_type"] = eventType;
  doc["person"] = person;
  String body;
  serializeJson(doc, body);
  postToSupabase("presence_events", body);
}

bool checkPhonePresence() {
  Serial.println("[Presence] Checking...");
  WiFiClient client;
  client.setTimeout(1000);
  IPAddress phoneAddr;
  phoneAddr.fromString(phoneIP);
  if (client.connect(phoneAddr, 62078)) { client.stop(); Serial.println("[Presence] Home"); return true; }
  if (client.connect(phoneAddr, 443))   { client.stop(); Serial.println("[Presence] Home"); return true; }
  if (client.connect(phoneAddr, 80))    { client.stop(); Serial.println("[Presence] Home"); return true; }
  Serial.println("[Presence] Away");
  return false;
}

void readSensors() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) currentTemp = t;
  if (!isnan(h)) currentHum = h;
  currentPressure = bmpFound ? bmp.readPressure() / 100.0 : 0;
  currentAir = analogRead(MQ135_PIN);
  currentLight = analogRead(LIGHT_PIN);
  currentMotion = (digitalRead(PIR_PIN) == HIGH);
}

void updateLCDSlide() {
  if (!lcdOn) return;
  if (millis() - lastSlideChange < SLIDE_INTERVAL) return;
  lastSlideChange = millis();

  switch (currentSlide) {
    case 0:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("T:" + String((int)currentTemp) + "C H:" + String((int)currentHum) + "%");
      lcd.setCursor(0, 1);
      lcd.print("P:" + String((int)currentPressure) + "hPa");
      break;
    case 1:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Air:" + getAirLabel(currentAir));
      lcd.setCursor(0, 1);
      lcd.print("Light:" + getLightLabel(currentLight));
      break;
    case 2:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Motion:" + String(currentMotion ? "Yes" : "No"));
      lcd.setCursor(0, 1);
      lcd.print(isHome ? "Ahmad: Home" : "Ahmad: Away");
      break;
    case 3:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi:" + String(WiFi.RSSI()) + "dBm");
      lcd.setCursor(0, 1);
      lcd.print("IP:" + WiFi.localIP().toString());
      break;
  }
  currentSlide = (currentSlide + 1) % 4;
}

void handleRoot() {
  String airColor, lightColor;
  String airLabel = getAirLabel(currentAir);
  String lightLabel = getLightLabel(currentLight);

  if (currentAir < 300) airColor = "#1dde8f";
  else if (currentAir < 500) airColor = "#ffd60a";
  else if (currentAir < 700) airColor = "#ff9f1c";
  else airColor = "#ff3b30";

  if (currentLight > 3000) lightColor = "#fbbf24";
  else if (currentLight > 1500) lightColor = "#fb923c";
  else if (currentLight > 500) lightColor = "#a78bfa";
  else lightColor = "#4a6070";

  String html = R"rawhtml(
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Room 2 Monitor</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080c0f;color:#e0e8f0;font-family:'Syne',sans-serif;min-height:100vh;padding:24px 16px;}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:480px;margin:0 auto;}
  .header{max-width:480px;margin:0 auto 20px;display:flex;justify-content:space-between;align-items:flex-end;}
  .header h1{font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#e0e8f0;}
  .header .dot{width:8px;height:8px;border-radius:50%;background:#1dde8f;animation:pulse 2s infinite;}
  .header .tag{font-size:11px;font-weight:700;letter-spacing:1px;color:#4a6070;background:#0d1318;border:1px solid #1a2530;border-radius:6px;padding:4px 8px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .card{background:#0d1318;border:1px solid #1a2530;border-radius:16px;padding:20px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;}
  .card.temp::before{background:linear-gradient(90deg,#ff6b35,#ff9f1c);}
  .card.hum::before{background:linear-gradient(90deg,#00b4d8,#90e0ef);}
  .card.pressure::before{background:linear-gradient(90deg,#06d6a0,#1dde8f);}
  .card.air::before{background:linear-gradient(90deg,#8338ec,#3a86ff);}
  .card.light::before{background:linear-gradient(90deg,#fbbf24,#fb923c);}
  .card.motion::before{background:linear-gradient(90deg,#1dde8f,#06d6a0);}
  .card.presence::before{background:linear-gradient(90deg,#38bdf8,#818cf8);}
  .card-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#4a6070;margin-bottom:12px;}
  .card-value{font-family:'Space Mono',monospace;font-size:42px;font-weight:700;line-height:1;}
  .card-unit{font-size:16px;font-weight:400;color:#4a6070;margin-left:2px;}
  .card.temp .card-value{color:#ff9f1c;}
  .card.hum .card-value{color:#00b4d8;}
  .card.pressure .card-value{color:#1dde8f;font-size:32px;}
  .card.air .card-value{color:#8338ec;}
  .card.light .card-value{color:#fbbf24;font-size:28px;}
  .card.motion .card-value{font-size:28px;color:#1dde8f;}
  .card.presence .card-value{font-size:24px;}
  .sub-label{font-size:13px;font-weight:700;margin-top:8px;letter-spacing:1px;}
  .card.alert-card{border-color:#ff3b30;background:#1a0a0a;grid-column:1/-1;}
  .card.alert-card::before{background:linear-gradient(90deg,#ff3b30,#ff6b35);height:3px;}
  .alert-text{font-family:'Space Mono',monospace;font-size:28px;font-weight:700;color:#ff3b30;letter-spacing:2px;}
  .alert-sub{font-size:12px;color:#ff6b35;margin-top:6px;letter-spacing:1px;}
  .full-width{grid-column:1/-1;}
</style>
</head>
<body>
<div class="header">
  <h1>Room 2 Monitor</h1>
  <div style="display:flex;align-items:center;gap:10px;">
    <span class="tag">ESP32</span>
    <div class="dot"></div>
  </div>
</div>
<div class="grid">
)rawhtml";

  // Gas alert
  if (currentAir > 700) {
    html += R"(<div class="card alert-card"><div class="card-label">Warning</div><div class="alert-text">GAS DETECTED</div><div class="alert-sub">Ventilate immediately</div></div>)";
  }
  // Heat alert
  if (currentTemp > 35) {
    html += R"(<div class="card alert-card"><div class="card-label">Warning</div><div class="alert-text">HIGH TEMP</div><div class="alert-sub">)" + String((int)currentTemp) + R"(°C — cool down room</div></div>)";
  }

  html += R"(<div class="card temp"><div class="card-label">Temperature</div><div class="card-value">)" + String((int)currentTemp) + R"(<span class="card-unit">°C</span></div></div>)";
  html += R"(<div class="card hum"><div class="card-label">Humidity</div><div class="card-value">)" + String((int)currentHum) + R"(<span class="card-unit">%</span></div></div>)";
  html += R"(<div class="card pressure"><div class="card-label">Pressure</div><div class="card-value">)" + String((int)currentPressure) + R"(<span class="card-unit">hPa</span></div></div>)";
  html += R"(<div class="card air"><div class="card-label">Air Quality</div><div class="card-value">)" + String(currentAir) + R"(<span class="card-unit">raw</span></div><div class="sub-label" style="color:)" + airColor + R"(;">)" + airLabel + R"(</div></div>)";
  html += R"(<div class="card light"><div class="card-label">Light</div><div class="card-value">)" + lightLabel + R"(</div><div class="sub-label" style="color:)" + lightColor + R"(;">)" + String(currentLight) + R"( raw</div></div>)";

  html += currentMotion ?
    R"(<div class="card motion"><div class="card-label">Motion</div><div class="card-value">Active</div></div>)" :
    R"(<div class="card motion"><div class="card-label">Motion</div><div class="card-value" style="color:#1a2a38;">None</div></div>)";

  html += isHome ?
    R"(<div class="card presence full-width"><div class="card-label">Presence</div><div class="card-value" style="color:#1dde8f;">Ahmad is Home</div></div>)" :
    R"(<div class="card presence full-width"><div class="card-label">Presence</div><div class="card-value" style="color:#4a6070;">Ahmad is Away</div></div>)";

  html += R"rawhtml(
</div>
</body></html>
)rawhtml";

  webServer.send(200, "text/html", html);
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  pinMode(PIR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  lcd.init();
  lcd.backlight();
  showLCD("Room Monitor", "Starting...");
  delay(1500);

  dht.begin();
  delay(2000);
  float testTemp = dht.readTemperature();
  dhtFound = !isnan(testTemp);
  if (dhtFound) { showLCD("DHT22", "OK"); }
  else { showLCD("ERROR:", "DHT22 missing"); tone(BUZZER_PIN, 500); delay(500); noTone(BUZZER_PIN); }
  delay(1000);

  if (bmp.begin(0x76)) {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
    bmpFound = true;
    showLCD("BMP280", "OK");
  } else {
    showLCD("ERROR:", "BMP280 missing");
    tone(BUZZER_PIN, 500); delay(500); noTone(BUZZER_PIN);
  }
  delay(1000);

  showLCD("MQ135", analogRead(MQ135_PIN) > 0 ? "OK" : "ERROR");
  delay(1000);
  showLCD("Light", analogRead(LIGHT_PIN) > 0 ? "OK" : "ERROR");
  delay(1000);
  showLCD("PIR", "OK");
  delay(1000);

  showLCD("WiFi", "Connecting...");
  WiFi.begin(ssid, password);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500); tries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] IP: " + WiFi.localIP().toString());
    showLCD("WiFi OK", WiFi.localIP().toString());
  } else {
    showLCD("WiFi", "FAILED!");
  }
  delay(1000);

  showLCD("System Ready!", "All sensors up");
  tone(BUZZER_PIN, 1000); delay(100);
  tone(BUZZER_PIN, 1500); delay(100);
  tone(BUZZER_PIN, 2000); delay(100);
  noTone(BUZZER_PIN);
  delay(2000);

  webServer.on("/", handleRoot);
  webServer.begin();
  Serial.println("[Server] Started!");

  isHome = checkPhonePresence();
  lastHomeState = isHome;
  lastPresenceScan = millis();
  lastMotionDetected = millis();
}

void loop() {
  unsigned long now = millis();
  webServer.handleClient();

  // Read sensors every 2 seconds
  if (now - lastSensorRead > SENSOR_INTERVAL) {
    lastSensorRead = now;
    readSensors();
    Serial.println("===================");
    Serial.println("[DHT22] T:" + String(currentTemp) + "C H:" + String(currentHum) + "%");
    Serial.println("[BMP280] P:" + String(currentPressure) + "hPa");
    Serial.println("[MQ135] " + String(currentAir) + " (" + getAirLabel(currentAir) + ")");
    Serial.println("[Light] " + String(currentLight) + " (" + getLightLabel(currentLight) + ")");
    Serial.println("[PIR] " + String(currentMotion ? "DETECTED" : "none"));
    Serial.println("[Home] " + String(isHome ? "Ahmad HOME" : "Ahmad AWAY"));
  }

  // Motion handling
  if (currentMotion) {
    lastMotionDetected = now;
    if (!lcdOn) lcdTurnOn();
    if (!lastMotionState) {
      lastMotionState = true;
      Serial.println("[Motion] Started");
      logSensorData();
    }
  } else {
    if (lastMotionState) {
      lastMotionState = false;
      Serial.println("[Motion] Stopped");
    }
    if (lcdOn && (now - lastMotionDetected > LCD_TIMEOUT)) {
      lcdTurnOff();
    }
  }

  // Gas alert
  if (currentAir > 700) {
    Serial.println("[ALERT] GAS HAZARDOUS!");
    lcdTurnOn();
    showLCD("GAS ALERT!", "Ventilate now!");
    playAlert();
    logSensorData();
    delay(3000);
  }

  // Heat alert
  if (currentTemp > 35) {
    Serial.println("[ALERT] HEAT! Temp: " + String(currentTemp));
    lcdTurnOn();
    showLCD("HEAT ALERT!", "Temp:" + String((int)currentTemp) + "C");
  }

  // Presence check every 5 minutes
  if (now - lastPresenceScan > PRESENCE_INTERVAL) {
    lastPresenceScan = now;
    isHome = checkPhonePresence();

    if (isHome && !lastHomeState) {
      Serial.println("[Presence] Ahmad arrived!");
      lcdTurnOn();
      showLCD("Welcome Home!", "Ahmad");
      playWelcome();
      logPresenceEvent("Ahmad", "arrived");
      logSensorData();
      delay(2000);
    } else if (!isHome && lastHomeState) {
      Serial.println("[Presence] Ahmad left!");
      lcdTurnOn();
      showLCD("Goodbye!", "Ahmad left");
      playGoodbye();
      logPresenceEvent("Ahmad", "left");
      logSensorData();
      delay(2000);
    }
    lastHomeState = isHome;
  }

  // Log to Supabase every 10 seconds
  if (now - lastSupabaseLog > SUPABASE_INTERVAL) {
    lastSupabaseLog = now;
    logSensorData();
  }

  updateLCDSlide();
}