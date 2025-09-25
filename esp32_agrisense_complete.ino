/*
 * AgriSense ESP32 Moisture Sensor - Complete Version with Debug
 * Connects to WiFi and sends moisture data every 30 seconds
 * Uses WiFi Manager for easy WiFi setup
 */

#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Pin Definitions
#define MOISTURE_PIN 35  // GPIO 35 (ADC1_CH7)
#define LED_PIN 2        // Built-in LED
#define RESET_BUTTON_PIN 0  // Boot button for WiFi reset

// Device Configuration - CHANGE THIS FOR EACH DEVICE
const String DEVICE_API_KEY = "YOUR_REAL_32_CHAR_API_KEY_HERE"; // Replace with real API key from database

// Server Configuration - UPDATE WITH YOUR IP
const String SERVER_URL = "http://192.168.31.80:5000/api/device/sensor-data"; // Your server URL

// Calibration values (adjust based on your sensor)
#define DRY_VALUE 4095   // Sensor value in completely dry soil
#define WET_VALUE 800    // Sensor value in completely wet soil

// Timing
const unsigned long SEND_INTERVAL = 30000; // 30 seconds
const unsigned long WIFI_CHECK_INTERVAL = 60000; // 1 minute
const unsigned long STATUS_PRINT_INTERVAL = 120000; // 2 minutes

// Variables
int moistureRaw = 0;
int moisturePercent = 0;
unsigned long lastSendTime = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastStatusPrint = 0;
bool deviceLinked = false;
WiFiManager wm;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize ADC
  analogSetAttenuation(ADC_11db);
  
  Serial.println("\n=================================");
  Serial.println("    AgriSense ESP32 Sensor      ");
  Serial.println("=================================");
  Serial.println("Device API Key: " + DEVICE_API_KEY.substring(0, 8) + "...");
  Serial.println("Server URL: " + SERVER_URL);
  
  // Setup WiFi
  setupWiFi();
  
  // Test basic connectivity
  testBasicConnection();
  
  // Initial sensor reading
  readMoisture();
  Serial.println("Setup complete! Starting sensor loop...");
  Serial.println("=================================\n");
}

void loop() {
  // Check WiFi reset button
  checkResetButton();
  
  // Check WiFi connection periodically
  if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    checkWiFiConnection();
    lastWiFiCheck = millis();
  }
  
  // Send sensor data every 30 seconds
  if (millis() - lastSendTime >= SEND_INTERVAL) {
    readMoisture();
    sendSensorData();
    lastSendTime = millis();
  }
  
  // Print status every 2 minutes
  if (millis() - lastStatusPrint >= STATUS_PRINT_INTERVAL) {
    printStatus();
    lastStatusPrint = millis();
  }
  
  // Update LED status
  updateLEDStatus();
  
  delay(1000); // Small delay to prevent watchdog issues
}

void setupWiFi() {
  Serial.println("🌐 Setting up WiFi...");
  
  // Set custom parameters for WiFi Manager
  wm.setConfigPortalTimeout(300); // 5 minutes timeout
  wm.setAPStaticIPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  
  // Custom parameters
  WiFiManagerParameter custom_html("<p><b>AgriSense Device Setup</b></p><p>Connect this device to your WiFi network</p>");
  wm.addParameter(&custom_html);
  
  // Try to connect to saved WiFi
  Serial.println("🔄 Attempting to connect to saved WiFi...");
  if (!wm.autoConnect("AgriSense_Setup", "agrisense123")) {
    Serial.println("❌ Failed to connect to WiFi");
    Serial.println("🔄 Restarting ESP32...");
    ESP.restart();
  }
  
  Serial.println("✅ WiFi connected successfully!");
  Serial.print("📍 IP address: ");
  Serial.println(WiFi.localIP());
  Serial.print("📶 Signal strength: ");
  Serial.print(WiFi.RSSI());
  Serial.println(" dBm");
  Serial.print("🌐 Gateway: ");
  Serial.println(WiFi.gatewayIP());
  Serial.print("🌍 DNS: ");
  Serial.println(WiFi.dnsIP());
}

void testBasicConnection() {
  Serial.println("\n🧪 Testing basic server connectivity...");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping test");
    return;
  }
  
  HTTPClient http;
  String healthURL = "http://192.168.31.80:5000/api/health";
  
  Serial.println("📡 Testing: " + healthURL);
  http.begin(healthURL);
  http.setTimeout(10000);
  
  int httpResponseCode = http.GET();
  Serial.print("🏥 Health check response: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ Server is reachable!");
    Serial.println("📄 Response: " + response);
  } else {
    Serial.println("❌ Server not reachable!");
    Serial.println("🔍 Check if backend is running on port 5000");
  }
  
  http.end();
  Serial.println("🧪 Basic connectivity test complete\n");
}

void checkResetButton() {
  static unsigned long buttonPressTime = 0;
  static bool buttonPressed = false;
  
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    if (!buttonPressed) {
      buttonPressed = true;
      buttonPressTime = millis();
      Serial.println("🔘 Reset button pressed...");
    } else if (millis() - buttonPressTime > 5000) { // 5 seconds
      Serial.println("🔄 Resetting WiFi settings...");
      wm.resetSettings();
      ESP.restart();
    }
  } else {
    buttonPressed = false;
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("📡 WiFi disconnected! Attempting to reconnect...");
    WiFi.reconnect();
    delay(5000);
    
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("❌ Failed to reconnect. Restarting...");
      ESP.restart();
    } else {
      Serial.println("✅ WiFi reconnected!");
      Serial.print("📍 New IP: ");
      Serial.println(WiFi.localIP());
    }
  }
}

