
import React from 'react';
import { toast } from "@/components/ui/use-toast";

interface VideoLoaderProps {
  isLoading: boolean;
}

const VideoLoader: React.FC<VideoLoaderProps> = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-2">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        <p className="text-sm">Loading video...</p>
      </div>
    </div>
  );
};

export default VideoLoader;
