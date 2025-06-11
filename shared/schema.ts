import { pgTable, text, serial, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const sensorReadings = pgTable("sensor_readings", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  temperature: real("temperature").notNull(),
  soilMoisture: integer("soil_moisture").notNull(),
  pumpStatus: boolean("pump_status").notNull(),
  systemMode: text("system_mode").notNull(),
});

export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'pump_action'
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON string for additional data
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sensorReadingsRelations = relations(sensorReadings, ({ many }) => ({
  logs: many(systemLogs),
}));

export const insertSensorReadingSchema = createInsertSchema(sensorReadings).omit({
  id: true,
  timestamp: true,
});

export const insertSystemLogSchema = createInsertSchema(systemLogs).omit({
  id: true,
  timestamp: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type SensorReading = typeof sensorReadings.$inferSelect;
export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;

export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
