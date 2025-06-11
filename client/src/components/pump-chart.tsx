import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SensorReading } from '@/types/sensor-data';

interface PumpChartProps {
  data: SensorReading[];
  latestReading?: SensorReading | null;
}

export function PumpChart({ data, latestReading }: PumpChartProps) {
  const queryClient = useQueryClient();

  // Invalidate query when new data comes in via WebSocket
  useEffect(() => {
    if (latestReading) {
      // Invalidate relevant queries to refresh pump data
      queryClient.invalidateQueries({ 
        queryKey: ['/api/sensor-readings'] 
      });
    }
  }, [latestReading, queryClient]);
  const { chartData, totalRuntime } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRuntime: 0 };

    // Calculate pump runtime by hour for the last 24 hours
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const recentData = data
      .filter(reading => new Date(reading.timestamp) >= oneDayAgo)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const hourlyRuntime: { [key: string]: number } = {};
    let totalMinutes = 0;

    // Initialize hourly buckets
    for (let i = 0; i < 24; i++) {
      const hour = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      const hourKey = hour.getHours().toString().padStart(2, '0') + ':00';
      hourlyRuntime[hourKey] = 0;
    }

    // Calculate runtime based on pump status changes
    for (let i = 1; i < recentData.length; i++) {
      const current = recentData[i];
      const previous = recentData[i - 1];
      
      if (previous.pumpStatus) {
        const timeDiff = new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime();
        const minutes = Math.round(timeDiff / (1000 * 60));
        
        const hour = new Date(previous.timestamp).getHours().toString().padStart(2, '0') + ':00';
        if (hourlyRuntime[hour] !== undefined) {
          hourlyRuntime[hour] += minutes;
          totalMinutes += minutes;
        }
      }
    }

    const chartData = Object.entries(hourlyRuntime).map(([hour, runtime]) => ({
      hour,
      runtime
    }));

    return { chartData, totalRuntime: totalMinutes };
  }, [data]);

  const formatRuntime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Pump Activity
          </CardTitle>
          <div className="text-sm text-gray-500">
            Today's Runtime: <span className="font-medium text-gray-900">
              {formatRuntime(totalRuntime)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="hour" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [formatRuntime(value), 'Runtime']}
                />
                <Bar 
                  dataKey="runtime" 
                  fill="hsl(207, 90%, 54%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No pump activity data available
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
