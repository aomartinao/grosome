import { useEffect, useState } from 'react';
import { Key, Loader2, Save, RotateCw, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getGrosomeKeyInfo,
  rotateGrosomeKey,
  getAppSettings,
  updateAppSetting,
  type GrosomeKeyInfo,
  type AppSetting,
} from '@/services/supabase';
import { formatDateTime } from '@/lib/utils';

const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
];

const MODEL_SLOTS = [
  { key: 'model_vision', label: 'Vision Model', description: 'Used for food photo and menu analysis' },
  { key: 'model_chat', label: 'Chat Model', description: 'Used for coaching and text-based food logging' },
  { key: 'model_greeting', label: 'Greeting Model', description: 'Used for AI-generated greetings (future)' },
] as const;

export function Settings() {
  const [keyInfo, setKeyInfo] = useState<GrosomeKeyInfo | null>(null);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);

  // Key rotation state
  const [showRotate, setShowRotate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [rotatingKey, setRotatingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  // Model config state
  const [modelValues, setModelValues] = useState<Record<string, string>>({});
  const [savingModels, setSavingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelSuccess, setModelSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [keyData, settingsData] = await Promise.all([
        getGrosomeKeyInfo(),
        getAppSettings(),
      ]);
      setKeyInfo(keyData);
      setSettings(settingsData);

      // Initialize model values from settings
      const values: Record<string, string> = {};
      for (const slot of MODEL_SLOTS) {
        const setting = settingsData.find((s) => s.key === slot.key);
        values[slot.key] = setting?.value || '';
      }
      setModelValues(values);
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRotateKey = async () => {
    if (!newKey.trim()) return;

    setKeyError(null);
    setKeySuccess(null);
    setRotatingKey(true);

    try {
      await rotateGrosomeKey(newKey.trim());
      setNewKey('');
      setShowRotate(false);
      setKeySuccess('API key rotated successfully');
      // Refresh key info
      const keyData = await getGrosomeKeyInfo();
      setKeyInfo(keyData);
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to rotate key');
    } finally {
      setRotatingKey(false);
    }
  };

  const handleSaveModels = async () => {
    setModelError(null);
    setModelSuccess(null);
    setSavingModels(true);

    try {
      for (const slot of MODEL_SLOTS) {
        const currentSetting = settings.find((s) => s.key === slot.key);
        const newValue = modelValues[slot.key];
        // Only update if value changed
        if (newValue && newValue !== currentSetting?.value) {
          await updateAppSetting(slot.key, newValue);
        }
      }
      setModelSuccess('Model configuration saved');
      // Refresh settings
      const settingsData = await getAppSettings();
      setSettings(settingsData);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'Failed to save model configuration');
    } finally {
      setSavingModels(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage API keys and model configuration</p>
      </div>

      {/* Grosome API Key Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="h-5 w-5" />
            Grosome API Key
          </CardTitle>
          <CardDescription>
            Shared Anthropic API key used by the Grosome proxy for all users
          </CardDescription>
        </CardHeader>
        <CardContent>
          {keyError && (
            <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {keyError}
            </div>
          )}
          {keySuccess && (
            <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 p-3 rounded-lg">
              {keySuccess}
            </div>
          )}

          {keyInfo?.has_key ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Key className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800">Key active</p>
                    <p className="text-sm text-green-600 font-mono">
                      ...{keyInfo.key_hint}
                    </p>
                    {keyInfo.updated_at && (
                      <p className="text-xs text-green-600">
                        Updated {formatDateTime(keyInfo.updated_at)}
                      </p>
                    )}
                  </div>
                </div>
                {!showRotate && (
                  <Button variant="outline" onClick={() => setShowRotate(true)}>
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate
                  </Button>
                )}
              </div>

              {showRotate && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">New API Key</label>
                    <Input
                      type="password"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                    <p className="text-xs text-muted-foreground">
                      The old key will be replaced immediately. This cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleRotateKey} disabled={!newKey.trim() || rotatingKey}>
                      {rotatingKey ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Save Key
                    </Button>
                    <Button variant="outline" onClick={() => { setShowRotate(false); setNewKey(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
                <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No key configured</p>
                <p className="text-sm">Add an Anthropic API key to enable the Grosome proxy</p>
              </div>

              {!showRotate ? (
                <Button onClick={() => setShowRotate(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Add Key
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">API Key</label>
                    <Input
                      type="password"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleRotateKey} disabled={!newKey.trim() || rotatingKey}>
                      {rotatingKey ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Save Key
                    </Button>
                    <Button variant="outline" onClick={() => { setShowRotate(false); setNewKey(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Model Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Model Configuration
          </CardTitle>
          <CardDescription>
            Configure which Claude models are used for each AI capability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {modelError && (
            <div className="mb-4 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {modelError}
            </div>
          )}
          {modelSuccess && (
            <div className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 p-3 rounded-lg">
              {modelSuccess}
            </div>
          )}

          <div className="space-y-4">
            {MODEL_SLOTS.map((slot) => (
              <div key={slot.key} className="space-y-1.5">
                <label className="text-sm font-medium">{slot.label}</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={modelValues[slot.key] || ''}
                  onChange={(e) =>
                    setModelValues((prev) => ({ ...prev, [slot.key]: e.target.value }))
                  }
                >
                  <option value="">Select a model...</option>
                  {ANTHROPIC_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{slot.description}</p>
              </div>
            ))}

            <Button onClick={handleSaveModels} disabled={savingModels} className="mt-2">
              {savingModels ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Models
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
