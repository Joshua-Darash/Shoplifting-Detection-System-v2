
import React, { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { toast } from "@/components/ui/use-toast";
import VideoSourceSelector from './VideoSourceSelector';
import VideoControls from './VideoControls';
import SnapshotPreview from './SnapshotPreview';
import VideoLoader from './VideoLoader';
import VideoActions from './VideoActions';
import VideoElement from './VideoElement';

const VideoDisplay = () => {
  const { 
    videoSource, 
    setVideoSource, 
    takeSnapshot, 
    snapshotDataUrl,
    status
  } = useApp();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSnapshotPreview, setShowSnapshotPreview] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file && videoRef.current) {
      setIsVideoLoading(true);
      
      // Clean up previous video source if any
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      const videoUrl = URL.createObjectURL(file);
      videoRef.current.src = videoUrl;
      
      // Set up event handlers for video loading
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play()
            .then(() => {
              setIsVideoLoading(false);
              console.log("Video playing successfully");
            })
            .catch(err => {
              console.error('Error auto-playing uploaded video:', err);
              setIsVideoLoading(false);
              toast({
                title: "Playback Error",
                description: "Could not play the uploaded video.",
                variant: "destructive"
              });
            });
        }
      };
      
      videoRef.current.onerror = () => {
        console.error('Error loading video');
        setIsVideoLoading(false);
        toast({
          title: "Upload Error",
          description: "Could not load the video. Please try another file.",
          variant: "destructive"
        });
      };
      
      // Load the video
      videoRef.current.load();
    }
  };

  const handleChangeSource = () => {
    // Clean up current video source
    if (videoRef.current) {
      if (videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    setVideoSource(null);
  };

  const handleTakeSnapshot = () => {
    takeSnapshot();
    setShowSnapshotPreview(true);
  };
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 bg-card rounded-lg overflow-hidden relative">
        <div className="video-container h-full w-full relative">
          <VideoElement 
            videoRef={videoRef}
            videoSource={videoSource}
            status={status}
            setIsVideoLoading={setIsVideoLoading}
          />
          
          <VideoLoader isLoading={isVideoLoading} />
          
          {videoSource && <VideoActions videoRef={videoRef} />}
          
          {!videoSource && <VideoSourceSelector />}
          
          {/* Snapshot preview */}
          {showSnapshotPreview && snapshotDataUrl && (
            <SnapshotPreview 
              snapshotDataUrl={snapshotDataUrl} 
              onClose={() => setShowSnapshotPreview(false)} 
            />
          )}
        </div>
      </div>
      
      {/* Video controls */}
      {videoSource && (
        <VideoControls 
          onTakeSnapshot={handleTakeSnapshot}
          onChangeSource={handleChangeSource}
        />
      )}
    </div>
  );
};

export default VideoDisplay;
