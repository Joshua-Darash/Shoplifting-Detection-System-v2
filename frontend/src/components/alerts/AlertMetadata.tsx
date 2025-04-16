
import React from 'react';
import { Alert } from '@/context/AppContext';
import { Clock, AlertTriangle, Camera, MessageCircle, Check } from 'lucide-react';
import { format } from 'date-fns';

interface AlertMetadataProps {
  alert: Alert;
  videoSourceName: string;
}

const AlertMetadata = ({ alert, videoSourceName }: AlertMetadataProps) => {
  const getFormattedTimestamp = (date: Date) => {
    return format(date, "MMMM dd, yyyy, HH:mm:ss");
  };
  
  return (
    <div className="grid gap-4 py-2">
      {/* Timestamp */}
      <div className="flex items-start gap-2">
        <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Timestamp</p>
          <p className="text-sm text-muted-foreground">
            {getFormattedTimestamp(alert.timestamp)}
          </p>
        </div>
      </div>
      
      {/* Alert Type */}
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Alert Type</p>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            alert.type === 'critical' ? 'bg-alert/20 text-alert' :
            alert.type === 'warning' ? 'bg-warning/20 text-warning' :
            'bg-info/20 text-info'
          }`}>
            {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)}
          </div>
        </div>
      </div>
      
      {/* Source */}
      <div className="flex items-start gap-2">
        <Camera className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Video Source</p>
          <p className="text-sm text-muted-foreground">
            {videoSourceName}
          </p>
        </div>
      </div>
      
      {/* Notifications */}
      <div className="flex items-start gap-2">
        <MessageCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Notification Status</p>
          <div className="flex flex-wrap gap-2 mt-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
              <Check className="h-3 w-3" /> Email: Sent
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted">
              <Check className="h-3 w-3" /> SMS: Sent
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertMetadata;
