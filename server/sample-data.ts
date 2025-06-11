import { storage } from "./storage";
import { mqttManager } from "./mqtt";

export class SampleDataGenerator {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("Starting sample data generator...");
    
    // Generate initial data immediately
    this.generateSampleData();
    
    // Then generate every 30 seconds
    this.intervalId = setInterval(() => {
      this.generateSampleData();
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("Sample data generator stopped");
  }

  private async generateSampleData() {
    try {
      // Get current settings
      const modeSetting = await storage.getSetting("system_mode");
      const thresholdSetting = await storage.getSetting("moisture_threshold");
      const manualPumpSetting = await storage.getSetting("manual_pump_state");
      
      const currentMode = modeSetting?.value || "auto";
      const moistureThreshold = parseInt(thresholdSetting?.value || "45");
      const manualPumpState = manualPumpSetting?.value || "off";

      // Generate realistic sensor data
      const baseTemp = 25;
      const tempVariation = (Math.random() - 0.5) * 8; // ±4°C variation
      const temperature = Math.round((baseTemp + tempVariation) * 10) / 10;

      // Soil moisture with realistic behavior
      const lastReading = await storage.getLatestSensorReading();
      let soilMoisture: number;
      
      if (lastReading) {
        // Gradual decrease in moisture over time, with some randomness
        const moistureDecrease = Math.random() * 3 + 1; // 1-4% decrease
        soilMoisture = Math.max(10, lastReading.soilMoisture - moistureDecrease);
        
        // If pump was on, increase moisture
        if (lastReading.pumpStatus) {
          soilMoisture = Math.min(80, soilMoisture + Math.random() * 8 + 5); // 5-13% increase
        }
      } else {
        soilMoisture = Math.floor(Math.random() * 40) + 30; // Initial range 30-70%
      }

      // Determine pump status based on mode
      let pumpStatus = false;
      if (currentMode === "auto") {
        pumpStatus = soilMoisture < moistureThreshold;
      } else if (currentMode === "manual") {
        pumpStatus = manualPumpState === "on";
      }

      // Create sensor reading
      const reading = await storage.createSensorReading({
        temperature,
        soilMoisture: Math.round(soilMoisture),
        pumpStatus,
        systemMode: currentMode,
      });

      console.log(`Generated sample data: T=${temperature}°C, M=${Math.round(soilMoisture)}%, P=${pumpStatus ? 'ON' : 'OFF'}, Mode=${currentMode}`);

      // Broadcast to WebSocket clients
      const wss = mqttManager.getWebSocketServer();
      if (wss) {
        const message = {
          type: "sensorData",
          data: reading
        };
        
        wss.clients.forEach((client) => {
          if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
          }
        });
      }

      // Create system logs for interesting events
      if (soilMoisture < 35) {
        await storage.createSystemLog({
          type: "warning",
          message: `Low soil moisture detected: ${Math.round(soilMoisture)}%`,
          metadata: JSON.stringify({ moistureLevel: soilMoisture })
        });
      }

      // Log pump state changes
      if (lastReading && lastReading.pumpStatus !== pumpStatus) {
        await storage.createSystemLog({
          type: "pump_action",
          message: `Pump ${pumpStatus ? 'ON' : 'OFF'} (${currentMode} mode)`,
          metadata: JSON.stringify({ 
            previousState: lastReading.pumpStatus ? "ON" : "OFF",
            newState: pumpStatus ? "ON" : "OFF",
            mode: currentMode,
            soilMoisture
          })
        });
      }

    } catch (error) {
      console.error("Error generating sample data:", error);
    }
  }
}

export const sampleDataGenerator = new SampleDataGenerator();