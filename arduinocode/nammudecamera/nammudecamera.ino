#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include "mbedtls/md.h" // Built-in ESP32 library for hashing

// ================================================================
// CAMERA MODEL
// ================================================================
#define CAMERA_MODEL_AI_THINKER
#include "camera_pins.h"

// ===========================
// WiFi & Server Credentials
// ===========================
const char *ssid = "beep beep boop beep";
const char *password = "potatoslur";

// NOTE: It is highly recommended to use a separate endpoint for binary image uploads!
const char *serverImageURL = "http://10.204.146.11:3000/api/upload-image"; 

const int triggerPin = 14;

void startCameraServer();

// Function prototype for hashing
String calculateSHA256(uint8_t *payload, size_t length);

void setup() {
  pinMode(triggerPin, INPUT);
  Serial.begin(115200);
  Serial.setDebugOutput(true);
  Serial.println();

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.frame_size = FRAMESIZE_UXGA;
  config.pixel_format = PIXFORMAT_JPEG; 
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  s->set_framesize(s, FRAMESIZE_QVGA); // Kept lower resolution for stable WiFi transmission

  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  startCameraServer();

  Serial.println("------------------------------------");
  Serial.println("Camera Ready!");
  Serial.println("Pull Pin 14 HIGH to capture, hash, and upload.");
  Serial.println("------------------------------------");
}

void loop() {
  if (digitalRead(triggerPin) == HIGH) {
    Serial.println("\n[TRIGGER] Capturing image...");

    // 1. Capture the image
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed!");
      delay(2000);
      return;
    }

    // 2. Hash the image data
    Serial.println("Calculating SHA-256 Hash...");
    String imageHash = calculateSHA256(fb->buf, fb->len);
    Serial.print("Hash: ");
    Serial.println(imageHash);

    // 3. Send to Server
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Uploading to server...");
      HTTPClient http;
      http.begin(serverImageURL);
      
      // Tell the server we are sending a raw JPEG image
      http.addHeader("Content-Type", "image/jpeg");
      // Pass the hash securely in the HTTP Headers
      http.addHeader("X-Image-Hash", imageHash); 

      // Send the actual image buffer
      int httpResponseCode = http.POST(fb->buf, fb->len);

      if (httpResponseCode > 0) {
        Serial.printf("Server Response Code: %d\n", httpResponseCode);
        String response = http.getString();
        Serial.println(response);
      } else {
        Serial.printf("Error sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    } else {
      Serial.println("WiFi Disconnected. Cannot upload.");
    }

    // 4. Free the camera memory (CRITICAL step to prevent crashes)
    esp_camera_fb_return(fb);

    // Cooldown to prevent spamming the server
    delay(5000); 
  }
  
  delay(10);
}

// ================================================================
// SHA-256 Hashing Function
// ================================================================
String calculateSHA256(uint8_t *payload, size_t length) {
  byte shaResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, payload, length);
  mbedtls_md_finish(&ctx, shaResult);
  mbedtls_md_free(&ctx);

  String hashStr = "";
  for(int i = 0; i < sizeof(shaResult); i++) {
    char str[3];
    sprintf(str, "%02x", (int)shaResult[i]);
    hashStr += str;
  }
  return hashStr;
}