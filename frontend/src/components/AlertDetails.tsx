
import React, { useState } from 'react';
import { Alert } from '@/context/AppContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AlertTriangle, Info, Clock, Camera, Video, ArrowDown, Flag, Check, MessageCircle, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import AddNoteDialog from './AddNoteDialog';

interface AlertDetailsProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDetails = ({ alert, open, onOpenChange }: AlertDetailsProps) => {
  const { snapshotDataUrl, videoSource, dismissAlert, markAlertAsFalse, addNoteToAlert } = useApp();
  const { toast } = useToast();
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  
  if (!alert) return null;
  
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
  
  const getFormattedTimestamp = (date: Date) => {
    return format(date, "MMMM dd, yyyy, HH:mm:ss");
  };
  
  const getVideoSourceName = () => {
    if (videoSource === 'webcam') return 'Webcam 1';
    if (videoSource === 'upload') return 'Uploaded File';
    return 'Unknown Source';
  };
  
  const handlePlayClip = () => {
    setIsPlayingClip(true);
    // In a real implementation, this would play the actual video clip
    // For now, we'll just toggle the state
    setTimeout(() => setIsPlayingClip(false), 6000);
  };
  
  const handleDismissAlert = () => {
    dismissAlert(alert.id);
    toast({
      title: "Alert Dismissed",
      description: "The alert has been removed from the log."
    });
    onOpenChange(false);
  };
  
  const handleMarkAsFalse = () => {
    markAlertAsFalse(alert.id);
    toast({
      title: "Alert Marked as False",
      description: "This alert has been marked as a false positive."
    });
    onOpenChange(false);
  };
  
  const handleAddNote = () => {
    setIsAddNoteOpen(true);
  };
  
  const handleSaveNote = (note: string) => {
    addNoteToAlert(alert.id, note);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
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
        </DialogHeader>
        
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
                {getVideoSourceName()}
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
          
          {/* Visual evidence */}
          <div className="flex flex-col gap-3 mt-2">
            <h4 className="text-sm font-medium">Visual Evidence</h4>
            
            {/* Snapshot */}
            <div className="border rounded-md p-3">
              <h5 className="text-xs font-medium mb-2">Snapshot</h5>
              <div className="aspect-video bg-black/20 rounded flex items-center justify-center overflow-hidden">
                {snapshotDataUrl ? (
                  <img 
                    src={snapshotDataUrl} 
                    alt="Alert snapshot" 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">No snapshot available</p>
                )}
              </div>
            </div>
            
            {/* Clip */}
            <div className="border rounded-md p-3">
              <h5 className="text-xs font-medium mb-2">Video Clip</h5>
              <div className="aspect-video bg-black/20 rounded flex flex-col items-center justify-center overflow-hidden">
                {isPlayingClip ? (
                  <div className="w-full h-full bg-black flex items-center justify-center">
                    <p className="text-sm">Playing clip...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <p className="text-xs text-muted-foreground">6-second clip available</p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handlePlayClip}>
                        <Video className="h-4 w-4 mr-1" />
                        Play Clip
                      </Button>
                      <Button variant="outline" size="sm">
                        <ArrowDown className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Description and Notes */}
          <div className="bg-muted p-3 rounded-md mt-2">
            <p className="text-sm font-medium mb-1">Description</p>
            <p className="text-sm text-muted-foreground">
              Motion detected in the monitored area that matches alert criteria. 
              This event triggered a {alert.type} alert based on current sensitivity settings.
            </p>
            
            {alert.notes && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {alert.notes}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex flex-wrap gap-2 mt-4">
          <Button variant="outline" onClick={handleDismissAlert}>
            Dismiss Alert
          </Button>
          <Button 
            variant="outline" 
            onClick={handleMarkAsFalse}
            disabled={alert.isFalsePositive}
          >
            <Flag className="h-4 w-4 mr-1" />
            {alert.isFalsePositive ? 'Marked as False' : 'Mark as False'}
          </Button>
          <Button onClick={handleAddNote}>
            <MessageCircle className="h-4 w-4 mr-1" />
            {alert.notes ? 'Edit Note' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    <AddNoteDialog 
      open={isAddNoteOpen}
      onOpenChange={setIsAddNoteOpen}
      existingNote={alert.notes || ''}
      onSaveNote={handleSaveNote}
    />
    </>
  );
};

export default AlertDetails;
