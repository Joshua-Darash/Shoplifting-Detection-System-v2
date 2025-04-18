import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from '@/context/AppContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Header from '@/components/Header';
import VideoDisplay from '@/components/VideoDisplay';
import SettingsPanel from '@/components/SettingsPanel';
import AlertsLog from '@/components/AlertsLog';
import detectionService from '@/services/detectionService';
import socketService from '@/services/socketService';

// Main App component that uses the context
const AppContent = () => {
  const {
    isDetectionActive,
    addAlert,
    videoSource,
  } = useApp();

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Setup detection service
  useEffect(() => {
    if (videoSource && ['webcam', 'upload'].includes(videoSource)) {
      detectionService.startDetection({
        enableDetection: isDetectionActive,
        onDetection: (alert) => {
          addAlert(alert);
        },
      });
    } else {
      detectionService.stopDetection();
    }

    return () => {
      detectionService.stopDetection();
    };
  }, [isDetectionActive, videoSource]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header onOpenSettings={() => setSettingsOpen(true)} />

      <main className="flex-1 container max-w-7xl mx-auto py-6 px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main video area - takes up 2/3 on large screens */}
          <div className="lg:col-span-2 flex flex-col h-[60vh] lg:h-[70vh]">
            <VideoDisplay />
          </div>

          {/* Sidebar area - takes up 1/3 on large screens */}
          <div className="space-y-6 h-full">
            <AlertsLog />
          </div>
        </div>
      </main>

      {/* Settings Panel as a Dialog */}
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />

      <footer className="py-4 px-6 border-t border-border">
        <div className="container max-w-7xl mx-auto text-sm text-muted-foreground text-center">
          TheftWatch 360 — Shoplifting Detection System
        </div>
      </footer>
    </div>
  );
};

// Wrapper component that provides the context
const Index = () => {
  return (
    <AppProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AppProvider>
  );
};

export default Index;