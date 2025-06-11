import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bot, Hand, Waves } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ControlPanelProps {
  currentMode: string;
  pumpStatus: boolean;
  onModeChange: (mode: string) => void;
}

export function ControlPanel({ currentMode, pumpStatus, onModeChange }: ControlPanelProps) {
  const [manualPumpState, setManualPumpState] = useState(false);
  const { toast } = useToast();

  const controlMutation = useMutation({
    mutationFn: async ({ mode, pumpState }: { mode: string; pumpState?: string }) => {
      await apiRequest('POST', '/api/control', { mode, pumpState });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Command sent successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send command",
        variant: "destructive",
      });
      console.error('Control error:', error);
    },
  });

  const handleModeChange = (mode: string) => {
    controlMutation.mutate({ mode });
    onModeChange(mode);
  };

  const handlePumpToggle = (checked: boolean) => {
    if (currentMode === 'manual') {
      setManualPumpState(checked);
      controlMutation.mutate({ 
        mode: 'manual', 
        pumpState: checked ? 'on' : 'off' 
      });
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          System Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode Selection */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Operation Mode
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant={currentMode === 'auto' ? 'default' : 'outline'}
              className={`py-3 px-4 text-sm font-medium transition-all ${
                currentMode === 'auto' 
                  ? 'bg-forest text-white hover:bg-forest/90' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => handleModeChange('auto')}
              disabled={controlMutation.isPending}
            >
              <Bot className="w-4 h-4 mr-2" />
              Automatic
            </Button>
            <Button
              variant={currentMode === 'manual' ? 'default' : 'outline'}
              className={`py-3 px-4 text-sm font-medium transition-all ${
                currentMode === 'manual' 
                  ? 'bg-forest text-white hover:bg-forest/90' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => handleModeChange('manual')}
              disabled={controlMutation.isPending}
            >
              <Hand className="w-4 h-4 mr-2" />
              Manual
            </Button>
          </div>
        </div>

        {/* Manual Controls */}
        <div className={`transition-all ${
          currentMode === 'manual' ? 'opacity-100' : 'opacity-50 pointer-events-none'
        }`}>
          <label className="text-sm font-medium text-gray-700 mb-3 block">
            Manual Pump Control
          </label>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Waves className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">Water Pump</span>
            </div>
            <Switch
              checked={currentMode === 'manual' ? manualPumpState : pumpStatus}
              onCheckedChange={handlePumpToggle}
              disabled={currentMode !== 'manual' || controlMutation.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
