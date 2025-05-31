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
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  useEffect(() => {
    if (!videoSource) {
      socketService.emit('set_source', { source: 'webcam' });
      setVideoSource('webcam');
    }

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
          description: "Failed to load video frame. Ensure webcam access is granted.",
          variant: "destructive",
        });
      };
    });

    socketService.on('snapshot', async ({ file_path }) => {
      const snapshotUrl = `http://localhost:5000${file_path}`;
      try {
        const response = await fetch(snapshotUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }
        setSnapshotDataUrl(snapshotUrl);
        setShowSnapshotPreview(true);
        toast({
          title: "Snapshot Captured",
          description: "Snapshot saved successfully.",
        });
      } catch (error) {
        console.error('Error verifying snapshot URL:', error);
        toast({
          title: "Snapshot Load Error",
          description: `Cannot access snapshot at ${snapshotUrl}. Error: ${error.message}`,
          variant: "destructive",
        });
        setShowSnapshotPreview(false);
      }
    });

    socketService.on('snapshot_error', ({ error }) => {
      toast({
        title: "Snapshot Error",
        description: error || "Failed to capture snapshot.",
        variant: "destructive",
      });
      setShowSnapshotPreview(false);
    });

    socketService.on('source_updated', ({ source, camera_id }) => {
      console.log('Source updated:', source, camera_id);
      setVideoSource(source);
      setIsVideoLoading(false);
      setIsTransitioning(false);
      toast({
        title: "Source Updated",
        description: `Video source switched to ${source}.`,
      });
    });

    socketService.on('source_error', ({ error }) => {
      console.error('Source error:', error);
      toast({
        title: "Source Error",
        description: error,
        variant: "destructive",
      });
      setVideoSource('webcam');
      setIsVideoLoading(false);
      setIsTransitioning(false);
    });

    return () => {
      socketService.disconnect();
    };
  }, [setSnapshotDataUrl, setVideoSource, videoSource]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a video file to upload.",
        variant: "destructive",
      });
      return;
    }

    console.log('Uploading file:', file.name, 'Type:', file.type, 'Size:', file.size);

    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Video file must be under 100MB.",
        variant: "destructive",
      });
      return;
    }

    setIsVideoLoading(true);
    setIsTransitioning(true);
    setShowSourceSelector(false);

    const formData = new FormData();
    formData.append('video', file);

    try {
      console.log('Sending upload request to http://localhost:5000/upload_video');
      const response = await axios.post('http://localhost:5000/upload_video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('Upload response:', response.data);
      socketService.emit('set_source', { source: 'upload' });
      toast({
        title: "Video Uploaded",
        description: response.data.message,
      });
    } catch (error) {
      console.error('Upload error:', error);
      let errorMessage = "Failed to upload video. Please try again.";
      if (error.response) {
        errorMessage = error.response.data.error || errorMessage;
        console.error('Server response:', error.response.status, error.response.data);
      } else if (error.request) {
        errorMessage = "No response from server. Check if the backend is running.";
        console.error('No server response:', error.request);
      } else {
        errorMessage = `Upload error: ${error.message}`;
      }
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
      setVideoSource('webcam');
      setShowSourceSelector(true);
    }
  };

  const handleChangeSource = (source: 'webcam' | 'upload') => {
    setIsTransitioning(true);
    setShowSourceSelector(false);
    socketService.emit('set_source', { source });
    setVideoSource(source);
    if (source === 'upload') {
      fileInputRef.current?.click();
    } else {
      setIsVideoLoading(true);
    }
  };

  const handleShowSourceSelector = () => {
    setShowSourceSelector(true);
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

  const handleSnapshotDownload = async () => {
    if (!snapshotDataUrl) return;

    try {
      const response = await fetch(snapshotDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `snapshot-${new Date().toISOString()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast({
        title: "Download Started",
        description: "The snapshot is downloading.",
      });
    } catch (error) {
      console.error('Error downloading snapshot:', error);
      toast({
        title: "Download Error",
        description: "Failed to download the snapshot. Please try again.",
        variant: "destructive",
      });
    }
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

  const handleSnapshotError = (error: React.SyntheticEvent<HTMLImageElement, Event>) => {
    toast({
      title: "Snapshot Load Error",
      description: "Failed to load snapshot image. The file may not exist or is inaccessible.",
      variant: "destructive",
    });
    setShowSnapshotPreview(false);
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

          {showSourceSelector && !isTransitioning && (
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
                {/* <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="video/*"
                  className="hidden"
                /> */}
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
                  onError={handleSnapshotError}
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

      {videoSource && !isTransitioning && !showSourceSelector && (
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
            onClick={handleShowSourceSelector}
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