
import React from 'react';
import { Alert } from '@/context/AppContext';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface AlertHeaderProps {
  alert: Alert;
}

const AlertHeader = ({ alert }: AlertHeaderProps) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-alert" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'info':
        return <Info className="h-5 w-5 text-info" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };
  
  return (
    <>
      <DialogTitle className="flex items-center gap-2">
        {getAlertIcon(alert.type)}
        <span>Alert Details</span>
        {alert.isFalsePositive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground ml-2">
            False Positive
          </span>
        )}
      </DialogTitle>
      <DialogDescription className="text-base font-medium">
        {alert.message}
      </DialogDescription>
    </>
  );
};

export default AlertHeader;
