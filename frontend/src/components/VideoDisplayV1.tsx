
import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '@/components/ui/button';
import { Camera, Video, UploadCloud, Play, Search, ArrowDown, Fullscreen, PictureInPicture } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

const VideoDisplay = () => {
  const { 
    videoSource, 
    setVideoSource, 
    isDetectionActive, 
    setDetectionActive, 
    takeSnapshot, 
    snapshotDataUrl,
    status
  } = useApp();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSnapshotPreview, setShowSnapshotPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  
  // Handle webcam initialization
  useEffect(() => {
    let stream: MediaStream | null = null;
    
    const setupWebcam = async () => {
      try {
        if (videoSource === 'webcam') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
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
  }, [videoSource]);
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file && videoRef.current) {
      setIsVideoLoading(true);
      
      // Clear previous video source if any
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
              setVideoSource('upload');
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
    
    // Reset file input so the same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };
  
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
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 bg-card rounded-lg overflow-hidden relative">
        <div className="video-container h-full w-full relative">
          <video 
            ref={videoRef}
            className={`h-full w-full object-contain ${status === 'alert' ? 'border-2 border-alert animate-pulse-alert' : ''}`}
            controls={videoSource === 'upload'}
            loop={videoSource === 'upload'}
            playsInline
          />
          
          {isVideoLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                <p className="text-sm">Loading video...</p>
              </div>
            </div>
          )}
          
          {videoSource && (
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
          )}
          
          {!videoSource && (
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
          )}
          
          {/* Snapshot preview */}
          {showSnapshotPreview && snapshotDataUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
              <div className="relative max-w-[90%] max-h-[90%]">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                  onClick={() => setShowSnapshotPreview(false)}
                >
                  X
                </Button>
                <img 
                  src={snapshotDataUrl} 
                  alt="Snapshot" 
                  className="max-w-full max-h-[80vh] object-contain rounded"
                />
                <div className="mt-4 flex justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = snapshotDataUrl;
                      link.download = `snapshot-${new Date().toISOString()}.png`;
                      link.click();
                    }}
                    className="flex items-center gap-2"
                  >
                    <ArrowDown className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Video controls */}
      {videoSource && (
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
            onClick={() => {
              takeSnapshot();
              setShowSnapshotPreview(true);
            }}
            className="flex items-center gap-2"
            disabled={!videoSource}
          >
            <Camera className="h-4 w-4" />
            Take Snapshot
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => {
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
            }}
            className="ml-auto"
          >
            Change Source
          </Button>
        </div>
      )}
    </div>
  );
};

export default VideoDisplay;
