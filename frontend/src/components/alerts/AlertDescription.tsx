
import React from 'react';

interface AlertDescriptionProps {
  alertType: string;
  notes?: string;
}

const AlertDescription = ({ alertType, notes }: AlertDescriptionProps) => {
  return (
    <div className="bg-muted p-3 rounded-md mt-2">
      <p className="text-sm font-medium mb-1">Description</p>
      <p className="text-sm text-muted-foreground">
        Motion detected in the monitored area that matches alert criteria. 
        This event triggered a {alertType} alert based on current sensitivity settings.
      </p>
      
      {notes && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-sm font-medium mb-1">Notes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {notes}
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertDescription;
