import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { SensorReading } from '@/types/sensor-data';

interface EnvironmentalChartProps {
  data?: SensorReading[]; // Make data optional since we'll fetch it based on time range
  latestReading?: SensorReading | null; // Add latest reading for real-time sync
}

export function EnvironmentalChart({ data: fallbackData, latestReading }: EnvironmentalChartProps) {
  const [timeRange, setTimeRange] = useState('1h');
  const queryClient = useQueryClient();

  // Invalidate query when new data comes in via WebSocket
  useEffect(() => {
    if (latestReading) {
      // Invalidate the chart data query to refresh it immediately
      queryClient.invalidateQueries({ 
        queryKey: ['/api/sensor-readings', { timeRange }] 
      });
    }
  }, [latestReading, timeRange, queryClient]);

  // Fetch data based on selected time range
  const { data: timeRangeData, isLoading } = useQuery<SensorReading[]>({
    queryKey: ['/api/sensor-readings', { timeRange }],
    queryFn: async () => {
      const response = await fetch(`/api/sensor-readings?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sensor readings');
      }
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time feel
    staleTime: 2000, // Consider data stale after 2 seconds
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Use fetched data or fallback data
  const data = timeRangeData || fallbackData || [];

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sortedData.map(reading => {
      const timestamp = new Date(reading.timestamp);
      let timeFormat: Intl.DateTimeFormatOptions;
      
      // Adjust time format based on range
      if (['5m', '15m', '30m', '1h'].includes(timeRange)) {
        timeFormat = { hour: '2-digit', minute: '2-digit' };
      } else if (['6h', '12h', '24h'].includes(timeRange)) {
        timeFormat = { hour: '2-digit', minute: '2-digit' };
      } else {
        timeFormat = { month: 'short', day: 'numeric', hour: '2-digit' };
      }
      
      return {
        time: timestamp.toLocaleTimeString([], timeFormat),
        temperature: 'avgTemperature' in reading ? reading.avgTemperature : reading.temperature,
        soilMoisture: 'avgSoilMoisture' in reading ? reading.avgSoilMoisture : reading.soilMoisture,
        timestamp: reading.timestamp
      };
    });
  }, [data, timeRange]);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Environmental Trends
          </CardTitle>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">Last 5 Minutes</SelectItem>
              <SelectItem value="15m">Last 15 Minutes</SelectItem>
              <SelectItem value="30m">Last 30 Minutes</SelectItem>
              <SelectItem value="1h">Last 1 Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="12h">Last 12 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest"></div>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="temp"
                  orientation="left"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="moisture"
                  orientation="right"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Soil Moisture (%)', angle: 90, position: 'insideRight' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Legend />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temperature"
                  stroke="hsl(0, 84%, 60%)"
                  strokeWidth={2}
                  dot={false}
                  name="Temperature (°C)"
                />
                <Line
                  yAxisId="moisture"
                  type="monotone"
                  dataKey="soilMoisture"
                  stroke="hsl(110, 40%, 55%)"
                  strokeWidth={2}
                  dot={false}
                  name="Soil Moisture (%)"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No data available for the selected time range
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
