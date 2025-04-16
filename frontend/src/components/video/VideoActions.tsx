
import React from 'react';
import { Button } from '@/components/ui/button';
import { Fullscreen, PictureInPicture } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

interface VideoActionsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoActions: React.FC<VideoActionsProps> = ({ videoRef }) => {
  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error('Error exiting fullscreen mode:', err);
      });
    } else {
      videoRef.current.requestFullscreen().catch(err => {
        console.error('Error entering fullscreen mode:', err);
        toast({
          title: "Fullscreen Error",
          description: "Could not enter fullscreen mode.",
          variant: "destructive"
        });
      });
    }
  };
  
  const handlePictureInPicture = async () => {
    if (!videoRef.current) return;
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Error toggling picture-in-picture mode:', error);
      toast({
        title: "Picture-in-Picture Error",
        description: "Could not toggle picture-in-picture mode. This feature may not be supported in your browser.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="absolute top-2 right-2 flex gap-1">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleFullscreen}
        className="bg-black/50 hover:bg-black/70 text-white h-8 w-8"
        title="Toggle fullscreen"
      >
        <Fullscreen className="h-4 w-4" />
      </Button>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handlePictureInPicture}
        className="bg-black/50 hover:bg-black/70 text-white h-8 w-8"
        title="Toggle picture-in-picture"
      >
        <PictureInPicture className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default VideoActions;