void readMoisture() {
  // Take multiple readings for accuracy
  int total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(MOISTURE_PIN);
    delay(10);
  }
  moistureRaw = total / 10;
  
  // Convert to percentage (0-100%)
  moisturePercent = map(moistureRaw, DRY_VALUE, WET_VALUE, 0, 100);
  moisturePercent = constrain(moisturePercent, 0, 100);
  
  // Display reading
  Serial.println("─────────────────────────────────");
  Serial.print("📍 GPIO 35 | Raw: ");
  Serial.print(moistureRaw);
  Serial.print(" | Moisture: ");
  Serial.print(moisturePercent);
  Serial.println("%");
  
  String status = getMoistureStatus(moisturePercent);
  Serial.println("🌱 Status: " + status);
  
  // Progress bar visualization
  Serial.print("📊 [");
  int bars = moisturePercent / 5; // 20 bars total
  for (int i = 0; i < 20; i++) {
    if (i < bars) {
      Serial.print("█");
    } else {
      Serial.print("░");
    }
  }
  Serial.println("]");
}

String getMoistureStatus(int moisture) {
  if (moisture >= 85) return "Very Wet 💦";
  else if (moisture >= 65) return "Wet 💧";
  else if (moisture >= 45) return "Moist ✅";
  else if (moisture >= 25) return "Dry ⚠️";
  else return "Very Dry 🔥";
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skipping send");
    return;
  }
  
  Serial.println("\n🚀 Sending sensor data to server...");
  Serial.println("🔗 Server URL: " + SERVER_URL);
  Serial.println("🔑 API Key: " + DEVICE_API_KEY.substring(0, 8) + "..." + DEVICE_API_KEY.substring(28));
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000); // 15 second timeout
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["apiKey"] = DEVICE_API_KEY;
  doc["moistureLevel"] = moisturePercent;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("📤 JSON Payload: ");
  Serial.println(jsonString);
  Serial.print("📏 JSON Length: ");
  Serial.println(jsonString.length());
  
  // Send POST request
  Serial.println("📡 Sending POST request...");
  unsigned long startTime = millis();
  int httpResponseCode = http.POST(jsonString);
  unsigned long endTime = millis();
  
  Serial.print("⏱️ Request took: ");
  Serial.print(endTime - startTime);
  Serial.println(" ms");
  Serial.print("📊 HTTP Response Code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("✅ Server Response: ");
    Serial.println(response);
    
    // Check response for linking status
    if (httpResponseCode == 200) {
      deviceLinked = true;
      Serial.println("🔗 Device is linked to farmer account");
    } else if (httpResponseCode == 400) {
      deviceLinked = false;
      Serial.println("⚠️ Device not linked to any farmer account");
      Serial.println("💡 Link this device in the farmer dashboard");
    } else {
      deviceLinked = false;
      Serial.println("⚠️ Unexpected response code");
    }
  } else {
    Serial.print("❌ HTTP Error Code: ");
    Serial.println(httpResponseCode);
    
    // Detailed error information
    switch (httpResponseCode) {
      case -1:
        Serial.println("🔍 Connection failed - check server IP and port");
        break;
      case -2:
        Serial.println("🔍 Send header failed");
        break;
      case -3:
        Serial.println("🔍 Send payload failed");
        break;
      case -4:
        Serial.println("🔍 Not connected");
        break;
      case -5:
        Serial.println("🔍 Connection lost");
        break;
      case -6:
        Serial.println("🔍 No stream");
        break;
      case -7:
        Serial.println("🔍 No HTTP server");
        break;
      case -8:
        Serial.println("🔍 Too less RAM");
        break;
      case -9:
        Serial.println("🔍 Encoding");
        break;
      case -10:
        Serial.println("🔍 Stream write");
        break;
      case -11:
        Serial.println("🔍 Read timeout");
        break;
      default:
        Serial.println("🔍 Unknown error");
    }
    
    // Additional network debug info
    Serial.print("🌐 WiFi Status: ");
    Serial.println(WiFi.status());
    Serial.print("📶 Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("📍 ESP32 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("🌐 Gateway: ");
    Serial.println(WiFi.gatewayIP());
    
    deviceLinked = false;
  }
  
  http.end();
  Serial.println("🔚 HTTP connection closed\n");
}

void updateLEDStatus() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  if (WiFi.status() != WL_CONNECTED) {
    // Fast blink - No WiFi
    if (millis() - lastBlink > 200) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = millis();
    }
  } else if (!deviceLinked) {
    // Slow blink - WiFi OK but not linked
    if (millis() - lastBlink > 1000) {
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState);
      lastBlink = millis();
    }
  } else {
    // Solid on - Everything OK
    digitalWrite(LED_PIN, HIGH);
  }
}

void printStatus() {
  Serial.println("\n📊 ═══════════════════════════════");
  Serial.println("           DEVICE STATUS          ");
  Serial.println("═══════════════════════════════");
  Serial.println("🆔 API Key: " + DEVICE_API_KEY.substring(0, 8) + "..." + DEVICE_API_KEY.substring(28));
  Serial.print("🌐 WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Connected ✅" : "Disconnected ❌");
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("📍 IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("📶 Signal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print("🌐 Gateway: ");
    Serial.println(WiFi.gatewayIP());
  }
  
  Serial.print("🔗 Device Linked: ");
  Serial.println(deviceLinked ? "Yes ✅" : "No ❌");
  Serial.print("💧 Current Moisture: ");
  Serial.print(moisturePercent);
  Serial.println("%");
  Serial.print("⏰ Uptime: ");
  Serial.print(millis() / 1000);
  Serial.println(" seconds");
  Serial.print("🔄 Next send in: ");
  Serial.print((SEND_INTERVAL - (millis() - lastSendTime)) / 1000);
  Serial.println(" seconds");
  Serial.println("═══════════════════════════════\n");
}
