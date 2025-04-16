
import React from 'react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Camera, Bell, Settings, Moon, Sun, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  const { status } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  
  return (
    <header className="bg-card py-3 px-4 border-b border-border flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Camera className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">TheftWatch 360</h1>
      </div>
      
      <div className="flex items-center space-x-4">
        {/* Status Indicator */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <span className={`status-badge ${status}`}>
            {status === 'online' && 'Monitoring'}
            {status === 'offline' && 'Offline'}
            {status === 'alert' && (
              <span className="flex items-center space-x-1">
                <Bell className="h-3 w-3" />
                <span>Alert</span>
              </span>
            )}
          </span>
        </div>
        
        {/* Theme Toggle */}
        <Toggle 
          pressed={theme === 'dark'} 
          onPressedChange={toggleTheme}
          aria-label="Toggle theme"
          className="mr-2"
        >
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Toggle>
        
        {/* Settings Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onOpenSettings}
          className="flex items-center gap-1"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-sm">
              <User className="mr-2 h-4 w-4" />
              <span>{user?.name}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-sm text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
