import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/hooks/useProteinData';
import { useStore } from '@/store/useStore';
import { db } from '@/db';

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const { clearMessages } = useStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState(settings.claudeApiKey || '');

  const handleSaveApiKey = async () => {
    await updateSettings({ claudeApiKey: apiKey || undefined });
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
      await db.foodEntries.clear();
      await db.dailyGoals.clear();
      clearMessages();
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* API Key Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Claude API Key</CardTitle>
          <CardDescription>
            Required for AI-powered food analysis. Your key is stored locally and never sent
            to any server except Anthropic's API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {settings.claudeApiKey && (
            <p className="text-sm text-green-600">API key is configured</p>
          )}
        </CardContent>
      </Card>

      {/* Goal Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Goal</CardTitle>
          <CardDescription>
            Your default daily protein target in grams.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
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
            <span className="text-muted-foreground">grams per day</span>
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
          </p>
          <p>
            Track your daily protein intake by typing what you ate or taking photos
            of your food. AI analyzes your meals and estimates protein content.
          </p>
          <p>
            Estimated cost: ~$0.02 per photo analysis using Claude Haiku.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
