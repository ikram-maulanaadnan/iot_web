import { Button } from "@/components/ui/button";
import { PlayCircle, StopCircle } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function TestDataButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateDataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/generate-sample-data', {});
    },
    onSuccess: () => {
      setIsGenerating(true);
      toast({
        title: "Test Data Started",
        description: "Sample sensor data is now being generated every 30 seconds",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sensor-readings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system-logs'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start test data generation",
        variant: "destructive",
      });
    },
  });

  const handleToggle = () => {
    if (!isGenerating) {
      generateDataMutation.mutate();
    } else {
      setIsGenerating(false);
      toast({
        title: "Test Data Stopped",
        description: "Sample data generation has been stopped",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={generateDataMutation.isPending}
      className="flex items-center space-x-2"
    >
      {isGenerating ? (
        <>
          <StopCircle className="w-4 h-4" />
          <span>Stop Test Data</span>
        </>
      ) : (
        <>
          <PlayCircle className="w-4 h-4" />
          <span>Start Test Data</span>
        </>
      )}
    </Button>
  );
}