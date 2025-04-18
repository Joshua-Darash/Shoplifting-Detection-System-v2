
import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { toast } from "@/components/ui/use-toast";
import { Button } from '@/components/ui/button';
import { Camera, UploadCloud, Play, Fullscreen, PictureInPicture, ArrowDown, X, Maximize } from 'lucide-react';
import socketService from '@/services/socketService';
import axios from 'axios';

const VideoDisplay = () => {
  const {
    videoSource,
    setVideoSource,
    snapshotDataUrl,
    setSnapshotDataUrl,
    status,
    isDetectionActive,
    setDetectionActive,
  } = useApp();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSnapshotPreview, setShowSnapshotPreview] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    socketService.connect();

    socketService.on('frame', ({ image }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${image}`;
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          canvasRef.current.width = img.width;
          canvasRef.current.height = img.height;
          ctx.drawImage(img, 0, 0);
          setIsVideoLoading(false);
          setIsTransitioning(false);
        }
      };
      img.onerror = () => {
        toast({
          title: "Stream Error",
          description: "Failed to load video frame.",
          variant: "destructive",
        });
      };
    });

    socketService.on('snapshot', ({ file_path }) => {
      const snapshotUrl = `/Uploads/${file_path.split('/').pop()}`; // Adjust based on backend static serving
      setSnapshotDataUrl(snapshotUrl);
      setShowSnapshotPreview(true);
      toast({
        title: "Snapshot Captured",
        description: "Snapshot saved successfully.",
      });
    });

    return () => {
      socketService.disconnect();
    };
  }, [setSnapshotDataUrl]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['video/mp4', 'video/avi', 'video/quicktime'].includes(file.type)) {
      toast({
        title: "Invalid File",
        description: "Please upload a supported video file (.mp4, .avi, .mov).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      toast({
        title: "File Too Large",
        description: "Video file must be under 100MB.",
        variant: "destructive",
      });
      return;
    }

    setIsVideoLoading(true);
    setIsTransitioning(true);

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await axios.post('/upload_video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      socketService.emit('set_source', { source: 'upload' });
      setVideoSource('upload');
      toast({
        title: "Video Uploaded",
        description: response.data.message,
      });
    } catch (error) {
      console.error('Error uploading video:', error);
      toast({
        title: "Upload Error",
        description: "Failed to upload video. Please try again.",
        variant: "destructive",
      });
      setVideoSource(null);
    } finally {
      setIsVideoLoading(false);
      setIsTransitioning(false);
    }
  };

  const handleChangeSource = (source: 'webcam' | 'upload') => {
    setIsTransitioning(true);
    socketService.emit('set_source', { source });
    setVideoSource(source);
    if (source === 'upload') {
      fileInputRef.current?.click();
    }
  };

  const handleTakeSnapshot = () => {
    socketService.emit('capture_snapshot');
  };

  const handleFullscreen = () => {
    if (!canvasRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.error('Error exiting fullscreen:', err));
    } else {
      canvasRef.current.requestFullscreen().catch(err => {
        toast({
          title: "Fullscreen Error",
          description: "Could not enter fullscreen mode.",
          variant: "destructive",
        });
      });
    }
  };

  const handlePictureInPicture = async () => {
    if (!canvasRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        const video = document.createElement('video');
        const stream = canvasRef.current.captureStream();
        video.srcObject = stream;
        await video.play();
        await video.requestPictureInPicture();
      }
    } catch (error) {
      console.error('Error toggling picture-in-picture:', error);
      toast({
        title: "Picture-in-Picture Error",
        description: "Could not toggle picture-in-picture mode.",
        variant: "destructive",
      });
    }
  };

  const handleSnapshotDownload = () => {
    if (!snapshotDataUrl) return;
    const link = document.createElement('a');
    link.href = snapshotDataUrl;
    link.download = `snapshot-${new Date().toISOString()}.jpg`;
    link.click();
  };

  const toggleSnapshotFullscreen = () => {
    const container = document.querySelector('.snapshot-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => console.error('Error enabling fullscreen:', err));
    } else {
      document.exitFullscreen().catch(err => console.error('Error exiting fullscreen:', err));
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 bg-card rounded-lg overflow-hidden relative">
        <div className="video-container h-full w-full relative">
          <canvas
            ref={canvasRef}
            className={`h-full w-full object-contain ${status === 'alert' ? 'border-2 border-alert animate-pulse-alert' : ''}`}
          />

          {(isVideoLoading || isTransitioning) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                <p className="text-sm">Loading video...</p>
              </div>
            </div>
          )}

          {!videoSource && !isTransitioning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-4">
              <p className="text-lg text-center mb-4">Select a video source to begin monitoring</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleChangeSource('webcam')}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Use Webcam
                </Button>
                <Button
                  onClick={() => handleChangeSource('upload')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload Video
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="video/mp4,video/avi,video/quicktime"
                  className="hidden"
                />
              </div>
            </div>
          )}

          {videoSource && !isTransitioning && (
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

          {showSnapshotPreview && snapshotDataUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
              <div className="snapshot-container relative max-w-[55%] max-h-[90%]">
                <div className="absolute top-2 right-2 flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/50 hover:bg-black/70 text-white"
                    onClick={toggleSnapshotFullscreen}
                    aria-label="Toggle snapshot fullscreen"
                  >
                    <Maximize className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setShowSnapshotPreview(false)}
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
                    onClick={handleSnapshotDownload}
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

      {videoSource && !isTransitioning && (
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
            onClick={handleTakeSnapshot}
            className="flex items-center gap-2"
            disabled={!videoSource}
          >
            <Camera className="h-4 w-4" />
            Take Snapshot
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleChangeSource(videoSource === 'webcam' ? 'upload' : 'webcam')}
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
