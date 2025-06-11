export interface SensorReading {
  id: number;
  timestamp: string;
  temperature: number;
  soilMoisture: number;
  pumpStatus: boolean;
  systemMode: string;
}

export interface SystemLog {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  metadata?: string;
}

export interface SystemStatus {
  mqtt: string;
  sensors: string;
  database: string;
  lastReading: string | null;
}

export interface Alert {
  type: string;
  message: string;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: 'sensorData' | 'systemLogs' | 'connectionStatus' | 'alert';
  data: any;
}
