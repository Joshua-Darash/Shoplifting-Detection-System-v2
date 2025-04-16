
import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Camera } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface VideoControlsProps {
  onTakeSnapshot: () => void;
  onChangeSource: () => void;
}

const VideoControls = ({ onTakeSnapshot, onChangeSource }: VideoControlsProps) => {
  const { isDetectionActive, setDetectionActive, videoSource } = useApp();
  
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        variant={isDetectionActive ? "destructive" : "default"}
        onClick={() => setDetectionActive(!isDetectionActive)}
        className="flex items-center gap-2"
      >
        {isDetectionActive ? "Stop Monitoring" : (
          <>
            <Play className="h-4 w-4" />
            Start Monitoring
          </>
        )}
      </Button>
      
      <Button
        variant="outline"
        onClick={onTakeSnapshot}
        className="flex items-center gap-2"
        disabled={!videoSource}
      >
        <Camera className="h-4 w-4" />
        Take Snapshot
      </Button>
      
      <Button
        variant="secondary"
        onClick={onChangeSource}
        className="ml-auto"
      >
        Change Source
      </Button>
    </div>
  );
};

export default VideoControls;
