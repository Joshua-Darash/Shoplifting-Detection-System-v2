import React, { useState } from 'react';
import { Alert } from '@/context/AppContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { AlertTriangle, Info, Clock, Flag, Camera, MessageCircle, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import AddNoteDialog from './AddNoteDialog';

interface AlertDetailsProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDetails = ({ alert, open, onOpenChange }: AlertDetailsProps) => {
  const { snapshotDataUrl, dismissAlert, markAlertAsFalse, addNoteToAlert } = useApp();
  const { toast } = useToast();
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

  const getSourceName = (source: string) => {
    return source === 'webcam' ? 'Webcam' : 'Uploaded Video';
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
                <p className="text-sm font-medium">Source</p>
                <p className="text-sm text-muted-foreground">
                  {getSourceName(alert.source)}
                </p>
              </div>
            </div>

            {/* Camera ID */}
            {alert.camera_id && (
              <div className="flex items-start gap-2">
                <Camera className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Camera ID</p>
                  <p className="text-sm text-muted-foreground">
                    Camera {alert.camera_id}
                  </p>
                </div>
              </div>
            )}

            {/* Confidence */}
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Confidence</p>
                <p className="text-sm text-muted-foreground">
                  {(alert.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Status</p>
                <p className="text-sm text-muted-foreground">
                  {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                </p>
              </div>
            </div>

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

            {/* Video Clip */}
            {alert.clip_url && (
              <div className="border rounded-md p-3">
                <h5 className="text-xs font-medium mb-2">Video Clip</h5>
                <div className="aspect-video bg-black/20 rounded flex items-center justify-center overflow-hidden">
                  <video
                    src={alert.clip_url}
                    controls
                    className="w-full h-full object-contain"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            )}

            {/* Description and Notes */}
            <div className="bg-muted p-3 rounded-md mt-2">
              <p className="text-sm font-medium mb-1">Description</p>
              <p className="text-sm text-muted-foreground">
                Motion detected in the monitored area that matches alert criteria.
                This event triggered a {alert.type} alert with {(alert.confidence * 100).toFixed(1)}% confidence.
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