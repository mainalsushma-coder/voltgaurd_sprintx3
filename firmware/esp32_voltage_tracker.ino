#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASSWORD";

String serverURL = "http://YOUR_IP:3000/data";

const int sensorPin = 34;
int thresholdLow = 180;   
int thresholdHigh = 260;
unsigned long blackoutStart = 0;
bool inBlackout = false;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  while(WiFi.status() != WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void loop() {
  int raw = analogRead(sensorPin);
  float voltage = raw * (3.3 / 4095.0) * 100;

  bool blackout = (voltage < 10);

  if (blackout && !inBlackout) {
    blackoutStart = millis();
    inBlackout = true;
  }

  if (!blackout && inBlackout) {
    unsigned long duration = millis() - blackoutStart;

    if (duration <= 5000) {
      sendEvent("Microblackout", duration);
    }
    inBlackout = false;
  }

  if (voltage < thresholdLow || voltage > thresholdHigh) {
    sendEvent("Voltage Fluctuation", voltage);
  }

  delay(200);
}

void sendEvent(String type, float value){
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\"event\":\"" + type + "\",\"value\":" + value + "}";
    http.POST(payload);

    http.end();
  }
}
