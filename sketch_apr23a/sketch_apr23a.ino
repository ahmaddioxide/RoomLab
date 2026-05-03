#include <Wire.h>
#include <DHT.h>
#include <Adafruit_BMP280.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ135_PIN 34
#define LIGHT_PIN 35
#define PIR_PIN 27
#define BUZZER_PIN 26

const char* ssid = "StackPebbles";
const char* password = "pebbles@133";
const char* phoneIP = "192.168.18.20";
const char* supabaseUrl = "https://qzhgdrwcxryfeiwojctw.supabase.co";
const char* supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6aGdkcndjeHJ5ZmVpd29qY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjE5ODIsImV4cCI6MjA5MTQ5Nzk4Mn0.FT066aNK7OkRkSN7grghmMKRkjxFjG58b4T_TGtI7OU";

DHT dht(DHTPIN, DHTTYPE);
Adafruit_BMP280 bmp;
LiquidCrystal_I2C lcd(0x27, 16, 2);

bool bmpFound = false;
bool dhtFound = false;
bool isHome = false;
bool lastHomeState = false;
bool lcdOn = true;
bool roommatePresent = false;

float currentTemp = 0;
float currentHum = 0;
float currentPressure = 0;
int currentAir = 0;
int currentLight = 0;
bool currentMotion = false;
bool lastMotionState = false;

unsigned long lastPresenceScan = 0;
unsigned long lastSensorRead = 0;
unsigned long lastSupabaseLog = 0;
unsigned long lastMotionTime = 0;
unsigned long roommateArrivalTime = 0;
unsigned long lastMotionDetected = 0;

const unsigned long PRESENCE_INTERVAL = 30000;
const unsigned long SENSOR_INTERVAL = 2000;
const unsigned long SUPABASE_INTERVAL = 10000;
const unsigned long LCD_TIMEOUT = 60000;
const unsigned long ROOMMATE_TIMEOUT = 300000; // 5 min no motion = roommate left

int currentSlide = 0;
unsigned long lastSlideChange = 0;
const unsigned long SLIDE_INTERVAL = 4000;

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
    Serial.println("[LCD] Turned ON");
  }
}

void lcdTurnOff() {
  if (lcdOn) {
    lcdOn = false;
    lcd.noBacklight();
    lcd.clear();
    Serial.println("[LCD] Turned OFF — no motion for 1 min");
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

void logPresenceEvent(String person, String eventType, int durationMinutes = 0) {
  DynamicJsonDocument doc(256);
  doc["event_type"] = eventType;
  doc["person"] = person;
  if (durationMinutes > 0) doc["duration_minutes"] = durationMinutes;
  String body;
  serializeJson(doc, body);
  postToSupabase("presence_events", body);
}

void logRoommateSession(unsigned long arrivalMs, unsigned long leftMs) {
  int durationMinutes = (leftMs - arrivalMs) / 60000;
  DynamicJsonDocument doc(256);
  doc["duration_minutes"] = durationMinutes;
  doc["ahmad_was_away"] = true;
  String body;
  serializeJson(doc, body);
  postToSupabase("roommate_sessions", body);
  Serial.println("[Roommate] Session ended. Duration: " + String(durationMinutes) + " min");
}

bool checkPhonePresence() {
  Serial.println("[Presence] Checking...");
  WiFiClient client;
  client.setTimeout(1000);
  IPAddress phoneAddr(192, 168, 18, 20);
  if (client.connect(phoneAddr, 62078)) { client.stop(); return true; }
  if (client.connect(phoneAddr, 443))   { client.stop(); return true; }
  if (client.connect(phoneAddr, 80))    { client.stop(); return true; }
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
      lcd.print("P:" + String((int)currentPressure) + " " + getAirLabel(currentAir).substring(0, 4));
      break;
    case 1:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Light:" + getLightLabel(currentLight));
      lcd.setCursor(0, 1);
      if (currentMotion) {
        lcd.print(isHome ? "Motion:Ahmad" : "Motion:Roomie");
      } else {
        lcd.print("Motion: None");
      }
      break;
    case 2:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Presence:");
      lcd.setCursor(0, 1);
      lcd.print(isHome ? "Ahmad Home" : "Ahmad Away");
      break;
    case 3:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Air:" + getAirLabel(currentAir));
      lcd.setCursor(0, 1);
      lcd.print("WiFi:" + String(WiFi.RSSI()) + "dBm");
      break;
  }
  currentSlide = (currentSlide + 1) % 4;
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

  isHome = checkPhonePresence();
  lastHomeState = isHome;
  lastPresenceScan = millis();
  lastMotionTime = millis();
  lastMotionDetected = millis();
}

void loop() {
  unsigned long now = millis();

  // Read sensors
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

    // Turn LCD on if off
    if (!lcdOn) lcdTurnOn();

    // Motion just started
    if (!lastMotionState) {
      lastMotionState = true;
      Serial.println("[Motion] Started");

      if (!isHome) {
        // Roommate arrived
        if (!roommatePresent) {
          roommatePresent = true;
          roommateArrivalTime = now;
          Serial.println("[Roommate] Arrived!");
          logPresenceEvent("Roommate", "arrived");
          logSensorData();
        }
      }
    }
  } else {
    // No motion
    if (lastMotionState) {
      lastMotionState = false;
      Serial.println("[Motion] Stopped");
    }

    // LCD timeout — turn off after 1 min of no motion
    if (lcdOn && (now - lastMotionDetected > LCD_TIMEOUT)) {
      lcdTurnOff();
    }

    // Roommate left — no motion for 5 min while Ahmad away
    if (!isHome && roommatePresent && (now - lastMotionDetected > ROOMMATE_TIMEOUT)) {
      roommatePresent = false;
      Serial.println("[Roommate] Left!");
      logPresenceEvent("Roommate", "left", (now - roommateArrivalTime) / 60000);
      logRoommateSession(roommateArrivalTime, now);
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
    Serial.println("[ALERT] HEAT ALERT! Temp: " + String(currentTemp));
    lcdTurnOn();
    showLCD("HEAT ALERT!", "Temp:" + String((int)currentTemp) + "C");
    logSensorData();
  }

  // Presence check every 30 seconds
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

  // Update LCD slides
  updateLCDSlide();
}