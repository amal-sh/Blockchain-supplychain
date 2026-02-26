#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>

#define MOISTURE_PIN 34
#define DHTPIN 14 
#define LED_PIN 13
#define DHTTYPE DHT11

const int dryValue = 3000;
const int wetValue = 1500;

DHT_Unified dht(DHTPIN, DHTTYPE);
uint32_t delayMS;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(MOISTURE_PIN, INPUT);
  Serial.begin(9600);
  
  dht.begin();
  
  sensor_t sensor;
  dht.temperature().getSensor(&sensor);
  dht.humidity().getSensor(&sensor);
  
  // Ensure delay is at least 2 seconds for DHT11 stability
  delayMS = max((uint32_t)2000, (uint32_t)(sensor.min_delay / 1000));
}

void loop() {
  delay(delayMS);

  // --- Temperature Logic ---
  sensors_event_t event;
  dht.temperature().getEvent(&event);
  
  bool thresholdTriggered = false;

  if (isnan(event.temperature)) {
    Serial.println(F("Error reading temperature!"));
  } else {
    Serial.print(F("Temperature: "));
    Serial.print(event.temperature);
    Serial.println(F("°C"));
    
    if (event.temperature > 20.00) {
      thresholdTriggered = true;
      Serial.println(F("-> Alert: Temperature threshold crossed!"));
    }
  }

  // --- Soil Moisture Logic ---
  int rawSoil = analogRead(MOISTURE_PIN);
  int soilPercent = map(rawSoil, dryValue, wetValue, 0, 100);
  soilPercent = constrain(soilPercent, 0, 100);

  Serial.print(F("Moisture: "));
  Serial.print(soilPercent);
  Serial.println(F("%"));

  if (soilPercent < 30) { // Changed from 400 to 30%
    thresholdTriggered = true;
    Serial.println(F("-> Alert: Soil is dry!"));
  }

  // --- Output Control ---
  if (thresholdTriggered) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  // --- Humidity Logic ---
  dht.humidity().getEvent(&event);
  if (isnan(event.relative_humidity)) {
    Serial.println(F("Error reading humidity!"));
  } else {
    Serial.print(F("Humidity: "));
    Serial.print(event.relative_humidity);
    Serial.println(F("%"));
  }
  Serial.println(F("-----------------------"));
}