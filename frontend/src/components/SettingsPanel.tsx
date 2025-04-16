
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, Mail, Video, PauseCircle } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SettingsPanel = ({ open, onOpenChange }: SettingsPanelProps) => {
  const {
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
    setClipLength
  } = useApp();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detection Settings</DialogTitle>
          <DialogDescription>
            Configure alert and notification options
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="audio-alerts" className="flex flex-col">
                <span>Audio Alerts</span>
                <span className="text-xs text-muted-foreground">Play sound when detection occurs</span>
              </Label>
            </div>
            <Switch
              id="audio-alerts"
              checked={isAudioAlertsEnabled}
              onCheckedChange={setAudioAlertsEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="email-notifications" className="flex flex-col">
                <span>Email Notifications</span>
                <span className="text-xs text-muted-foreground">Send email on detection</span>
              </Label>
            </div>
            <Switch
              id="email-notifications"
              checked={isEmailNotificationsEnabled}
              onCheckedChange={setEmailNotificationsEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sms-notifications" className="flex flex-col">
                <span>SMS Notifications</span>
                <span className="text-xs text-muted-foreground">Send SMS text alerts</span>
              </Label>
            </div>
            <Switch
              id="sms-notifications"
              checked={isSMSNotificationsEnabled}
              onCheckedChange={setSMSNotificationsEnabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="clip-capture" className="flex flex-col">
                <span>Clip Capture</span>
                <span className="text-xs text-muted-foreground">Record clips on detection</span>
              </Label>
            </div>
            <Switch
              id="clip-capture"
              checked={isClipCaptureEnabled}
              onCheckedChange={setClipCaptureEnabled}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <PauseCircle className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="pause-logging" className="flex flex-col">
                <span>Pause Alert Logging</span>
                <span className="text-xs text-muted-foreground">Temporarily stop logging alerts</span>
              </Label>
            </div>
            <Switch
              id="pause-logging"
              checked={isAlertLoggingPaused}
              onCheckedChange={setAlertLoggingPaused}
            />
          </div>
          
          {/* Clip Length Adjustment */}
          <div className="pt-2">
            <div className="flex items-center space-x-2 mb-2">
              <Video className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="clip-length" className="flex flex-col">
                <span>Clip Length (seconds)</span>
                <span className="text-xs text-muted-foreground">Adjust the length of recorded clips</span>
              </Label>
              <span className="ml-auto text-sm font-medium">{clipLength}s</span>
            </div>
            <Slider
              id="clip-length"
              min={3}
              max={15}
              step={1}
              value={[clipLength]}
              onValueChange={(value) => setClipLength(value[0])}
              className="w-full"
            />
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              <p className="mb-1">System Information:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Detection Cooldown: 60 seconds</li>
                <li>Clip Length: {clipLength} seconds ({clipLength * 30} frames)</li>
                <li>Buffer Status: {isClipCaptureEnabled ? 'Active' : 'Disabled'}</li>
                <li>Alert Logging: {isAlertLoggingPaused ? 'Paused' : 'Active'}</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPanel;
