#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ================================================================
// CAMERA MODEL
// ================================================================
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// ===========================
// WiFi & Cloudinary
// ===========================
const char* ssid = "beep beep boop beep";
const char* password = "mmmmmmmm";

const char* uploadPreset = "innovest";
const char* cloudinaryURL = "http://api.cloudinary.com/v1_1/dif04rozm/image/upload";

// ===========================
// Trigger Pin
// ===========================
const int triggerPin = 14;

// ================================================================
// Camera Setup
// ================================================================
void setupCamera() {
  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // 🔧 Stable settings
  config.frame_size   = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count     = 1;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("❌ Camera init failed!");
    while (true);
  }

  Serial.println("✅ Camera initialized");
}

// ================================================================
// Setup
// ================================================================
void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(true);

  pinMode(triggerPin, INPUT_PULLDOWN);

  setupCamera();

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi connected");

  Serial.println("------------------------------------");
  Serial.println("Camera Ready! Raise Pin 14 HIGH to capture");
  Serial.println("------------------------------------");
}

// ================================================================
// Loop
// ================================================================
void loop() {
  static bool triggered = false;

  bool state = digitalRead(triggerPin);
  Serial.printf("Pin 14: %d\n", state);

  if (state == HIGH && !triggered) {
    triggered = true;

    Serial.println("\n📸 Trigger detected!");
    captureAndUpload();
  }

  if (state == LOW) {
    triggered = false;
  }

  delay(100);
}

// ================================================================
// Capture and Upload (STREAM VERSION)
// ================================================================
void captureAndUpload() {
  Serial.println("STEP 1: Capturing image...");

  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Capture failed");
    return;
  }

  Serial.printf("✅ Image captured (%d bytes)\n", fb->len);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected");
    esp_camera_fb_return(fb);
    return;
  }

  String boundary = "----ESP32Boundary";

  String head =
    "--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"file\"; filename=\"image.jpg\"\r\n"
    "Content-Type: image/jpeg\r\n\r\n";

  String tail =
    "\r\n--" + boundary + "\r\n"
    "Content-Disposition: form-data; name=\"upload_preset\"\r\n\r\n" +
    String(uploadPreset) +
    "\r\n--" + boundary + "--\r\n";

  size_t totalLength = head.length() + fb->len + tail.length();

  // Allocate in PSRAM
  uint8_t *body = (uint8_t *)ps_malloc(totalLength);
  if (!body) {
    Serial.println("❌ ps_malloc failed");
    esp_camera_fb_return(fb);
    return;
  }

  // Assemble body
  memcpy(body, head.c_str(), head.length());
  memcpy(body + head.length(), fb->buf, fb->len);
  memcpy(body + head.length() + fb->len, tail.c_str(), tail.length());

  esp_camera_fb_return(fb);  // Free camera buffer ASAP

  Serial.println("STEP 2: Starting upload...");

  WiFiClient client;
  HTTPClient http;
  http.begin(client, cloudinaryURL);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  int code = http.POST(body, totalLength);

  free(body);

  if (code > 0) {
    Serial.printf("✅ Upload response code: %d\n", code);
    String response = http.getString();
    Serial.println(response);

    // Extract etag and secure_url
    int etagStart = response.indexOf("\"etag\":\"");
    String etag = "";
    if (etagStart > -1) {
      etagStart += 8;
      int etagEnd = response.indexOf("\"", etagStart);
      if (etagEnd > -1) etag = response.substring(etagStart, etagEnd);
    }

    String secureUrl = "";
    int urlStart = response.indexOf("\"secure_url\":\"");
    if (urlStart > -1) {
      urlStart += 14;
      int urlEnd = response.indexOf("\"", urlStart);
      if (urlEnd > -1) secureUrl = response.substring(urlStart, urlEnd);
    }

    http.end(); // Close the first connection

    if (etag != "") {
      Serial.println("Extracted ETag: " + etag);
      Serial.println("Sending ETag to backend...");
      
      // Send to Backend
      HTTPClient backendHttp;
      WiFiClient backendClient; // Use a fresh client for the backend
      backendHttp.begin(backendClient, "http://10.13.81.11:3000/api/save-etag");
      backendHttp.addHeader("Content-Type", "application/json");
      
      String jsonPayload = "{\"etag\":\"" + etag + "\",\"secure_url\":\"" + secureUrl + "\"}";
      int bCode = backendHttp.POST(jsonPayload);
      
      if (bCode > 0) {
        Serial.printf("✅ Saved ETag to backend: %d\n", bCode);
      } else {
        Serial.printf("❌ Failed to save ETag: %s\n", backendHttp.errorToString(bCode).c_str());
      }
      backendHttp.end();
    }
  } else {
    http.end(); // Ensure to close if code was <= 0
  }

  Serial.println("STEP 3: Done\n");
}