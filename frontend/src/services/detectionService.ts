
import { AlertType } from '../context/AppContext';

// This is a simulated detection service for frontend demonstration
// In a real application, this would connect to a backend service with ML models

const DETECTION_INTERVAL = 3000; // Check every 3 seconds
const COOLDOWN_PERIOD = 60000; // 60 seconds cooldown after detection

export interface DetectionConfig {
  enableDetection: boolean;
  onDetection: (type: AlertType, message: string) => void;
}

class DetectionService {
  private detectionInterval: number | null = null;
  private lastDetectionTime: number = 0;
  private config: DetectionConfig | null = null;
  
  // Simulate random detections for demo purposes
  private simulateDetection(): boolean {
    // Random chance of detection (1 in 5) when interval runs
    return Math.random() < 0.2;
  }
  
  private getRandomDetectionType(): AlertType {
    const types: AlertType[] = ['critical', 'warning', 'info'];
    const weights = [0.2, 0.3, 0.5]; // 20% critical, 30% warning, 50% info
    
    const random = Math.random();
    let sum = 0;
    
    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random < sum) {
        return types[i];
      }
    }
    
    return 'info';
  }
  
  private getRandomMessage(type: AlertType): string {
    const messages = {
      critical: [
        'Potential theft detected: Item concealed',
        'Suspicious behavior: Multiple items taken quickly',
        'Possible shoplifting: Item placed in bag'
      ],
      warning: [
        'Unusual activity: Person lingering in high-value area',
        'Suspicious behavior: Frequent glances at cameras',
        'Warning: Multiple people gathering around display'
      ],
      info: [
        'Person examining items for extended period',
        'Activity detected in electronics section',
        'Motion detected near exit door'
      ]
    };
    
    const options = messages[type];
    return options[Math.floor(Math.random() * options.length)];
  }
  
  startDetection(config: DetectionConfig): void {
    this.config = config;
    
    if (this.detectionInterval) {
      this.stopDetection();
    }
    
    if (!config.enableDetection) {
      return;
    }
    
    this.detectionInterval = window.setInterval(() => {
      // Check if we're in cooldown period
      const now = Date.now();
      if (now - this.lastDetectionTime < COOLDOWN_PERIOD) {
        return;
      }
      
      if (this.simulateDetection()) {
        const type = this.getRandomDetectionType();
        const message = this.getRandomMessage(type);
        
        this.lastDetectionTime = now;
        
        if (this.config?.onDetection) {
          this.config.onDetection(type, message);
        }
      }
    }, DETECTION_INTERVAL);
  }
  
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
  }
  
  updateConfig(config: Partial<DetectionConfig>): void {
    if (!this.config) return;
    
    this.config = { ...this.config, ...config };
    
    // Restart detection with new config
    if (this.detectionInterval) {
      this.stopDetection();
      this.startDetection(this.config);
    }
  }
}

export default new DetectionService();
