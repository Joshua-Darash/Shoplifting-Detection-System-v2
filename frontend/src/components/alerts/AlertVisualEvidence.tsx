
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, Video, Maximize } from 'lucide-react';

interface AlertVisualEvidenceProps {
  snapshotDataUrl: string | null;
}

const AlertVisualEvidence = ({ snapshotDataUrl }: AlertVisualEvidenceProps) => {
  const [isPlayingClip, setIsPlayingClip] = useState(false);
  
  const handlePlayClip = () => {
    setIsPlayingClip(true);
    // In a real implementation, this would play the actual video clip
    // For now, we'll just toggle the state
    setTimeout(() => setIsPlayingClip(false), 6000);
  };
  
  const handleDownloadClip = () => {
    // In a real implementation, this would download the actual video clip
    // For now, we'll just show a demo alert
    alert('Downloading clip...');
    
    // In a real implementation, you would use something like:
    // const link = document.createElement('a');
    // link.href = clipUrl;
    // link.download = `clip-${new Date().toISOString()}.mp4`;
    // link.click();
  };
  
  const toggleFullscreen = (containerSelector: string) => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen().catch(err => {
        console.error('Error attempting to exit fullscreen:', err);
      });
    }
  };
  
  return (
    <div className="flex flex-col gap-3 mt-2">
      <h4 className="text-sm font-medium">Visual Evidence</h4>
      
      {/* Snapshot */}
      <div className="border rounded-md p-3">
        <h5 className="text-xs font-medium mb-2">Snapshot</h5>
        <div className="snapshot-container aspect-video bg-black/20 rounded flex items-center justify-center overflow-hidden relative">
          {snapshotDataUrl ? (
            <>
              <img 
                src={snapshotDataUrl} 
                alt="Alert snapshot" 
                className="w-full h-full object-contain"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                onClick={() => toggleFullscreen('.snapshot-container')}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No snapshot available</p>
          )}
        </div>
      </div>
      
      {/* Clip */}
      <div className="border rounded-md p-3">
        <h5 className="text-xs font-medium mb-2">Video Clip</h5>
        <div className="video-clip-container aspect-video bg-black/20 rounded flex flex-col items-center justify-center overflow-hidden relative">
          {isPlayingClip ? (
            <div className="w-full h-full bg-black flex items-center justify-center relative">
              <p className="text-sm">Playing clip...</p>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                onClick={() => toggleFullscreen('.video-clip-container')}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 relative">
              <p className="text-xs text-muted-foreground">6-second clip available</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handlePlayClip}>
                  <Video className="h-4 w-4 mr-1" />
                  Play Clip
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadClip}>
                  <ArrowDown className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                onClick={() => toggleFullscreen('.video-clip-container')}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertVisualEvidence;
