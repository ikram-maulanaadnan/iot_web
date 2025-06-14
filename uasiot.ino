#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// =======================
// Kredensial WiFi & MQTT
// =======================
const char* ssid = "Galaxy Note9";        // Ganti dengan SSID WiFi Anda
const char* password = "J21112014";        // Ganti dengan Password WiFi Anda
const char* mqtt_server = "emqx.arxan.app"; // Alamat Broker MQTT Anda

// =======================
// Definisi Pin
// =======================
#define ONE_WIRE_BUS 4    // Pin data sensor suhu DS18B20
#define RELAY_PIN 2       // Pin kontrol modul relay (untuk pompa)
#define SOIL_PIN 34       // Pin input analog sensor kelembaban tanah (GPIO34-39 adalah ADC input)

// =======================
// Kalibrasi Sensor Kelembaban Tanah (PENTING!)
// =======================
// *** HARAP SESUAIKAN NILAI-NILAI INI SETELAH MENGKALIBRASI SENSOR ANDA ***
// Gunakan kode tes sederhana untuk mendapatkan nilai ADC mentah:
//   - Ketika sensor KERING PENUH: Catat nilai ADC tertinggi. Ini adalah minSoilMoistureADC.
//   - Ketika sensor TERCELUP DI AIR: Catat nilai ADC terendah. Ini adalah maxSoilMoistureADC.
// PASTIKAN minSoilMoistureADC > maxSoilMoistureADC (misal: kering 3000, basah 1200)
const int minSoilMoistureADC = 3000; // Contoh: nilai ADC saat sensor kering penuh (nilai lebih TINGGI)
const int maxSoilMoistureADC = 1200; // Contoh: nilai ADC saat sensor basah penuh (nilai lebih RENDAH)

// =======================
// Variabel & Instansi Global
// =======================
WiFiClient espClient;
PubSubClient client(espClient);

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// Enum untuk mode sistem
enum SystemMode {
  MODE_AUTO,
  MODE_MANUAL
};

SystemMode currentMode = MODE_AUTO; // Mode saat ini: AUTO atau MANUAL
bool manualPumpState = false;       // Status pompa saat mode manual (true=ON, false=OFF)
int soilThreshold = 45;             // Threshold kelembaban tanah dalam persentase (0-100%)

// Variabel untuk timer publikasi data MQTT & koneksi ulang
unsigned long lastMsgPublish = 0;
unsigned long lastReconnectAttempt = 0;
const long publishInterval = 5000; // Interval publikasi data ke MQTT (5 detik)
const long reconnectInterval = 5000; // Interval mencoba koneksi ulang MQTT (5 detik)

// =======================
// Prototipe Fungsi
// =======================
void setup_wifi();
void callback(char* topic, byte* payload, unsigned int length);
void reconnect_mqtt();
void controlPump(bool state);
void publishSensorData(float temp, int soilMoisture, bool pumpState);
int getSoilMoisturePercentage(int analogValue);

// =======================
// Fungsi Setup Arduino
// =======================
void setup() {
  Serial.begin(115200); // Mulai komunikasi Serial dengan baud rate stabil
  Serial.println("\nESP32 Sistem Irigasi Dimulai...");

  // Inisialisasi sensor dan pin
  sensors.begin();
  pinMode(RELAY_PIN, OUTPUT);

  // *** PENTING: ATUR RELAY KE KONDISI OFF DI AWAL ***
  // Asumsi: Relay adalah jenis AKTIF-HIGH (LOW = OFF, HIGH = ON).
  // Jadi, untuk memastikan pompa OFF di awal, kita kirim LOW.
  digitalWrite(RELAY_PIN, LOW); // Kirim LOW ke relay untuk memastikan pompa OFF
  Serial.println("Relay pin diinisialisasi ke OFF (Asumsi: Relay AKTIF-HIGH).");

  setup_wifi(); // Hubungkan ke jaringan WiFi

  // Konfigurasi klien MQTT
  client.setServer(mqtt_server, 1883); // Atur alamat broker dan port
  client.setCallback(callback);        // Daftarkan fungsi callback untuk pesan MQTT masuk
}

