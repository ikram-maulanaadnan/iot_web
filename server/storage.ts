import { 
  users, 
  sensorReadings, 
  systemLogs, 
  systemSettings,
  type User, 
  type InsertUser,
  type SensorReading,
  type InsertSensorReading,
  type SystemLog,
  type InsertSystemLog,
  type SystemSetting,
  type InsertSystemSetting
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, gte, sql } from "drizzle-orm";
import bcrypt from 'bcrypt';

export interface AggregatedReading {
  timestamp: string;
  avgTemperature: number;
  minTemperature: number;
  maxTemperature: number;
  avgSoilMoisture: number;
  minSoilMoisture: number;
  maxSoilMoisture: number;
  readingCount: number;
  pumpWasActive: boolean;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserPassword(id: number, hashedPassword: string): Promise<void>;
  validateUserCredentials(username: string, password: string): Promise<User | null>;
  
  // Sensor readings
  createSensorReading(reading: InsertSensorReading): Promise<SensorReading>;
  getRecentSensorReadings(limit?: number): Promise<SensorReading[]>;
  getSensorReadingsSince(since: Date): Promise<SensorReading[]>;
  getSensorReadingsForTimeRange(timeRange: string): Promise<SensorReading[] | AggregatedReading[]>;
  getLatestSensorReading(): Promise<SensorReading | undefined>;
  
  // System logs
  createSystemLog(log: InsertSystemLog): Promise<SystemLog>;
  getRecentSystemLogs(limit?: number): Promise<SystemLog[]>;
  
  // System settings
  getSetting(key: string): Promise<SystemSetting | undefined>;
  setSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id));
  }

  async validateUserCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  async createSensorReading(reading: InsertSensorReading): Promise<SensorReading> {
    const [sensorReading] = await db
      .insert(sensorReadings)
      .values(reading)
      .returning();
    return sensorReading;
  }

  async getRecentSensorReadings(limit: number = 100): Promise<SensorReading[]> {
    return await db
      .select()
      .from(sensorReadings)
      .orderBy(desc(sensorReadings.timestamp))
      .limit(limit);
  }

  async getSensorReadingsSince(since: Date): Promise<SensorReading[]> {
    return await db
      .select()
      .from(sensorReadings)
      .where(gte(sensorReadings.timestamp, since))
      .orderBy(desc(sensorReadings.timestamp));
  }

  async getSensorReadingsForTimeRange(timeRange: string): Promise<SensorReading[] | AggregatedReading[]> {
    const client = await pool.connect();
    
    try {
      const now = new Date();
      let since: Date;
      let useAggregation = false;
      let aggregateView = '';
      
      switch (timeRange) {
        case '5m':
          since = new Date(now.getTime() - 5 * 60 * 1000);
          break;
        case '15m':
          since = new Date(now.getTime() - 15 * 60 * 1000);
          break;
        case '30m':
          since = new Date(now.getTime() - 30 * 60 * 1000);
          break;
        case '1h':
          since = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '6h':
          since = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          // For 6h, use raw data to ensure real-time updates are visible
          break;
        case '12h':
          since = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          useAggregation = true;
          aggregateView = 'sensor_readings_5m';
          break;
        case '24h':
          since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          useAggregation = true;
          aggregateView = 'sensor_readings_15m';
          break;
        case '7d':
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          useAggregation = true;
          aggregateView = 'sensor_readings_1h';
          break;
        case '30d':
          since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          useAggregation = true;
          aggregateView = 'sensor_readings_6h';
          break;
        default:
          since = new Date(now.getTime() - 60 * 60 * 1000);
      }
      
      if (useAggregation && aggregateView) {
        // Use pre-computed continuous aggregates for longer time ranges only
        try {
          const query = `
            SELECT 
              bucket as timestamp,
              avg_temperature,
              min_temperature,
              max_temperature,
              avg_soil_moisture,
              min_soil_moisture,
              max_soil_moisture,
              reading_count,
              pump_was_active
            FROM ${aggregateView}
            WHERE bucket >= $1
            ORDER BY bucket DESC
            LIMIT 1000;
          `;
          
          const result = await client.query(query, [since]);
          
          return result.rows.map(row => ({
            timestamp: row.timestamp.toISOString(),
            avgTemperature: parseFloat(row.avg_temperature),
            minTemperature: parseFloat(row.min_temperature),
            maxTemperature: parseFloat(row.max_temperature),
            avgSoilMoisture: parseFloat(row.avg_soil_moisture),
            minSoilMoisture: parseInt(row.min_soil_moisture),
            maxSoilMoisture: parseInt(row.max_soil_moisture),
            readingCount: parseInt(row.reading_count),
            pumpWasActive: row.pump_was_active
          }));
        } catch (error) {
          console.warn(`Failed to query aggregated data from ${aggregateView}, falling back to raw data:`, error);
          // Fall back to raw data if aggregated data fails
          return await this.getSensorReadingsSince(since);
        }
      } else {
        // Use raw data for shorter time ranges to ensure real-time updates
        return await this.getSensorReadingsSince(since);
      }
    } finally {
      client.release();
    }
  }

  async getLatestSensorReading(): Promise<SensorReading | undefined> {
    const [reading] = await db
      .select()
      .from(sensorReadings)
      .orderBy(desc(sensorReadings.timestamp))
      .limit(1);
    return reading || undefined;
  }

  async createSystemLog(log: InsertSystemLog): Promise<SystemLog> {
    const [systemLog] = await db
      .insert(systemLogs)
      .values(log)
      .returning();
    return systemLog;
  }

  async getRecentSystemLogs(limit: number = 50): Promise<SystemLog[]> {
    return await db
      .select()
      .from(systemLogs)
      .orderBy(desc(systemLogs.timestamp))
      .limit(limit);
  }

  async getSetting(key: string): Promise<SystemSetting | undefined> {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, key));
    return setting || undefined;
  }

  async setSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const [updatedSetting] = await db
      .insert(systemSettings)
      .values(setting)
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: setting.value,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return updatedSetting;
  }
}

export const storage = new DatabaseStorage();
