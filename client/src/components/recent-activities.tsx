import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import type { SystemLog } from "@/types/sensor-data";

interface RecentActivitiesProps {
  logs?: SystemLog[]; // Make logs optional since we'll fetch them directly
}

export function RecentActivities({ logs: fallbackLogs }: RecentActivitiesProps) {
  // Fetch logs directly with faster refresh interval
  const { data: logs } = useQuery<SystemLog[]>({
    queryKey: ['/api/system-logs'],
    queryFn: async () => {
      const response = await fetch('/api/system-logs?limit=10');
      if (!response.ok) throw new Error('Failed to fetch system logs');
      return response.json();
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time feel
    staleTime: 1000, // Consider data stale after 1 second
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Use fetched logs or fallback logs
  const systemLogs = logs || fallbackLogs || [];

  const getLogColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      case 'pump_action':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const logTime = new Date(timestamp);
    const diffMs = now.getTime() - logTime.getTime();
    
    if (diffMs < 60000) {
      return 'Just now';
    } else if (diffMs < 3600000) {
      const minutes = Math.floor(diffMs / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffMs < 86400000) {
      const hours = Math.floor(diffMs / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return logTime.toLocaleDateString();
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          Recent Activities
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {systemLogs.length > 0 ? (
            systemLogs.slice(0, 10).map((log) => (
              <div key={`${log.id}-${log.timestamp}`} className="flex items-start space-x-3">
                <div 
                  className={`w-2 h-2 ${getLogColor(log.type)} rounded-full mt-2 flex-shrink-0`}
                />
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{log.message}</p>
                  <p className="text-xs text-gray-500">
                    {formatTime(log.timestamp)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500 py-4">
              No recent activities
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
