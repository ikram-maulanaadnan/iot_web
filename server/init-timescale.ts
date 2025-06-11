import { pool } from './db';

export async function initializeTimescaleDB() {
  const client = await pool.connect();
  
  try {
    console.log("Initializing TimescaleDB...");
    
    // Create TimescaleDB extension if it doesn't exist
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
    `);
      // Convert sensor_readings table to hypertable if not already converted
    try {
      // First, check if the table is already a hypertable
      const hypertableCheck = await client.query(`
        SELECT * FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'sensor_readings';
      `);
      
      if (hypertableCheck.rows.length === 0) {
        // Drop the existing primary key constraint to allow hypertable creation
        await client.query(`
          ALTER TABLE sensor_readings DROP CONSTRAINT IF EXISTS sensor_readings_pkey;
        `);
        
        // Create the hypertable
        await client.query(`
          SELECT create_hypertable('sensor_readings', 'timestamp', if_not_exists => TRUE);
        `);
        
        // Add back a unique index that includes timestamp
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS sensor_readings_id_timestamp_idx 
          ON sensor_readings (id, timestamp);
        `);
        
        console.log("Created hypertable for sensor_readings");
      } else {
        console.log("sensor_readings is already a hypertable");
      }
    } catch (error: any) {
      console.warn("Could not create hypertable for sensor_readings:", error.message);
    }
    
    // Convert system_logs table to hypertable if not already converted
    try {
      // First, check if the table is already a hypertable
      const hypertableCheck = await client.query(`
        SELECT * FROM timescaledb_information.hypertables 
        WHERE hypertable_name = 'system_logs';
      `);
      
      if (hypertableCheck.rows.length === 0) {
        // Drop the existing primary key constraint to allow hypertable creation
        await client.query(`
          ALTER TABLE system_logs DROP CONSTRAINT IF EXISTS system_logs_pkey;
        `);
        
        // Create the hypertable
        await client.query(`
          SELECT create_hypertable('system_logs', 'timestamp', if_not_exists => TRUE);
        `);
        
        // Add back a unique index that includes timestamp
        await client.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS system_logs_id_timestamp_idx 
          ON system_logs (id, timestamp);
        `);
        
        console.log("Created hypertable for system_logs");
      } else {
        console.log("system_logs is already a hypertable");
      }
    } catch (error: any) {
      console.warn("Could not create hypertable for system_logs:", error.message);
    }
      // Create continuous aggregate for 5-minute intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_5m
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('5 minutes', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 5-minute continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("5-minute continuous aggregate already exists");
      } else {
        console.warn("Could not create 5-minute continuous aggregate:", error.message);
      }
    }

    // Create continuous aggregate for 15-minute intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_15m
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('15 minutes', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 15-minute continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("15-minute continuous aggregate already exists");
      } else {
        console.warn("Could not create 15-minute continuous aggregate:", error.message);
      }
    }

    // Create continuous aggregate for 30-minute intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_30m
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('30 minutes', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 30-minute continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("30-minute continuous aggregate already exists");
      } else {
        console.warn("Could not create 30-minute continuous aggregate:", error.message);
      }
    }

    // Create continuous aggregate for 1-hour intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_1h
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('1 hour', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 1-hour continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("1-hour continuous aggregate already exists");
      } else {
        console.warn("Could not create 1-hour continuous aggregate:", error.message);
      }
    }

    // Create continuous aggregate for 6-hour intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_6h
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('6 hours', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 6-hour continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("6-hour continuous aggregate already exists");
      } else {
        console.warn("Could not create 6-hour continuous aggregate:", error.message);
      }
    }

    // Create continuous aggregate for 12-hour intervals
    try {
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_12h
        WITH (timescaledb.continuous) AS
        SELECT 
          time_bucket('12 hours', timestamp) AS bucket,
          AVG(temperature) as avg_temperature,
          MIN(temperature) as min_temperature,
          MAX(temperature) as max_temperature,
          AVG(soil_moisture) as avg_soil_moisture,
          MIN(soil_moisture) as min_soil_moisture,
          MAX(soil_moisture) as max_soil_moisture,
          COUNT(*) as reading_count,
          bool_or(pump_status) as pump_was_active
        FROM sensor_readings
        GROUP BY bucket;
      `);
      console.log("Created 12-hour continuous aggregate");
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log("12-hour continuous aggregate already exists");
      } else {
        console.warn("Could not create 12-hour continuous aggregate:", error.message);
      }
    }
      // Add refresh policies for continuous aggregates
    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_5m',
          start_offset => INTERVAL '1 hour',
          end_offset => INTERVAL '5 minutes',
          schedule_interval => INTERVAL '5 minutes',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 5-minute aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 5-minute aggregate:", error.message);
    }

    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_15m',
          start_offset => INTERVAL '2 hours',
          end_offset => INTERVAL '15 minutes',
          schedule_interval => INTERVAL '15 minutes',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 15-minute aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 15-minute aggregate:", error.message);
    }

    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_30m',
          start_offset => INTERVAL '4 hours',
          end_offset => INTERVAL '30 minutes',
          schedule_interval => INTERVAL '30 minutes',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 30-minute aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 30-minute aggregate:", error.message);
    }

    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_1h',
          start_offset => INTERVAL '1 day',
          end_offset => INTERVAL '1 hour',
          schedule_interval => INTERVAL '1 hour',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 1-hour aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 1-hour aggregate:", error.message);
    }

    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_6h',
          start_offset => INTERVAL '2 days',
          end_offset => INTERVAL '6 hours',
          schedule_interval => INTERVAL '6 hours',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 6-hour aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 6-hour aggregate:", error.message);
    }

    try {
      await client.query(`
        SELECT add_continuous_aggregate_policy('sensor_readings_12h',
          start_offset => INTERVAL '3 days',
          end_offset => INTERVAL '12 hours',
          schedule_interval => INTERVAL '12 hours',
          if_not_exists => TRUE);
      `);
      console.log("Added refresh policy for 12-hour aggregate");
    } catch (error: any) {
      console.warn("Could not add refresh policy for 12-hour aggregate:", error.message);
    }
      // Create indexes for better query performance
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_timestamp_desc 
        ON sensor_readings (timestamp DESC);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sensor_readings_system_mode 
        ON sensor_readings (system_mode, timestamp DESC);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_system_logs_type_timestamp 
        ON system_logs (type, timestamp DESC);
      `);
      
      console.log("Created performance indexes");
    } catch (error: any) {
      console.warn("Could not create indexes:", error.message);
    }

    // Add data retention policies
    try {
      // Keep raw sensor data for 30 days
      await client.query(`
        SELECT add_retention_policy('sensor_readings', INTERVAL '30 days', if_not_exists => TRUE);
      `);
      console.log("Added retention policy for sensor_readings (30 days)");
      
      // Keep system logs for 90 days
      await client.query(`
        SELECT add_retention_policy('system_logs', INTERVAL '90 days', if_not_exists => TRUE);
      `);
      console.log("Added retention policy for system_logs (90 days)");
    } catch (error: any) {
      console.warn("Could not add retention policies:", error.message);
    }
    
    console.log("TimescaleDB initialization completed successfully!");
    
  } catch (error) {
    console.error("Error initializing TimescaleDB:", error);
    throw error;
  } finally {
    client.release();
  }
}
