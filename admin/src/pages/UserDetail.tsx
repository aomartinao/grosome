import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Key, Trash2, Plus, Loader2, Mail, Calendar, Activity, UtensilsCrossed, MessageSquare, Archive, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getUserById,
  getUserApiUsage,
  addApiKeyForUser,
  revokeApiKeyForUser,
  archiveUser,
  restoreUser,
  softDeleteUser,
  hardDeleteUser,
  type UserStats,
  type ApiUsageRecord,
} from '@/services/supabase';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

function StatusBadge({ status, deletedAt }: { status: UserStats['status']; deletedAt: string | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
        Active
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="inline-flex items-center text-sm bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
        Archived
      </span>
    );
  }
  const daysAgo = deletedAt
    ? Math.floor((Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysRemaining = daysAgo !== null ? Math.max(0, 90 - daysAgo) : null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm bg-red-100 text-red-700 px-3 py-1 rounded-full font-medium">
      <AlertTriangle className="h-3.5 w-3.5" />
      Deleted{daysAgo !== null ? ` (${daysAgo}d ago, ${daysRemaining}d remaining)` : ''}
    </span>
  );
}

export function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<UserStats | null>(null);
  const [usage, setUsage] = useState<ApiUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddKey, setShowAddKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!userId) return;

    try {
      const [userData, usageData] = await Promise.all([
        getUserById(userId),
        getUserApiUsage(userId),
      ]);
      setUser(userData);
      setUsage(usageData);
    } catch (err) {
      console.error('Error loading user:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId]);

  const handleAddKey = async () => {
    if (!userId || !newApiKey.trim()) return;

    setError(null);
    setSavingKey(true);

    try {
      await addApiKeyForUser(userId, newApiKey.trim());
      setNewApiKey('');
      setShowAddKey(false);
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add API key');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRevokeKey = async () => {
    if (!userId) return;

    setError(null);
    setRevokingKey(true);

    try {
      await revokeApiKeyForUser(userId);
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    } finally {
      setRevokingKey(false);
    }
  };

  const handleArchive = async () => {
    if (!userId || !user) return;
    const reason = window.prompt('Reason for archiving (optional):');
    if (reason === null) return; // cancelled

    setError(null);
    setActionLoading(true);
    try {
      await archiveUser(userId, reason || undefined);
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!userId || !user) return;
    if (!window.confirm(`Restore ${user.email} to active status?`)) return;

    setError(null);
    setActionLoading(true);
    try {
      await restoreUser(userId);
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!userId || !user) return;
    const reason = window.prompt(`Delete ${user.email}? Enter a reason (optional):`);
    if (reason === null) return; // cancelled

    if (!window.confirm(`Are you sure you want to delete ${user.email}? The user will be soft-deleted with a 90-day retention period.`)) return;

    setError(null);
    setActionLoading(true);
    try {
      await softDeleteUser(userId, reason || undefined);
      const userData = await getUserById(userId);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDelete = async () => {
    if (!userId || !user) return;
    if (!window.confirm(`PERMANENTLY DELETE ${user.email}?\n\nThis will permanently delete the user and ALL their data. This cannot be undone.`)) return;
    if (!window.confirm(`FINAL CONFIRMATION: Are you absolutely sure? This action is irreversible. All data for ${user.email} will be permanently destroyed.`)) return;

    setError(null);
    setActionLoading(true);
    try {
      await hardDeleteUser(userId);
      // User is gone — redirect to users list
      window.location.href = '/users';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to permanently delete user');
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">User not found</h2>
        <Link to="/users">
          <Button variant="link">Back to Users</Button>
        </Link>
      </div>
    );
  }

  // Prepare usage chart data (last 30 days)
  const usageByDay: Record<string, number> = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(now, i), 'yyyy-MM-dd');
    usageByDay[date] = 0;
  }
  usage.forEach((u) => {
    const date = format(new Date(u.created_at), 'yyyy-MM-dd');
    if (usageByDay[date] !== undefined) {
      usageByDay[date]++;
    }
  });
  const chartData = Object.entries(usageByDay).map(([date, count]) => ({
    date: format(new Date(date), 'MMM d'),
    requests: count,
  }));

  // Calculate usage stats
  const totalTokensIn = usage.reduce((sum, u) => sum + (u.tokens_in || 0), 0);
  const totalTokensOut = usage.reduce((sum, u) => sum + (u.tokens_out || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="text-sm text-muted-foreground">User Details</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Signed Up</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(user.signed_up_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Last Active</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(user.last_sign_in_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Activity Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Food Entries</p>
                <p className="text-sm text-muted-foreground">{formatNumber(user.food_entries_count)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Chat Messages</p>
                <p className="text-sm text-muted-foreground">{formatNumber(user.chat_messages_count)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">API Requests</p>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(user.api_requests_count)} requests
                  {totalTokensIn > 0 && (
                    <span className="ml-2">
                      ({formatNumber(totalTokensIn)} in / {formatNumber(totalTokensOut)} out tokens)
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User Status Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            User Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={user.status} deletedAt={user.deleted_at} />
          </div>

          {user.deleted_at && (
            <p className="text-sm text-muted-foreground">
              Deleted on {formatDateTime(user.deleted_at)}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {user.status === 'active' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleArchive}
                  disabled={actionLoading}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                  Archive
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSoftDelete}
                  disabled={actionLoading}
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete
                </Button>
              </>
            )}
            {user.status === 'archived' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Restore
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSoftDelete}
                  disabled={actionLoading}
                  className="text-red-700 border-red-300 hover:bg-red-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete
                </Button>
              </>
            )}
            {user.status === 'deleted' && (
              <>
                <Button
                  variant="outline"
                  onClick={handleRestore}
                  disabled={actionLoading}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Restore
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleHardDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Permanently Delete
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom API Key Override */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="h-5 w-5" />
                Custom API Key Override
              </CardTitle>
              <CardDescription>
                Override the global Grosome key with a custom key for this user
              </CardDescription>
            </div>
            {!user.has_custom_key && !showAddKey && (
              <Button onClick={() => setShowAddKey(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Key
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {user.has_custom_key ? (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Key className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-blue-800">Custom key active</p>
                  <p className="text-sm text-blue-600">User has a custom API key override</p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={handleRevokeKey}
                disabled={revokingKey}
              >
                {revokingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Revoke
                  </>
                )}
              </Button>
            </div>
          ) : showAddKey ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                />
                <p className="text-xs text-muted-foreground">
                  This key will be securely stored and never shown to the user.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddKey} disabled={!newApiKey.trim() || savingKey}>
                  {savingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save Key
                </Button>
                <Button variant="outline" onClick={() => setShowAddKey(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-center text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No custom key configured</p>
              <p className="text-sm">User is using the global Grosome key</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Usage (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {usage.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              No API usage data
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent API Calls */}
      {usage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent API Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usage.slice(0, 10).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-sm">{u.request_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(u.created_at)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{u.tokens_in} in / {u.tokens_out} out</p>
                    <p className="text-xs">{u.model}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
