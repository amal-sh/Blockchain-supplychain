#include "esp_camera.h"
#include <WiFi.h>

// ================================================================
// CAMERA MODEL - Uncomment your specific board
// ================================================================
#define CAMERA_MODEL_AI_THINKER // Has PSRAM
//#define CAMERA_MODEL_WROVER_KIT
//#define CAMERA_MODEL_ESP_EYE
//#define CAMERA_MODEL_M5STACK_PSRAM
//#define CAMERA_MODEL_M5STACK_V2_PSRAM
//#define CAMERA_MODEL_M5STACK_WIDE
//#define CAMERA_MODEL_M5STACK_ESP32CAM
//#define CAMERA_MODEL_AI_THINKER_NO_PSRAM

#include "camera_pins.h"

// ===========================
// WiFi Credentials
// ===========================
const char *ssid = "beep beep boop beep";
const char *password = "potatoslur";

// Trigger Pin
const int triggerPin = 14;

void startCameraServer();

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
  config.pixel_format = PIXFORMAT_JPEG; // for streaming
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.jpeg_quality = 12;
  config.fb_count = 1;

  // PSRAM check for higher resolution
  if (psramFound()) {
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // camera init
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  sensor_t * s = esp_camera_sensor_get();
  // Drop down frame size for higher initial frame rate
  s->set_framesize(s, FRAMESIZE_QVGA);

  // WiFi Connection
  WiFi.begin(ssid, password);
  WiFi.setSleep(false);

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  // Start the web server defined in the example tabs
  startCameraServer();

  Serial.println("");
  Serial.println("------------------------------------");
  Serial.print("Camera Ready! Use 'http://");
  Serial.print(WiFi.localIP());
  Serial.println("' to connect");
  Serial.println("Pull Pin 14 HIGH to trigger a capture URL.");
  Serial.println("------------------------------------");
}

void loop() {
  // Check if Pin 14 is HIGH
  if (digitalRead(triggerPin) == HIGH) {
    // We don't necessarily need to call esp_camera_fb_get() here 
    // because the URL /capture handles the capture itself. 
    // We just need to tell the user the URL is ready.
    
    Serial.println("\n[TRIGGER] Photo requested!");
    Serial.print("View URL: http://");
    Serial.print(WiFi.localIP());
    Serial.println("/capture");
    
    // Simple debounce/cooldown delay
    delay(2000); 
  }
  
  // Minimal delay to keep the background tasks (WiFi/Web Server) running smoothly
  delay(10);
}