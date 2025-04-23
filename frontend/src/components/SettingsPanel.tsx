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
import { Bell, Mail, Video, PauseCircle, Clock } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

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
    setClipLength,
    cooldownSeconds,
    setCooldownSeconds
  } = useApp();
  const { toast } = useToast();

  const handleClipLengthChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue < 1 || newValue > 1800) {
      toast({
        title: "Invalid Clip Length",
        description: "Clip length must be between 1 and 1800 seconds.",
        variant: "destructive"
      });
      return;
    }
    setClipLength(newValue);
    toast({
      title: "Clip Length Updated",
      description: `Clip length set to ${newValue} seconds.`
    });
  };

  const handleCooldownChange = (value: number[]) => {
    const newValue = value[0];
    if (newValue < 0 || newValue > 300) {
      toast({
        title: "Invalid Cooldown",
        description: "Cooldown must be between 0 and 300 seconds.",
        variant: "destructive"
      });
      return;
    }
    setCooldownSeconds(newValue);
    toast({
      title: "Cooldown Updated",
      description: `Detection cooldown set to ${newValue} seconds.`
    });
  };

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
              onCheckedChange={(checked) => {
                setAudioAlertsEnabled(checked);
                toast({
                  title: "Audio Alerts Updated",
                  description: `Audio alerts ${checked ? 'enabled' : 'disabled'}.`
                });
              }}
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
              onCheckedChange={(checked) => {
                setEmailNotificationsEnabled(checked);
                toast({
                  title: "Email Notifications Updated",
                  description: `Email notifications ${checked ? 'enabled' : 'disabled'}.`
                });
              }}
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
              onCheckedChange={(checked) => {
                setSMSNotificationsEnabled(checked);
                toast({
                  title: "SMS Notifications Updated",
                  description: `SMS notifications ${checked ? 'enabled' : 'disabled'}.`
                });
              }}
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
              onCheckedChange={(checked) => {
                setClipCaptureEnabled(checked);
                toast({
                  title: "Clip Capture Updated",
                  description: `Clip capture ${checked ? 'enabled' : 'disabled'}.`
                });
              }}
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
              onCheckedChange={(checked) => {
                setAlertLoggingPaused(checked);
                toast({
                  title: "Alert Logging Updated",
                  description: `Alert logging ${checked ? 'paused' : 'resumed'}.`
                });
              }}
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
              min={1}
              max={30}
              step={1}
              value={[clipLength]}
              onValueChange={handleClipLengthChange}
              className="w-full"
            />
          </div>

          {/* Cooldown Adjustment */}
          <div className="pt-2">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="cooldown" className="flex flex-col">
                <span>Detection Cooldown (seconds)</span>
                <span className="text-xs text-muted-foreground">Time between detection events</span>
              </Label>
              <span className="ml-auto text-sm font-medium">{cooldownSeconds}s</span>
            </div>
            <Slider
              id="cooldown"
              min={0}
              max={300}
              step={5}
              value={[cooldownSeconds]}
              onValueChange={handleCooldownChange}
              className="w-full"
            />
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="text-sm text-muted-foreground">
              <p className="mb-1">System Information:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Detection Cooldown: {cooldownSeconds} seconds</li>
                <li>Clip Capture: {isClipCaptureEnabled ? 'Enabled' : 'Disabled'}</li>
                <li>Clip Length: {clipLength} seconds</li>
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