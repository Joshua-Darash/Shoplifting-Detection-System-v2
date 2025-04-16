
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, X, Maximize } from 'lucide-react';

interface SnapshotPreviewProps {
  snapshotDataUrl: string;
  onClose: () => void;
}

const SnapshotPreview = ({ snapshotDataUrl, onClose }: SnapshotPreviewProps) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = snapshotDataUrl;
    link.download = `snapshot-${new Date().toISOString()}.png`;
    link.click();
  };
  
  const toggleFullscreen = () => {
    const container = document.querySelector('.snapshot-container');
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
      <div className="snapshot-container relative max-w-[90%] max-h-[90%]">
        <div className="absolute top-2 right-2 flex gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={toggleFullscreen}
          >
            <Maximize className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="bg-black/50 hover:bg-black/70 text-white"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <img 
          src={snapshotDataUrl} 
          alt="Snapshot" 
          className="max-w-full max-h-[80vh] object-contain rounded"
        />
        <div className="mt-4 flex justify-center">
          <Button 
            variant="outline" 
            onClick={handleDownload}
            className="flex items-center gap-2"
          >
            <ArrowDown className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SnapshotPreview;
