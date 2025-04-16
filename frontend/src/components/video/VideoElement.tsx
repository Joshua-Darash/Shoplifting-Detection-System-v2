
import React, { useEffect, useState } from 'react';
import { toast } from "@/components/ui/use-toast";

interface VideoElementProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoSource: string | null;
  status: string;
  setIsVideoLoading: (loading: boolean) => void;
  handleFileUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const VideoElement: React.FC<VideoElementProps> = ({ 
  videoRef, 
  videoSource, 
  status, 
  setIsVideoLoading,
  handleFileUpload
}) => {
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const setupWebcam = async () => {
      try {
        // Clean up previous video source if any
        if (videoRef.current) {
          if (videoRef.current.srcObject) {
            const currentStream = videoRef.current.srcObject as MediaStream;
            currentStream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            videoRef.current.src = '';
          }
        }

        if (videoSource === 'webcam') {
          setIsVideoLoading(true);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play()
              .then(() => setIsVideoLoading(false))
              .catch(err => {
                console.error('Error playing webcam stream:', err);
                setIsVideoLoading(false);
              });
          }
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        setIsVideoLoading(false);
        toast({
          title: "Webcam Error",
          description: "Could not access webcam. Please check permissions.",
          variant: "destructive"
        });
      }
    };
    
    setupWebcam();
    
    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoSource, videoRef, setIsVideoLoading]);

  return (
    <video 
      ref={videoRef}
      className={`h-full w-full object-contain ${status === 'alert' ? 'border-2 border-alert animate-pulse-alert' : ''}`}
      controls={videoSource === 'upload'}
      loop={videoSource === 'upload'}
      playsInline
      onLoadedData={() => {
        console.log("Video loaded successfully");
        setIsVideoLoading(false);
      }}
    />
  );
};

export default VideoElement;