// =======================
// Fungsi Loop Arduino
// =======================
void loop() {
  // Pastikan klien MQTT terhubung. Jika tidak, coba hubungkan ulang.
  if (!client.connected()) {
    reconnect_mqtt();
  }
  client.loop(); // Proses pesan MQTT yang masuk dan pertahankan koneksi

  // ---- Baca Data Sensor ----
  sensors.requestTemperatures(); // Minta pembacaan suhu dari DS18B20
  float temperatureC = sensors.getTempCByIndex(0); // Ambil suhu dalam Celsius dari sensor pertama
  int soilAnalog = analogRead(SOIL_PIN);           // Baca nilai analog dari sensor kelembaban tanah
  int soilMoisturePercentage = getSoilMoisturePercentage(soilAnalog); // Konversi ke persentase

  // Tangani jika sensor suhu terputus
  if (temperatureC == DEVICE_DISCONNECTED_C) {
    Serial.println("DS18B20 sensor terputus atau error!");
    temperatureC = -999.0; // Berikan nilai error atau nilai default
  }

  // Debugging pembacaan sensor kelembaban tanah
  Serial.print("Soil Analog: ");
  Serial.print(soilAnalog);
  Serial.print(" -> Soil Moisture: ");
  Serial.print(soilMoisturePercentage);
  Serial.println("%");

  // ---- Logika Kontrol Pompa ----
  bool desiredPumpState = false; // Asumsi awal pompa mati
  if (currentMode == MODE_AUTO) {
    // Di mode otomatis: pompa ON jika tanah lebih KERING dari threshold
    // (persentase kelembaban tanah LEBIH KECIL dari threshold)
    desiredPumpState = (soilMoisturePercentage < soilThreshold);
    Serial.print("Mode: AUTO. Threshold: ");
    Serial.print(soilThreshold);
    Serial.print("%, Soil: ");
    Serial.print(soilMoisturePercentage);
    Serial.print("%. Pompa harus: ");
    Serial.println(desiredPumpState ? "ON" : "OFF");
  } else if (currentMode == MODE_MANUAL) {
    // Di mode manual: pompa ON/OFF berdasarkan flag manualPumpState
    desiredPumpState = manualPumpState;
    Serial.print("Mode: MANUAL. Pompa harus: ");
    Serial.println(desiredPumpState ? "ON" : "OFF");
  }
  
  controlPump(desiredPumpState); // Atur status relay sesuai dengan desiredPumpState

  // ---- Publikasi Data ke MQTT secara periodik ----
  unsigned long currentMillis = millis();
  if (currentMillis - lastMsgPublish >= publishInterval) {
    lastMsgPublish = currentMillis;
    publishSensorData(temperatureC, soilMoisturePercentage, desiredPumpState);
  }

  // Tambahkan sedikit delay untuk mencegah watchdog timer dan memungkinkan tugas lain berjalan
  delay(100);
}

// =======================
// Implementasi Fungsi
// =======================

/**
 * @brief Menghubungkan ke jaringan WiFi.
 */
void setup_wifi() {
  delay(10);
  Serial.print("Menghubungkan ke WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) { // Timeout 20 detik
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi terhubung!");
    Serial.print("Alamat IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nGagal terhubung ke WiFi. Periksa kredensial dan coba lagi.");
    delay(5000); // Tunggu sebelum mencoba lagi
    ESP.restart(); // Restart ESP jika gagal koneksi WiFi
  }
}

/**
 * @brief Fungsi callback untuk pesan MQTT yang diterima.
 * Mengurai perintah kontrol irigasi dan pengaturan threshold.
 */
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Pesan diterima [");
  Serial.print(topic);
  Serial.print("] ");

  String msg;
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  // Tangani perintah kontrol irigasi
  if (String(topic) == "irigasi/kontrol") {
    msg.toUpperCase(); // Ubah pesan ke huruf besar untuk perbandingan tidak case-sensitive

    if (msg == "AUTO") { // Perintah harus persis "AUTO"
      currentMode = MODE_AUTO;
      Serial.println("Mode diatur ke AUTO");
    } else if (msg == "MANUAL ON") { // Perintah harus persis "MANUAL ON"
      currentMode = MODE_MANUAL;
      manualPumpState = true;
      Serial.println("Mode diatur ke MANUAL, pompa ON");
    } else if (msg == "MANUAL OFF") { // Perintah harus persis "MANUAL OFF"
      currentMode = MODE_MANUAL;
      manualPumpState = false;
      Serial.println("Mode diatur ke MANUAL, pompa OFF");
    } else if (msg == "MANUAL") { // Jika hanya "MANUAL" dikirim, beralih mode tanpa mengubah status pompa
      currentMode = MODE_MANUAL;
      Serial.println("Mode diatur ke MANUAL (status pompa tidak berubah)");
    } else {
      Serial.println("Perintah tidak dikenal untuk irigasi/kontrol: " + msg);
    }
  }

  // Tangani perintah pengaturan threshold
  else if (String(topic) == "irigasi/threshold") {
    int parsedThreshold = msg.toInt();
    if (parsedThreshold >= 0 && parsedThreshold <= 100) {
      soilThreshold = parsedThreshold;
      Serial.print("Threshold tanah diperbarui menjadi: ");
      Serial.println(soilThreshold);
    } else {
      Serial.println("Nilai threshold tidak valid diterima (harus 0-100): " + msg);
    }
  }
}

