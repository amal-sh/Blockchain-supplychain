#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>

// --- Configuration ---
#define MOISTURE_PIN 32
#define RAIN_PIN 34 // Modify this to the correct pin for your rainfall sensor
#define DHTPIN 14 
#define LED_PIN 13
#define DHTTYPE DHT11

const char* ssid = "beep beep boop beep";          // Add your WiFi Name
const char* password = "mmmmmmmm";  // Add your WiFi Password
const char* serverURL = "http://10.13.81.11:3000/api/sensor-data";
const char* farmId = "68b72a6325dd051caf5d15b4";

const int dryValue = 3000;
const int wetValue = 1500;

DHT_Unified dht(DHTPIN, DHTTYPE);
uint32_t delayMS;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(MOISTURE_PIN, INPUT);
  pinMode(RAIN_PIN, INPUT);
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  dht.begin();
  sensor_t sensor;
  dht.temperature().getSensor(&sensor);
  dht.humidity().getSensor(&sensor);
  delayMS = max((uint32_t)2000, (uint32_t)(sensor.min_delay / 1000));
}

void loop() {
  delay(delayMS);
  
  float currentTemp = 0;
  float currentHum = 0;
  bool thresholdTriggered = false;

  // --- Temperature Logic ---
  sensors_event_t event;
  dht.temperature().getEvent(&event);
  if (!isnan(event.temperature)) {
    currentTemp = event.temperature;
    Serial.print(F("Temp: ")); Serial.print(currentTemp); Serial.println(F("°C"));
    if (currentTemp > 36.00 || currentTemp < 15.00) thresholdTriggered = true;
  }

  // --- Humidity Logic ---
  dht.humidity().getEvent(&event);
  if (!isnan(event.relative_humidity)) {
    currentHum = event.relative_humidity;
    Serial.print(F("Hum: ")); Serial.print(currentHum); Serial.println(F("%"));
    if (currentHum > 92.00 || currentHum < 30.00) thresholdTriggered = true;
  }

  // --- Soil Moisture Logic ---
  int rawSoil = analogRead(MOISTURE_PIN);
  int soilPercent = map(rawSoil, dryValue, wetValue, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);
  Serial.print(F("Moisture: ")); Serial.print(soilPercent); Serial.println(F("%"));
  
  if (soilPercent < 18) thresholdTriggered = true;

  // --- Rainfall Logic ---
  int rawRain = analogRead(RAIN_PIN);
  int rainPercent = map(rawRain, dryValue, wetValue, 0, 100);
  rainPercent = constrain(rainPercent, 0, 100);
  Serial.print(F("Rain: ")); Serial.print(rainPercent); Serial.println(F("%"));
  
  if (rainPercent > 50 || rainPercent < 5) thresholdTriggered = true;

  // --- Output Control ---
  digitalWrite(LED_PIN, thresholdTriggered ? HIGH : LOW);

  // --- Send Data ---
  sendToServer(currentTemp, currentHum, soilPercent, (float)rainPercent);
  
  Serial.println(F("-----------------------"));
}

void sendToServer(float temp, float hum, int soil, float rain) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected.");
    return;
  }

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  String json = "{";
  json += "\"temperature\":" + String(temp, 1) + ",";
  json += "\"humidity\":" + String(hum, 1) + ",";
  json += "\"soil\":" + String(soil) + ",";
  json += "\"rain\":" + String(rain, 2) + ",";
  json += "\"farmId\":\"" + String(farmId) + "\"";
  json += "}";

  int httpCode = http.POST(json);
  if (httpCode > 0) {
    Serial.printf("Server Response: %d\n", httpCode);
  } else {
    Serial.printf("Error: %s\n", http.errorToString(httpCode).c_str());
  }
  http.end();
}