import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SettingsPanelProps {
  settings: any;
  isVisible: boolean;
  onClose: () => void;
}

export function SettingsPanel({ settings, isVisible, onClose }: SettingsPanelProps) {
  const [moistureThreshold, setMoistureThreshold] = useState(45);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settingsMutation = useMutation({
    mutationFn: async (threshold: number) => {
      await apiRequest('POST', '/api/control', { 
        mode: 'auto',
        moistureThreshold: threshold 
      });
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Moisture threshold has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (settings?.moistureThreshold) {
      setMoistureThreshold(settings.moistureThreshold);
    }
  }, [settings]);

  const handleSave = () => {
    if (moistureThreshold >= 10 && moistureThreshold <= 90) {
      settingsMutation.mutate(moistureThreshold);
    } else {
      toast({
        title: "Invalid Value",
        description: "Moisture threshold must be between 10% and 90%",
        variant: "destructive",
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              System Settings
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="threshold" className="text-sm font-medium text-gray-700">
              Automatic Irrigation Threshold
            </Label>
            <p className="text-xs text-gray-500 mb-3">
              Pump will activate when soil moisture drops below this level
            </p>
            <div className="flex items-center space-x-3">
              <Input
                id="threshold"
                type="number"
                min="10"
                max="90"
                value={moistureThreshold}
                onChange={(e) => setMoistureThreshold(parseInt(e.target.value) || 45)}
                className="flex-1"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-gray-600">
            <h4 className="font-medium mb-2">Current Mode Behavior:</h4>
            <ul className="space-y-1 text-xs">
              <li>• <strong>Automatic:</strong> Pump activates when moisture &lt; {moistureThreshold}%</li>
              <li>• <strong>Manual:</strong> Complete user control over pump operation</li>
            </ul>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={settingsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={settingsMutation.isPending}
              className="bg-forest hover:bg-forest/90"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}