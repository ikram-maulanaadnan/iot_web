import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Thermometer, Droplets, Database } from "lucide-react";
import type { SystemStatus } from "@/types/sensor-data";

interface SystemStatusProps {
  status: SystemStatus | null;
}

export function SystemStatusComponent({ status }: SystemStatusProps) {
  const getStatusColor = (statusValue: string) => {
    switch (statusValue) {
      case 'connected':
      case 'active':
        return 'bg-green-100 text-green-600';
      case 'disconnected':
      case 'inactive':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (statusValue: string) => {
    switch (statusValue) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      default:
        return 'Unknown';
    }
  };

  const statusItems = [
    {
      icon: <Wifi className="w-4 h-4" />,
      label: 'MQTT Connection',
      status: status?.mqtt || 'unknown'
    },
    {
      icon: <Thermometer className="w-4 h-4" />,
      label: 'Temperature Sensor',
      status: status?.sensors || 'unknown'
    },
    {
      icon: <Droplets className="w-4 h-4" />,
      label: 'Soil Sensor',
      status: status?.sensors || 'unknown'
    },
    {
      icon: <Database className="w-4 h-4" />,
      label: 'Database',
      status: status?.database || 'unknown'
    }
  ];

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {statusItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${getStatusColor(item.status)} rounded-full flex items-center justify-center`}>
                  {item.icon}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {item.label}
                </span>
              </div>
              <Badge 
                variant="outline"
                className={`text-sm font-medium ${getStatusColor(item.status)}`}
              >
                {getStatusText(item.status)}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
