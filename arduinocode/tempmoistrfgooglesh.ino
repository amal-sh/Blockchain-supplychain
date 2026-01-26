#include <DHT.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

// ----- Sensor Pins -----
#define DHTPIN 2         // GPIO2 (D4)
#define RAIN_PIN 5       // GPIO5 (D1)
#define MOISTURE_PIN A0  // A0 for soil moisture
#define DHTTYPE DHT11    // Sensor type

// ----- WiFi Credentials -----
const char* ssid = "RomRomRom";
const char* password = "jkiajkia";

// ----- Server Endpoint -----
const char* serverURL = "http://10.44.21.11:3000/api/sensor-data";

// ----- Farm Identifier -----
// Replace this with the actual ID of the farm from your MongoDB database
const char* farmId = "68f1f0ad8b1f5c98334fb5a5";

// ----- Soil Calibration -----
const int dryValue = 620;
const int wetValue = 310;

// ----- Global Variables -----
DHT dht(DHTPIN, DHTTYPE);
volatile int rainCount = 0;
unsigned long lastRainTime = 0;

void IRAM_ATTR countRain() {
  if (millis() - lastRainTime > 500) { // debounce 500ms
    rainCount++;
    lastRainTime = millis();
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();

  pinMode(MOISTURE_PIN, INPUT);
  pinMode(RAIN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(RAIN_PIN), countRain, FALLING);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
}

void loop() {
  // ----- Read Sensors -----
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  int rawSoil = analogRead(MOISTURE_PIN);
  int soil = map(rawSoil, dryValue, wetValue, 0, 100);
  soil = constrain(soil, 0, 100);

  float rain = rainCount * 0.2794; // mm

  // ----- Print to Serial -----
  Serial.printf("Temp: %.1f°C | Hum: %.1f%% | Soil: %d%% | Rain: %.2fmm\n",
                temperature, humidity, soil, rain);

  // ----- Send to Local Next.js Server -----
  sendToServer(temperature, humidity, soil, rain);

  // Reset rain counter hourly
  if (millis() % 3600000 < 2000) rainCount = 0;

  delay(10000); // Wait 10 seconds between posts
}

void sendToServer(float temp, float hum, int soil, float rain) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.reconnect();
    delay(2000);
    return;
  }

  WiFiClient client;
  HTTPClient http;

  http.begin(client, serverURL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  String json = "{";
  json += "\"temperature\":" + String(temp, 1) + ",";
  json += "\"humidity\":" + String(hum, 1) + ",";
  json += "\"soil\":" + String(soil) + ",";
  json += "\"rain\":" + String(rain, 2) + ",";
  json += "\"farmId\":\"" + String(farmId) + "\"";
  json += "}";

  Serial.println("Sending: " + json);

  int httpCode = http.POST(json);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("HTTP %d: %s\n", httpCode, response.c_str());
  } else {
    Serial.printf("POST failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}