/**
 * @brief Menghubungkan ulang ke broker MQTT jika koneksi terputus.
 */
void reconnect_mqtt() {
  unsigned long currentMillis = millis();
  if (currentMillis - lastReconnectAttempt >= reconnectInterval) {
    lastReconnectAttempt = currentMillis;
    Serial.print("Mencoba koneksi MQTT...");
    // Buat client ID unik menggunakan MAC address ESP32
    String clientId = "ESP32Client-";
    clientId += String(WiFi.macAddress());

    if (client.connect(clientId.c_str())) {
      Serial.println("terhubung!");
      // Berlangganan topik
      client.subscribe("irigasi/kontrol");
      Serial.println("Berlangganan ke irigasi/kontrol");
      client.subscribe("irigasi/threshold");
      Serial.println("Berlangganan ke irigasi/threshold");
    } else {
      Serial.print("gagal, rc=");
      Serial.print(client.state()); // Cetak kode status koneksi MQTT
      Serial.println(" mencoba lagi...");
    }
  }
}

/**
 * @brief Mengontrol status pompa (ON/OFF) dengan relay.
 * Asumsi: Relay adalah jenis AKTIF-HIGH (HIGH=ON, LOW=OFF).
 * @param state true untuk ON, false untuk OFF.
 */
void controlPump(bool state) {
  // Tentukan output yang sesuai untuk relay AKTIF-HIGH
  // Jika 'state' TRUE (ingin ON), kirim HIGH. Jika FALSE (ingin OFF), kirim LOW.
  int relayOutput = state ? HIGH : LOW;

  // Hanya ubah status pin jika statusnya berbeda dari saat ini untuk menghindari kedipan
  if (digitalRead(RELAY_PIN) != relayOutput) {
    digitalWrite(RELAY_PIN, relayOutput);
    Serial.print("STATUS POMPA SEKARANG: ");
    Serial.println(state ? "ON" : "OFF");
  }
}

/**
 * @brief Memublikasikan data sensor ke broker MQTT dalam format JSON.
 * @param temp Suhu dalam Celsius.
 * @param soilMoisture Kelembaban tanah dalam persentase.
 * @param pumpState Status pompa saat ini.
 */
void publishSensorData(float temp, int soilMoisture, bool pumpState) {
  String payload = "{";
  payload += "\"suhu\":" + String(temp, 2) + ","; // Suhu dengan 2 angka desimal
  payload += "\"tanah\":" + String(soilMoisture) + ","; // Kelembaban tanah
  payload += "\"pompa\":\"" + String(pumpState ? "ON" : "OFF") + "\","; // Status pompa sebagai string
  payload += "\"threshold\":" + String(soilThreshold) + ","; // Threshold saat ini
  payload += "\"mode\":\""; // Mode sistem (AUTO/MANUAL)
  if (currentMode == MODE_AUTO) payload += "AUTO";
  else payload += "MANUAL";
  payload += "\"";
  payload += "}";

  Serial.print("Memublikasikan ke irigasi: ");
  Serial.println(payload);

  if (client.publish("irigasi", payload.c_str())) {
    // Serial.println("Pesan MQTT berhasil dipublikasikan."); // Nonaktifkan untuk mengurangi spam serial
  } else {
    Serial.print("Gagal memublikasikan pesan MQTT, status klien: ");
    Serial.println(client.state());
  }
}

/**
 * @brief Mengkonversi nilai analog sensor kelembaban tanah ke persentase (0-100%).
 * Menggunakan nilai kalibrasi minSoilMoistureADC dan maxSoilMoistureADC.
 * @param analogValue Nilai ADC mentah dari sensor.
 * @return Kelembaban tanah dalam persentase.
 */
int getSoilMoisturePercentage(int analogValue) {
  // Pastikan nilai analog berada dalam rentang kalibrasi yang ditentukan
  // Ini mencegah nilai di luar jangkauan kalibrasi menghasilkan persentase yang tidak masuk akal
  if (analogValue > minSoilMoistureADC) analogValue = minSoilMoistureADC; // Jika lebih kering dari kalibrasi kering, anggap 0%
  if (analogValue < maxSoilMoistureADC) analogValue = maxSoilMoistureADC; // Jika lebih basah dari kalibrasi basah, anggap 100%

  // Map nilai analog ke persentase.
  // minSoilMoistureADC (kering) harus map ke 0%
  // maxSoilMoistureADC (basah) harus map ke 100%
  // Ini akan menghasilkan:
  // - Nilai tinggi (kering) -> persentase rendah
  // - Nilai rendah (basah)  -> persentase tinggi
  return map(analogValue, minSoilMoistureADC, maxSoilMoistureADC, 0, 100);
}