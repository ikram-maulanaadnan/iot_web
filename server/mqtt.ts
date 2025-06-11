import mqtt from "mqtt";
import { storage } from "./storage";
import { WebSocketServer } from "ws";

export interface SensorData {
  suhu: number;
  kelembaban: number | null;
  tanah: number;
  pompa: string;
}

export interface MqttManager {
  client: mqtt.MqttClient | null;
  isConnected: boolean;
  sendCommand: (mode: string, pumpState?: string) => void;
  setWebSocketServer: (wss: WebSocketServer) => void;
  getWebSocketServer: () => WebSocketServer | null;
}

class MqttManagerImpl implements MqttManager {
  client: mqtt.MqttClient | null = null;
  isConnected: boolean = false;
  private _wss: WebSocketServer | null = null;
  
  public get wss() { return this._wss; }

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      // Connect to the same MQTT broker as the ESP32
      this.client = mqtt.connect("mqtt://emqx.arxan.app:1883", {
        clientId: `dashboard_${Math.random().toString(16).substr(2, 8)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      this.client.on("connect", async () => {
        console.log("Connected to MQTT broker");
        this.isConnected = true;
        
        // Subscribe to sensor data topic
        this.client?.subscribe("irigasi", (err) => {
          if (err) {
            console.error("Failed to subscribe to irigasi topic:", err);
          } else {
            console.log("Subscribed to irigasi topic");
          }
        });

        // Log connection to system
        const logEntry = await storage.createSystemLog({
          type: "info",
          message: "MQTT connection established",
          metadata: JSON.stringify({ broker: "emqx.arxan.app" })
        });

        // Send new log entry via WebSocket if available
        if (this._wss) {
          this.broadcastToClients({
            type: "newSystemLog",
            data: logEntry
          });
        }
      });

      this.client.on("message", async (topic, message) => {
        if (topic === "irigasi") {
          try {
            const data: SensorData = JSON.parse(message.toString());
            console.log("Received sensor data:", data);

            // Get current system mode from settings
            const modeSetting = await storage.getSetting("system_mode");
            const currentMode = modeSetting?.value || "auto";

            // Store sensor reading in database
            const reading = await storage.createSensorReading({
              temperature: data.suhu,
              soilMoisture: data.tanah,
              pumpStatus: data.pompa === "ON",
              systemMode: currentMode,
            });

            console.log("Stored sensor reading in database:", {
              id: reading.id,
              timestamp: reading.timestamp,
              temperature: reading.temperature,
              soilMoisture: reading.soilMoisture,
              pumpStatus: reading.pumpStatus
            });

            // Broadcast to WebSocket clients
            this.broadcastToClients({
              type: "sensorData",
              data: reading
            });

            // Check for alerts - use configurable threshold
            const thresholdSetting = await storage.getSetting("moisture_threshold");
            const moistureThreshold = parseInt(thresholdSetting?.value || "45");
            
            if (data.tanah < moistureThreshold) {
              const logEntry = await storage.createSystemLog({
                type: "warning",
                message: `Low soil moisture detected: ${data.tanah}% (threshold: ${moistureThreshold}%)`,
                metadata: JSON.stringify({ 
                  moistureLevel: data.tanah,
                  threshold: moistureThreshold 
                })
              });

              // Send alert via WebSocket
              this.broadcastToClients({
                type: "alert",
                data: {
                  type: "low_moisture",
                  message: `Low soil moisture detected: ${data.tanah}% (threshold: ${moistureThreshold}%)`,
                  timestamp: new Date()
                }
              });

              // Also send the new log entry individually
              this.broadcastToClients({
                type: "newSystemLog",
                data: logEntry
              });
            }

            // Log pump state changes
            const lastReading = await storage.getLatestSensorReading();
            if (!lastReading || lastReading.pumpStatus !== (data.pompa === "ON")) {
              const logEntry = await storage.createSystemLog({
                type: "pump_action",
                message: `Pump ${data.pompa}`,
                metadata: JSON.stringify({ 
                  previousState: lastReading?.pumpStatus ? "ON" : "OFF",
                  newState: data.pompa 
                })
              });

              // Send new log entry via WebSocket
              this.broadcastToClients({
                type: "newSystemLog",
                data: logEntry
              });
            }

          } catch (error) {
            console.error("Error processing sensor data:", error);
            await storage.createSystemLog({
              type: "error",
              message: "Failed to process sensor data",
              metadata: JSON.stringify({ error: (error as Error).message })
            });
          }
        }
      });

      this.client.on("error", async (err) => {
        console.error("MQTT connection error:", err);
        this.isConnected = false;
        const logEntry = await storage.createSystemLog({
          type: "error",
          message: "MQTT connection error",
          metadata: JSON.stringify({ error: err.message })
        });

        // Send new log entry via WebSocket if available
        if (this._wss) {
          this.broadcastToClients({
            type: "newSystemLog",
            data: logEntry
          });
        }
      });

      this.client.on("close", async () => {
        console.log("MQTT connection closed");
        this.isConnected = false;
        const logEntry = await storage.createSystemLog({
          type: "info",
          message: "MQTT connection closed"
        });

        // Send new log entry via WebSocket if available
        if (this._wss) {
          this.broadcastToClients({
            type: "newSystemLog",
            data: logEntry
          });
        }
      });

    } catch (error) {
      console.error("Failed to connect to MQTT broker:", error);
      this.isConnected = false;
    }
  }

  sendCommand(mode: string, pumpState?: string) {
    if (!this.client || !this.isConnected) {
      console.error("MQTT client not connected");
      return;
    }

    let command = mode.toUpperCase();
    if (mode === "manual" && pumpState) {
      command += ` ${pumpState.toUpperCase()}`;
    }

    this.client.publish("irigasi/kontrol", command, (err) => {
      if (err) {
        console.error("Failed to send MQTT command:", err);
      } else {
        console.log("Sent MQTT command:", command);
        
        // Log the command
        storage.createSystemLog({
          type: "info",
          message: `Command sent: ${command}`,
          metadata: JSON.stringify({ command, mode, pumpState })
        });
      }
    });
  }

  async sendThreshold(threshold: number) {
    if (!this.client || !this.isConnected) {
      console.error("MQTT client not connected");
      return;
    }

    const command = `THRESHOLD ${threshold}`;
    
    this.client.publish("irigasi/kontrol", command, (err) => {
      if (err) {
        console.error("Failed to send threshold command:", err);
      } else {
        console.log("Sent threshold command:", command);
        
        // Log the threshold update
        storage.createSystemLog({
          type: "info",
          message: `Moisture threshold updated: ${threshold}%`,
          metadata: JSON.stringify({ threshold, command })
        });
      }
    });
  }

  setWebSocketServer(wss: WebSocketServer) {
    this._wss = wss;
  }

  getWebSocketServer(): WebSocketServer | null {
    return this._wss;
  }

  private broadcastToClients(message: any) {
    if (!this._wss) return;

    const messageStr = JSON.stringify(message);
    this._wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(messageStr);
      }
    });
  }
}

export const mqttManager = new MqttManagerImpl();
