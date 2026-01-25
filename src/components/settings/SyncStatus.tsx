import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/useAuthStore';
import { isSupabaseConfigured } from '@/services/supabase';
import { clearSyncMeta } from '@/services/sync';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { formatDistanceToNow } from 'date-fns';

export function SyncStatus() {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const {
    user,
    lastSyncTime,
    isSyncing,
    syncError,
    syncData,
    signOut,
  } = useAuthStore();

  const isConfigured = isSupabaseConfigured();
  const isLoggedIn = !!user;

  const handleSync = async () => {
    await syncData();
  };

  const handleForceSync = async () => {
    // Clear sync timestamps to force a full re-sync
    await clearSyncMeta();
    await syncData();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Not configured
  if (!isConfigured) {
    return (
      <Card variant="default">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CloudOff className="h-5 w-5 text-muted-foreground" />
            Cloud Sync
          </CardTitle>
          <CardDescription>
            Cloud sync is not configured. Add Supabase credentials to enable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To enable cloud sync, configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
            in your environment.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <Card variant="default">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Cloud Sync
          </CardTitle>
          <CardDescription>
            Sign in to backup your data to the cloud and sync across devices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <User className="h-4 w-4 mr-2" />
                Sign In or Create Account
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-0 border-0 bg-transparent shadow-none">
              <DialogHeader className="sr-only">
                <DialogTitle>Authentication</DialogTitle>
              </DialogHeader>
              <AuthScreen onClose={() => setAuthDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  // Logged in
  return (
    <Card variant="default">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            Cloud Sync
          </CardTitle>
          <div className="flex items-center gap-1">
            {isSyncing ? (
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            ) : syncError ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : lastSyncTime ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : null}
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{user.email}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Status + Actions in one row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {isSyncing ? 'Syncing...' : syncError ? syncError : lastSyncTime ? `Synced ${formatDistanceToNow(lastSyncTime, { addSuffix: true })}` : 'Not synced'}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Force sync - smaller */}
        <button
          onClick={handleForceSync}
          disabled={isSyncing}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Force full re-sync
        </button>
      </CardContent>
    </Card>
  );
}
