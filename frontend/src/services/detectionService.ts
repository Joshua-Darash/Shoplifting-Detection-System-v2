import socketService from './socketService';
import { AlertType, Alert } from '../context/AppContext';
import { AlertEvent } from './socketService';

// Configuration constants
const COOLDOWN_PERIOD = 60000; // 60 seconds cooldown after detection

export interface DetectionConfig {
  enableDetection: boolean;
  onDetection: (alert: Omit<Alert, 'id' | 'timestamp' | 'read'>) => void;
}

class DetectionService {
  private lastDetectionTime: number = 0;
  private config: DetectionConfig | null = null;

  // Map backend confidence to AlertType, aligned with AppContext
  private getAlertType(confidence: number): AlertType {
    if (confidence > 0.8) return 'critical';
    if (confidence > 0.5) return 'warning';
    return 'info';
  }

  // Handle incoming alert from backend
  private handleAlert = (data: AlertEvent) => {
    if (!this.config?.enableDetection) return;

    // Apply cooldown period
    const now = Date.now();
    if (now - this.lastDetectionTime < COOLDOWN_PERIOD) {
      console.log('Alert ignored due to cooldown period');
      return;
    }

    // Validate payload
    if (!data.message || typeof data.confidence !== 'number' || !['webcam', 'upload'].includes(data.source)) {
      console.error('Invalid alert payload:', data);
      socketService.emit('log_error', {
        action: 'detection_error',
        details: `Invalid alert payload: ${JSON.stringify(data)}`,
      });
      return;
    }

    const alert: Omit<Alert, 'id' | 'timestamp' | 'read'> = {
      type: this.getAlertType(data.confidence),
      message: data.message,
      source: data.source,
      confidence: data.confidence,
      status: 'new',
      camera_id: data.camera_id ?? undefined,
      notes: undefined,
      isFalsePositive: false,
    };

    this.lastDetectionTime = now;

    if (this.config?.onDetection) {
      this.config.onDetection(alert);
    }
  };

  startDetection(config: DetectionConfig): void {
    this.config = config;

    // Clean up any existing listeners to prevent duplicates
    this.stopDetection();

    if (!config.enableDetection) {
      console.log('Detection disabled');
      return;
    }

    // Ensure socketService is connected
    if (!socketService.isConnected) {
      socketService.connect();
    }

    // Listen for alert events from backend
    socketService.on<AlertEvent>('alert', this.handleAlert);
    console.log('Started detection, listening for backend alerts');
  }

  stopDetection(): void {
    // Remove alert listener
    socketService.off('alert', this.handleAlert);
    console.log('Stopped detection, removed alert listener');
  }

  updateConfig(config: Partial<DetectionConfig>): void {
    if (!this.config) return;

    this.config = { ...this.config, ...config };

    // Restart detection with new config
    this.stopDetection();
    this.startDetection(this.config);
  }
}

export default new DetectionService();