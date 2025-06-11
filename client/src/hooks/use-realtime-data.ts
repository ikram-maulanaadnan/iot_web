import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from './use-websocket';
import type { SensorReading, WebSocketMessage } from '@/types/sensor-data';

export function useRealtimeData() {
  const queryClient = useQueryClient();
  const { lastMessage, isConnected } = useWebSocket('/ws');

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'sensorData':
        // Update the latest reading in the cache immediately
        queryClient.setQueryData(['/api/sensor-readings/latest'], lastMessage.data);
        
        // Invalidate all sensor reading queries to refresh charts
        queryClient.invalidateQueries({ 
          queryKey: ['/api/sensor-readings'],
          exact: false 
        });
        
        // For very recent data (last 5-30 minutes), update the cache directly
        ['5m', '15m', '30m', '1h'].forEach(timeRange => {
          queryClient.invalidateQueries({ 
            queryKey: ['/api/sensor-readings', { timeRange }] 
          });
        });
        break;

      case 'systemLogs':
        queryClient.setQueryData(['/api/system-logs'], lastMessage.data);
        break;

      case 'connectionStatus':
        queryClient.invalidateQueries({ 
          queryKey: ['/api/system-status'] 
        });
        break;
    }
  }, [lastMessage, queryClient]);

  return {
    isConnected,
    lastMessage
  };
}
