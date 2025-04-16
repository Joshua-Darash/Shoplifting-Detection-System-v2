
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock, AlertTriangle, Info, Search, Trash, AlertCircle, Flag, EyeOff, Eye } from 'lucide-react';
import AlertDetails from './AlertDetails';
import { Alert } from '@/context/AppContext';

const AlertsLog = () => {
  const { alerts, clearAlerts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isHidden, setIsHidden] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Track unread alerts
  React.useEffect(() => {
    // Consider all new alerts as unread
    const newUnread = alerts.filter(alert => !alert.read).length;
    setUnreadCount(newUnread);
  }, [alerts]);
  
  const filteredAlerts = useMemo(() => {
    if (!searchTerm.trim()) return alerts;
    
    const term = searchTerm.toLowerCase();
    return alerts.filter(alert => 
      alert.message.toLowerCase().includes(term) || 
      alert.type.toLowerCase().includes(term)
    );
  }, [alerts, searchTerm]);

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-alert" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'info':
        return <Info className="h-4 w-4 text-info" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleAlertClick = (alert: Alert) => {
    // Mark alert as read when clicked
    if (!alert.read) {
      // This would typically update the alert in the context
      // For now, we'll just update the unread count in the component state
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    setSelectedAlert(alert);
  };

  const handleCloseDialog = () => {
    setSelectedAlert(null);
  };
  
  const toggleHidden = () => {
    setIsHidden(!isHidden);
  };
  
  const getAlertItemClassName = (alertType: string) => {
    let borderClass = "";
    switch (alertType) {
      case 'critical':
        borderClass = "border-l-4 border-l-alert";
        break;
      case 'warning':
        borderClass = "border-l-4 border-l-warning";
        break;
      case 'info':
        borderClass = "border-l-4 border-l-info";
        break;
      default:
        borderClass = "";
    }
    return `alert-item cursor-pointer hover:bg-muted transition-colors rounded-md p-2 ${borderClass}`;
  };

  if (isHidden) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>Alert Log</span>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-alert rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleHidden}
              className="h-8 px-2 text-muted-foreground"
            >
              <Eye className="h-4 w-4 mr-1" />
              Show
            </Button>
          </CardTitle>
          <CardDescription>Log is currently hidden</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Alert Log</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-alert rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAlerts}
              className="h-8 px-2 text-muted-foreground"
              disabled={alerts.length === 0}
            >
              <Trash className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleHidden}
              className="h-8 px-2 text-muted-foreground"
            >
              <EyeOff className="h-4 w-4 mr-1" />
              Hide
            </Button>
          </div>
        </CardTitle>
        <CardDescription>Recent detection events</CardDescription>
        
        <div className="relative mt-2">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
          {filteredAlerts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {alerts.length === 0 ? (
                <p>No alerts recorded yet.</p>
              ) : (
                <p>No matching alerts found.</p>
              )}
            </div>
          )}
          
          {filteredAlerts.map(alert => (
            <div 
              key={alert.id} 
              className={getAlertItemClassName(alert.type)}
              onClick={() => handleAlertClick(alert)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleAlertClick(alert);
                }
              }}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2">
                  {getAlertIcon(alert.type)}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{alert.message}</p>
                      {!alert.read && (
                        <span className="w-2 h-2 rounded-full bg-alert"></span>
                      )}
                      {alert.isFalsePositive && (
                        <div className="tooltip-wrapper" aria-label="False positive">
                          <Flag className="h-3 w-3 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(alert.timestamp)}
                      {alert.notes && (
                        <span className="ml-2 text-xs text-muted-foreground italic">Has notes</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {alert.videoClipUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering parent onClick
                      // Handle video clip action
                    }}
                  >
                    View Clip
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      
      <AlertDetails 
        alert={selectedAlert} 
        open={!!selectedAlert} 
        onOpenChange={handleCloseDialog}
      />
    </Card>
  );
};

export default AlertsLog;
