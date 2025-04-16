
import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, UploadCloud } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toast } from "@/components/ui/use-toast";

const VideoSourceSelector = () => {
  const { setVideoSource } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;
    
    try {
      setVideoSource('upload');
      
      // Reset file input so the same file can be selected again
      if (event.target) {
        event.target.value = '';
      }
    } catch (error) {
      console.error('Error handling file upload:', error);
      toast({
        title: "Upload Error",
        description: "Could not process the video file. Please try another file.",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
      <p className="text-lg text-center mb-4">Select a video source to begin monitoring</p>
      <div className="flex gap-3">
        <Button 
          onClick={() => setVideoSource('webcam')}
          className="flex items-center gap-2"
        >
          <Camera className="h-4 w-4" />
          Use Webcam
        </Button>
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          className="flex items-center gap-2"
        >
          <UploadCloud className="h-4 w-4" />
          Upload Video
        </Button>
      </div>
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="video/*"
        className="hidden"
      />
    </div>
  );
};

export default VideoSourceSelector;
