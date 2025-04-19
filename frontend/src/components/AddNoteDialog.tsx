import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface AddNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingNote?: string;
  onSaveNote: (note: string) => void;
}

const AddNoteDialog = ({ open, onOpenChange, existingNote = '', onSaveNote }: AddNoteDialogProps) => {
  const [note, setNote] = useState(existingNote);
  const { toast } = useToast();
  const maxLength = 500;

  const handleSave = () => {
    if (!note.trim()) {
      toast({
        title: "Empty Note",
        description: "Please enter a note before saving.",
        variant: "destructive"
      });
      return;
    }
    if (note.length > maxLength) {
      toast({
        title: "Note Too Long",
        description: `Note must be ${maxLength} characters or less.`,
        variant: "destructive"
      });
      return;
    }
    onSaveNote(note.trim());
    toast({
      title: "Note Saved",
      description: "Your note has been added to the alert.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Note to Alert</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <Textarea
            placeholder="Enter your notes about this alert..."
            className="min-h-[150px] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={maxLength}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {note.length}/{maxLength} characters
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddNoteDialog;