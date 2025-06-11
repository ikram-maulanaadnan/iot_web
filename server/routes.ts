import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcrypt";
import passport from "./auth";
import { requireAuth, redirectIfAuthenticated } from "./auth";
import { storage } from "./storage";
import { mqttManager } from "./mqtt";
import { insertSystemLogSchema } from "@shared/schema";
import { z } from "zod";

const commandSchema = z.object({
  mode: z.enum(["auto", "manual"]),
  pumpState: z.enum(["on", "off"]).optional(),
  moistureThreshold: z.number().min(10).max(90).optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication Routes
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || 'Authentication failed' });
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Login failed' });
        }
        return res.json({ success: true, user: { id: user.id, username: user.username } });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ error: 'Not authenticated' });
    }
  });
  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      const user = req.user as any;
      const dbUser = await storage.getUserById(user.id);
      
      if (!dbUser) {
        return res.status(404).json({ error: 'User not found' });
      }      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, dbUser.password);
      
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password in database
      await storage.updateUserPassword(user.id, hashedNewPassword);
      
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Protect all other API routes
  app.use("/api", requireAuth);

  // API Routes
  app.get("/api/sensor-readings/latest", async (req, res) => {
    try {
      const reading = await storage.getLatestSensorReading();
      res.json(reading || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch latest sensor reading" });
    }
  });

  // Get latest readings for real-time sync
  app.get("/api/sensor-readings/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const readings = await storage.getRecentSensorReadings(limit);
      res.json(readings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent sensor readings" });
    }
  });

  app.get("/api/sensor-readings", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const since = req.query.since ? new Date(req.query.since as string) : null;
      const timeRange = req.query.timeRange as string;
      
      let readings;
      
      if (timeRange) {
        // Use new time range functionality
        readings = await storage.getSensorReadingsForTimeRange(timeRange);
      } else if (since) {
        readings = await storage.getSensorReadingsSince(since);
      } else {
        readings = await storage.getRecentSensorReadings(limit);
      }
      
      res.json(readings);
    } catch (error: any) {
      console.error("Error fetching sensor readings:", error);
      res.status(500).json({ error: "Failed to fetch sensor readings", details: error.message });
    }
  });

  // Get available time ranges for chart data
  app.get("/api/time-ranges", async (req, res) => {
    try {
      const timeRanges = [
        { id: '5m', label: '5 Minutes', duration: 5 * 60 * 1000 },
        { id: '15m', label: '15 Minutes', duration: 15 * 60 * 1000 },
        { id: '30m', label: '30 Minutes', duration: 30 * 60 * 1000 },
        { id: '1h', label: '1 Hour', duration: 60 * 60 * 1000 },
        { id: '6h', label: '6 Hours', duration: 6 * 60 * 60 * 1000 },
        { id: '12h', label: '12 Hours', duration: 12 * 60 * 60 * 1000 },
        { id: '24h', label: '24 Hours', duration: 24 * 60 * 60 * 1000 },
        { id: '7d', label: '7 Days', duration: 7 * 24 * 60 * 60 * 1000 },
        { id: '30d', label: '30 Days', duration: 30 * 24 * 60 * 60 * 1000 }
      ];
      
      res.json(timeRanges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch time ranges" });
    }
  });

  app.get("/api/system-logs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getRecentSystemLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system logs" });
    }
  });

  app.get("/api/system-status", async (req, res) => {
    try {
      const mqttStatus = mqttManager.isConnected;
      const latestReading = await storage.getLatestSensorReading();
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      const sensorsActive = latestReading && latestReading.timestamp > fiveMinutesAgo;
      
      res.json({
        mqtt: mqttStatus ? "connected" : "disconnected",
        sensors: sensorsActive ? "active" : "inactive",
        database: "connected", // If we can query, DB is connected
        lastReading: latestReading?.timestamp || null
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch system status" });
    }
  });

  app.post("/api/control", async (req, res) => {
    try {
      const { mode, pumpState, moistureThreshold } = commandSchema.parse(req.body);
      
      // Send MQTT command
      mqttManager.sendCommand(mode, pumpState);
      
      // Store system setting
      await storage.setSetting({
        key: "system_mode",
        value: mode
      });

      if (mode === "manual" && pumpState) {
        await storage.setSetting({
          key: "manual_pump_state",
          value: pumpState
        });
      }

      if (moistureThreshold !== undefined) {
        await storage.setSetting({
          key: "moisture_threshold",
          value: moistureThreshold.toString()
        });
      }
      
      res.json({ success: true, mode, pumpState, moistureThreshold });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid command format", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to send command" });
      }
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      res.json(setting || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const systemMode = await storage.getSetting("system_mode");
      const manualPumpState = await storage.getSetting("manual_pump_state");
      const moistureThreshold = await storage.getSetting("moisture_threshold");
      
      res.json({
        systemMode: systemMode?.value || "auto",
        manualPumpState: manualPumpState?.value || "off",
        moistureThreshold: parseInt(moistureThreshold?.value || "45")
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Add sample data generation endpoint for testing without real ESP32
  app.post("/api/generate-sample-data", async (req, res) => {
    try {
      const { sampleDataGenerator } = await import("./sample-data");
      sampleDataGenerator.start();
      
      await storage.createSystemLog({
        type: "info",
        message: "Sample data generation started for testing"
      });
      res.json({ success: true, message: "Sample data generation started" });
    } catch (error) {
      res.status(500).json({ error: "Failed to start sample data generation" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket Server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  wss.on('connection', async (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Send initial data
    try {
      const latestReading = await storage.getLatestSensorReading();
      const recentLogs = await storage.getRecentSystemLogs(10);
      
      if (latestReading) {
        ws.send(JSON.stringify({
          type: 'sensorData',
          data: latestReading
        }));
      }

      ws.send(JSON.stringify({
        type: 'systemLogs',
        data: recentLogs
      }));

      ws.send(JSON.stringify({
        type: 'connectionStatus',
        data: {
          mqtt: mqttManager.isConnected,
          timestamp: new Date()
        }
      }));

    } catch (error) {
      console.error('Error sending initial WebSocket data:', error);
    }

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Set WebSocket server for MQTT manager
  mqttManager.setWebSocketServer(wss);

  return httpServer;
}
