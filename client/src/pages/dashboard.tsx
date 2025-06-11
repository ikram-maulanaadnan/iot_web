import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeData } from "@/hooks/use-realtime-data";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { MetricCard } from "@/components/metric-card";
import { EnvironmentalChart } from "@/components/environmental-chart";
import { PumpChart } from "@/components/pump-chart";
import { ControlPanel } from "@/components/control-panel";
import { SystemStatusComponent } from "@/components/system-status";
import { RecentActivities } from "@/components/recent-activities";
import { SettingsPanel } from "@/components/settings-panel";
import { TestDataButton } from "@/components/test-data-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Thermometer, Droplets, Waves, Settings, Sprout, AlertTriangle, LogOut, User } from "lucide-react";
import type { SensorReading, SystemLog, SystemStatus, Alert as AlertType } from "@/types/sensor-data";

export default function Dashboard() {
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [currentMode, setCurrentMode] = useState<string>('auto');
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  const { isConnected, lastMessage } = useRealtimeData();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logout();
  };

  // Fetch initial data
  const { data: readings = [] } = useQuery<SensorReading[]>({
    queryKey: ['/api/sensor-readings'],
    refetchInterval: 5000, // Refetch every 30 seconds as backup
  });

  const { data: logs = [] } = useQuery<SystemLog[]>({
    queryKey: ['/api/system-logs'],
    refetchInterval: 5000,
  });

  const { data: status } = useQuery<SystemStatus>({
    queryKey: ['/api/system-status'],
    refetchInterval: 1000,
  });

  const { data: settings } = useQuery<{
    systemMode: string;
    manualPumpState: string;
    moistureThreshold: number;
  }>({
    queryKey: ['/api/settings'],
    refetchInterval: 5000,
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sensorData':
        setLatestReading(lastMessage.data);
        break;
      case 'systemLogs':
        setSystemLogs(lastMessage.data);
        break;
      case 'connectionStatus':
        setSystemStatus(prev => ({
          ...prev,
          mqtt: lastMessage.data.mqtt ? 'connected' : 'disconnected',
          sensors: 'active',
          database: 'connected',
          lastReading: new Date().toISOString()
        }));
        break;
      case 'alert':
        setAlerts(prev => [lastMessage.data, ...prev.slice(0, 4)]);
        break;
    }
  }, [lastMessage]);

  // Set initial data
  useEffect(() => {
    if (readings.length > 0 && !latestReading) {
      setLatestReading(readings[0]);
    }
    if (logs.length > 0 && systemLogs.length === 0) {
      setSystemLogs(logs);
    }
    if (status && !systemStatus) {
      setSystemStatus(status);
    }
    if (settings && settings.systemMode && currentMode !== settings.systemMode) {
      setCurrentMode(settings.systemMode);
    }
  }, [readings, logs, status, settings, latestReading, systemLogs, systemStatus, currentMode]);

  const getTemperatureStatus = (temp: number) => {
    if (temp > 30) return { label: 'High', variant: 'destructive' as const, color: 'bg-red-100' };
    if (temp < 15) return { label: 'Low', variant: 'outline' as const, color: 'bg-blue-100' };
    return { label: 'Normal', variant: 'default' as const, color: 'bg-green-100' };
  };

  const getMoistureStatus = (moisture: number) => {
    if (moisture < 40) return { label: 'Low', variant: 'destructive' as const, color: 'bg-red-100' };
    if (moisture < 60) return { label: 'Medium', variant: 'outline' as const, color: 'bg-yellow-100' };
    return { label: 'Good', variant: 'default' as const, color: 'bg-green-100' };
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const temperature = latestReading?.temperature || 0;
  const soilMoisture = latestReading?.soilMoisture || 0;
  const pumpStatus = latestReading?.pumpStatus || false;
  const lastUpdate = latestReading?.timestamp ? formatTime(latestReading.timestamp) : '--:--:--';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-forest rounded-lg flex items-center justify-center">
                <Sprout className="text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Smart Irrigation System</h1>
                <p className="text-sm text-gray-500">Real-time Agricultural Monitoring</p>
              </div>
            </div>            <div className="flex items-center space-x-4">
              <TestDataButton />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/profile")}
                className="flex items-center space-x-2"
              >
                <User className="w-4 h-4" />
                <span>{user?.username}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </Button>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-sm font-medium text-gray-700">
                  System {isConnected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Last Updated: <span className="font-medium">{lastUpdate}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert Banners */}
        {alerts.map((alert, index) => (
          <Alert key={index} className="mb-6 border-l-4 border-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        ))}

        {/* Real-time Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Temperature"
            value={temperature.toFixed(1)}
            unit="°C"
            status={getTemperatureStatus(temperature)}
            icon={<Thermometer className="text-red-600 text-xl" />}
            updatedAt={`Updated ${latestReading ? 'now' : 'never'}`}
          />

          <MetricCard
            title="Soil Moisture"
            value={soilMoisture}
            unit="%"
            status={getMoistureStatus(soilMoisture)}
            icon={<Droplets className="text-earth text-xl" />}
            updatedAt={`Updated ${latestReading ? 'now' : 'never'}`}
          >
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${soilMoisture}%` }}
              />
            </div>
          </MetricCard>

          <MetricCard
            title="Water Pump"
            value={pumpStatus ? 'ON' : 'OFF'}
            status={{
              label: pumpStatus ? 'Active' : 'Inactive',
              variant: pumpStatus ? 'default' : 'outline',
              color: pumpStatus ? 'bg-green-100' : 'bg-gray-100'
            }}
            icon={<Waves className="text-blue-600 text-xl" />}
            updatedAt={`Updated ${latestReading ? 'now' : 'never'}`}
          >
            <div className={`w-6 h-6 ${pumpStatus ? 'bg-green-500 animate-pulse' : 'bg-gray-400'} rounded-full flex items-center justify-center`}>
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          </MetricCard>

          <MetricCard
            title="System Mode"
            value={currentMode.toUpperCase()}
            status={{
              label: 'Active',
              variant: 'default',
              color: 'bg-forest bg-opacity-10'
            }}
            icon={<Settings className="text-forest text-xl" />}
            updatedAt="Real-time"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Charts Section */}
          <div className="lg:col-span-2 space-y-8">
            <EnvironmentalChart data={readings} latestReading={latestReading} />
            <PumpChart data={readings} latestReading={latestReading} />
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            <ControlPanel
              currentMode={currentMode}
              pumpStatus={pumpStatus}
              onModeChange={setCurrentMode}
            />
            <SystemStatusComponent status={systemStatus} />
            <RecentActivities logs={systemLogs} />
          </div>
        </div>

        {/* Settings Panel */}
        <SettingsPanel 
          settings={settings}
          isVisible={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </main>
    </div>
  );
}
