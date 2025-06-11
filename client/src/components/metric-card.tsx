import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    color: string;
  };
  icon: React.ReactNode;
  updatedAt?: string;
  children?: React.ReactNode;
}

export function MetricCard({ 
  title, 
  value, 
  unit, 
  status, 
  icon, 
  updatedAt,
  children 
}: MetricCardProps) {
  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 ${status.color} rounded-lg flex items-center justify-center`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">{title}</h3>
              <p className="text-2xl font-bold text-gray-900">
                {value}{unit && <span className="text-lg">{unit}</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={status.variant} className={status.color}>
              {status.label}
            </Badge>
          </div>
        </div>
        
        {children}
        
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{updatedAt || 'No data'}</span>
        </div>
      </CardContent>
    </Card>
  );
}
