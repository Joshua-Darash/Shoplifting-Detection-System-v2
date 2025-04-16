
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type VideoSource = 'webcam' | 'upload' | null;

export type AlertType = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  timestamp: Date;
  type: AlertType;
  message: string;
  videoClipUrl?: string;
  isFalsePositive?: boolean;
  notes?: string;
  read?: boolean;
}

interface AppContextType {
  videoSource: VideoSource;
  setVideoSource: (source: VideoSource) => void;
  isDetectionActive: boolean;
  setDetectionActive: (active: boolean) => void;
  isEmailNotificationsEnabled: boolean;
  setSMSNotificationsEnabled: (enabled: boolean) => void;
  isSMSNotificationsEnabled: boolean;
  setEmailNotificationsEnabled: (enabled: boolean) => void;
  isClipCaptureEnabled: boolean;
  setClipCaptureEnabled: (enabled: boolean) => void;
  isAudioAlertsEnabled: boolean;
  setAudioAlertsEnabled: (enabled: boolean) => void;
  isAlertLoggingPaused: boolean;
  setAlertLoggingPaused: (paused: boolean) => void;
  clipLength: number;
  setClipLength: (length: number) => void;
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => void;
  clearAlerts: () => void;
  dismissAlert: (alertId: string) => void;
  markAlertAsFalse: (alertId: string) => void;
  addNoteToAlert: (alertId: string, note: string) => void;
  markAlertAsRead: (alertId: string) => void;
  takeSnapshot: () => void;
  snapshotDataUrl: string | null;
  status: 'offline' | 'online' | 'alert';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [videoSource, setVideoSource] = useState<VideoSource>(null);
  const [isDetectionActive, setDetectionActive] = useState(false);
  const [isEmailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [isSMSNotificationsEnabled, setSMSNotificationsEnabled] = useState(false);
  const [isClipCaptureEnabled, setClipCaptureEnabled] = useState(true);
  const [isAudioAlertsEnabled, setAudioAlertsEnabled] = useState(true);
  const [isAlertLoggingPaused, setAlertLoggingPaused] = useState(false);
  const [clipLength, setClipLength] = useState(6);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'offline' | 'online' | 'alert'>('offline');

  // Update status when detection is active or there's an alert
  useEffect(() => {
    if (!isDetectionActive) {
      setStatus('offline');
      return;
    }
    
    if (alerts.length > 0 && alerts[0].timestamp.getTime() > Date.now() - 10000) {
      setStatus('alert');
    } else {
      setStatus('online');
    }
    
    // Auto clear alert status after 10 seconds
    const timer = setTimeout(() => {
      if (status === 'alert') {
        setStatus('online');
      }
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [isDetectionActive, alerts, status]);

  const addAlert = (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => {
    // Don't add alerts if logging is paused
    if (isAlertLoggingPaused) return;
    
    const newAlert: Alert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };
    
    setAlerts(prev => [newAlert, ...prev]);
    
    // Play audio alert if enabled
    if (isAudioAlertsEnabled) {
      const audio = new Audio('/alert-sound.mp3');
      audio.play().catch(err => console.error('Error playing audio alert:', err));
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  const markAlertAsFalse = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, isFalsePositive: true }
        : alert
    ));
  };

  const addNoteToAlert = (alertId: string, note: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, notes: note }
        : alert
    ));
  };
  
  const markAlertAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId 
        ? { ...alert, read: true }
        : alert
    ));
  };

  const takeSnapshot = () => {
    const videoElement = document.querySelector('video');
    if (videoElement) {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        setSnapshotDataUrl(canvas.toDataURL('image/png'));
      }
    }
  };

  return (
    <AppContext.Provider
      value={{
        videoSource,
        setVideoSource,
        isDetectionActive,
        setDetectionActive,
        isEmailNotificationsEnabled,
        setEmailNotificationsEnabled,
        isSMSNotificationsEnabled,
        setSMSNotificationsEnabled,
        isClipCaptureEnabled,
        setClipCaptureEnabled,
        isAudioAlertsEnabled,
        setAudioAlertsEnabled,
        isAlertLoggingPaused,
        setAlertLoggingPaused,
        clipLength,
        setClipLength,
        alerts,
        addAlert,
        clearAlerts,
        dismissAlert,
        markAlertAsFalse,
        addNoteToAlert,
        markAlertAsRead,
        takeSnapshot,
        snapshotDataUrl,
        status
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
