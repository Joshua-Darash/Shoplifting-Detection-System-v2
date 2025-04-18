
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:5000' : ''; // Relative path in prod

// Define event payload interfaces
interface FrameEvent {
  image: string; // Base64-encoded JPEG
}

interface SnapshotEvent {
  file_path: string; // Path to saved snapshot (e.g., "Uploads/snapshot_xxx.jpg")
}

interface NotificationStatusEvent {
  email_enabled: boolean;
  sms_enabled: boolean;
  clip_capture_enabled: boolean;
  clip_duration_seconds: number;
  logging_enabled: boolean;
}

export interface AlertEvent {
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

interface SetSourceData {
  source: 'webcam' | 'upload';
  camera_id?: number;
}

interface ToggleNotificationsData {
  type: 'email' | 'sms';
  enabled: boolean;
}

interface ToggleClipCaptureData {
  enabled: boolean;
}

interface SetClipDurationData {
  duration: number;
}

interface ToggleLoggingData {
  enabled: boolean;
}

interface UpdateAlertData {
  alert_id: string;
  status: 'new' | 'processed' | 'dismissed';
  notes?: string;
}

interface LogErrorData {
  action: string;
  details: string;
}

interface SocketService {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  on: <T>(event: string, callback: (data: T) => void) => void;
  off: <T>(event: string, callback: (data: T) => void) => void;
  emit: <T>(event: string, data?: T) => void;
}

const socketService: SocketService = {
  socket: null,
  isConnected: false,

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log('Socket.IO connected to Flask backend');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        this.isConnected = false;
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        console.log('Socket.IO disconnected from Flask backend');
      });

      this.socket.connect();
    }
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  },

  on<T>(event: string, callback: (data: T) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    } else {
      console.warn(`Cannot listen to event "${event}": Socket not initialized`);
    }
  },

  off<T>(event: string, callback: (data: T) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    } else {
      console.warn(`Cannot remove listener for event "${event}": Socket not initialized`);
    }
  },

  emit<T>(event: string, data?: T) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit event "${event}": Socket not connected`);
    }
  },
};

export default socketService;
