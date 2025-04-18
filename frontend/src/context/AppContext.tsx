
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import socketService from '@/services/socketService';
import { toast } from '@/components/ui/use-toast';

// Interfaces from socketService.ts
interface NotificationStatusEvent {
  email_enabled: boolean;
  sms_enabled: boolean;
  clip_capture_enabled: boolean;
  clip_duration_seconds: number;
  logging_enabled: boolean;
}

interface AlertEvent {
  message: string;
  confidence: number;
  source: 'webcam' | 'upload';
  camera_id?: number | null;
}

interface AlertLogEntry {
  alert_id: number;
  timestamp: string;
  details: string;
  source: 'webcam' | 'upload';
  confidence: number;
  camera_id?: number | null;
}

type VideoSource = 'webcam' | 'upload' | null;
export type AlertType = 'critical' | 'warning' | 'info';
export type AlertStatus = 'new' | 'processed' | 'dismissed';

export interface Alert {
  id: string;
  timestamp: Date;
  type: AlertType;
  message: string;
  source: 'webcam' | 'upload';
  confidence: number;
  status: AlertStatus;
  camera_id?: number | null;
  notes?: string;
  isFalsePositive?: boolean;
  read?: boolean;
}

interface AppContextType {
  videoSource: VideoSource;
  setVideoSource: (source: VideoSource) => void;
  isDetectionActive: boolean;
  setDetectionActive: (active: boolean) => void;
  isEmailNotificationsEnabled: boolean;
  setEmailNotificationsEnabled: (enabled: boolean) => void;
  isSMSNotificationsEnabled: boolean;
  setSMSNotificationsEnabled: (enabled: boolean) => void;
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
  snapshotDataUrl: string | null;
  setSnapshotDataUrl: (url: string | null) => void;
  status: 'offline' | 'online' | 'alert';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [videoSource, setVideoSource] = useState<VideoSource>(null);
  const [isDetectionActive, setDetectionActive] = useState(false);
  const [isEmailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [isSMSNotificationsEnabled, setSMSNotificationsEnabled] = useState(false);
  const [isClipCaptureEnabled, setClipCaptureEnabled] = useState(false);
  const [isAudioAlertsEnabled, setAudioAlertsEnabled] = useState(true);
  const [isAlertLoggingPaused, setAlertLoggingPaused] = useState(false);
  const [clipLength, setClipLength] = useState(6);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'offline' | 'online' | 'alert'>('offline');

  // Helper function to determine AlertType based on confidence
  const getAlertType = (confidence: number): AlertType => {
    if (confidence > 0.8) return 'critical';
    if (confidence > 0.5) return 'warning';
    return 'info';
  };

  // Initialize settings and alerts from backend
  useEffect(() => {
    socketService.connect();

    socketService.on<NotificationStatusEvent>('notification_status', (data) => {
      setEmailNotificationsEnabled(data.email_enabled);
      setSMSNotificationsEnabled(data.sms_enabled);
      setClipCaptureEnabled(data.clip_capture_enabled);
      setClipLength(data.clip_duration_seconds);
      setAlertLoggingPaused(!data.logging_enabled); // Inverse logic
    });

    socketService.on<AlertEvent>('alert', ({ message, confidence, source, camera_id }) => {
      if (isAlertLoggingPaused) return;
      const newAlert: Alert = {
        id: Date.now().toString(),
        timestamp: new Date(),
        type: getAlertType(confidence),
        message,
        source,
        confidence,
        status: 'new',
        camera_id,
        read: false,
        notes: undefined,
        isFalsePositive: false,
      };
      setAlerts((prev) => [newAlert, ...prev]);
      if (isAudioAlertsEnabled) {
        const audio = new Audio('/alert-sound.mp3');
        audio.play().catch((err) => console.error('Error playing audio alert:', err));
      }
    });

    socketService.on<AlertLogEntry[]>('alert_logs', (logs) => {
      if (isAlertLoggingPaused) return;
      if (!Array.isArray(logs)) {
        console.warn('Received invalid alert_logs data:', logs);
        return;
      }
      const newAlerts: Alert[] = logs.map((log) => ({
        id: log.alert_id.toString(),
        timestamp: new Date(log.timestamp),
        type: getAlertType(log.confidence),
        message: log.details,
        source: log.source || (videoSource ?? 'webcam'),
        confidence: log.confidence,
        status: 'new',
        camera_id: log.camera_id ?? undefined,
        read: false,
        notes: undefined,
        isFalsePositive: false,
      }));
      setAlerts((prev) => [...newAlerts, ...prev]);
    });

    return () => {
      socketService.disconnect();
    };
  }, [isAlertLoggingPaused, isAudioAlertsEnabled, videoSource]);

  // Update status based on detection and alerts
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

    const timer = setTimeout(() => {
      if (status === 'alert') {
        setStatus('online');
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [isDetectionActive, alerts, status]);

  // Sync settings changes with backend
  useEffect(() => {
    socketService.emit('toggle_notifications', {
      type: 'email',
      enabled: isEmailNotificationsEnabled,
    });
  }, [isEmailNotificationsEnabled]);

  useEffect(() => {
    socketService.emit('toggle_notifications', {
      type: 'sms',
      enabled: isSMSNotificationsEnabled,
    });
  }, [isSMSNotificationsEnabled]);

  useEffect(() => {
    socketService.emit('toggle_clip_capture', { enabled: isClipCaptureEnabled });
  }, [isClipCaptureEnabled]);

  useEffect(() => {
    socketService.emit('set_clip_duration', { duration: clipLength });
  }, [clipLength]);

  useEffect(() => {
    socketService.emit('toggle_logging', { enabled: !isAlertLoggingPaused });
  }, [isAlertLoggingPaused]);

  const addAlert = (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => {
    if (isAlertLoggingPaused) return;

    const newAlert: Alert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    setAlerts((prev) => [newAlert, ...prev]);

    if (isAudioAlertsEnabled) {
      const audio = new Audio('/alert-sound.mp3');
      audio.play().catch((err) => console.error('Error playing audio alert:', err));
    }
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    socketService.emit('update_alert', { alert_id: alertId, status: 'dismissed' });
  };

  const markAlertAsFalse = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === alertId ? { ...alert, isFalsePositive: true, status: 'processed' } : alert
      )
    );
    socketService.emit('update_alert', {
      alert_id: alertId,
      status: 'processed',
      notes: 'Marked as false positive',
    });
  };

  const addNoteToAlert = (alertId: string, note: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, notes: note } : alert))
    );
    socketService.emit('update_alert', { alert_id: alertId, status: 'processed', notes: note });
  };

  const markAlertAsRead = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert))
    );
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
        snapshotDataUrl,
        setSnapshotDataUrl,
        status,
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
