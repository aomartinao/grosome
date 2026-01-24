import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Trash2, Key, ChevronDown, ChevronUp } from 'lucide-react';
import { version } from '../../package.json';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SyncStatus } from '@/components/settings/SyncStatus';
import { useSettings } from '@/hooks/useProteinData';
import { useStore } from '@/store/useStore';
import { db } from '@/db';
import { cn } from '@/lib/utils';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { clearMessages } = useStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyExpanded, setApiKeyExpanded] = useState(!settings.claudeApiKey);
  const [apiKey, setApiKey] = useState(settings.claudeApiKey || '');

  // Default protein tracking to true if not set
  const proteinTrackingEnabled = settings.proteinTrackingEnabled !== false;

  const handleSaveApiKey = async () => {
    await updateSettings({ claudeApiKey: apiKey || undefined });
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
      await db.foodEntries.clear();
      await db.dailyGoals.clear();
      await db.syncMeta.clear(); // Clear sync metadata so next sync pulls everything
      clearMessages();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Cloud Sync */}
      <SyncStatus />

      {/* API Key Settings - Collapsible */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setApiKeyExpanded(!apiKeyExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Claude API Key</CardTitle>
              {settings.claudeApiKey && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Configured
                </span>
              )}
            </div>
            {apiKeyExpanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {!apiKeyExpanded && !settings.claudeApiKey && (
            <CardDescription className="mt-1">
              Click to configure your API key
            </CardDescription>
          )}
        </CardHeader>
        {apiKeyExpanded && (
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Required for AI-powered food analysis. Your key is stored locally and never sent
              to any server except Anthropic's API.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button onClick={handleSaveApiKey}>Save</Button>
            </div>
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Get your API key
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        )}
      </Card>

      {/* Goal Settings - Combined */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Goals</CardTitle>
          <CardDescription>
            Your default daily nutrition targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Protein Tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Protein</label>
              <button
                onClick={() => updateSettings({ proteinTrackingEnabled: !proteinTrackingEnabled })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  proteinTrackingEnabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                    proteinTrackingEnabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
            {proteinTrackingEnabled && (
              <div className="flex items-center gap-2 pl-1">
                <Input
                  type="number"
                  value={settings.defaultGoal}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 500) {
                      updateSettings({ defaultGoal: val });
                    }
                  }}
                  min={1}
                  max={500}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">grams per day</span>
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* Calorie Tracking */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Calories</label>
              <button
                onClick={() => updateSettings({ calorieTrackingEnabled: !settings.calorieTrackingEnabled })}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                  settings.calorieTrackingEnabled ? 'bg-primary' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                    settings.calorieTrackingEnabled ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>
            {settings.calorieTrackingEnabled && (
              <div className="flex items-center gap-2 pl-1">
                <Input
                  type="number"
                  value={settings.calorieGoal || ''}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (val > 0 && val <= 10000) {
                      updateSettings({ calorieGoal: val });
                    }
                  }}
                  min={500}
                  max={10000}
                  placeholder="2000"
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">kcal per day</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Data Management</CardTitle>
          <CardDescription>
            All your data is stored locally on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleClearData}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Protee</strong> - Your AI-powered protein tracker
            <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">v{version}</span>
          </p>
          <p>
            Track your daily protein intake by typing what you ate or taking photos
            of your food. AI analyzes your meals and estimates protein content.
          </p>
          <p>
            Estimated cost: ~$0.01 per analysis using Claude Sonnet.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
