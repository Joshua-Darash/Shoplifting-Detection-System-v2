
import React, { useState } from 'react';
import { Alert } from '@/context/AppContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flag, MessageCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import AddNoteDialog from '@/components/AddNoteDialog';
import AlertHeader from './AlertHeader';
import AlertMetadata from './AlertMetadata';
import AlertVisualEvidence from './AlertVisualEvidence';
import AlertDescription from './AlertDescription';

interface AlertDetailsProps {
  alert: Alert | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDetails = ({ alert, open, onOpenChange }: AlertDetailsProps) => {
  const { snapshotDataUrl, videoSource, dismissAlert, markAlertAsFalse, addNoteToAlert } = useApp();
  const { toast } = useToast();
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  
  if (!alert) return null;
  
  const getVideoSourceName = () => {
    if (videoSource === 'webcam') return 'Webcam 1';
    if (videoSource === 'upload') return 'Uploaded File';
    return 'Unknown Source';
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
            <AlertHeader alert={alert} />
          </DialogHeader>
          
          <AlertMetadata alert={alert} videoSourceName={getVideoSourceName()} />
          
          <AlertVisualEvidence snapshotDataUrl={snapshotDataUrl} />
          
          <AlertDescription alertType={alert.type} notes={alert.notes} />
          
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
