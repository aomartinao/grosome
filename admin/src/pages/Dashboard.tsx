import { useEffect, useState } from 'react';
import { Users, Activity, Key, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUserStats, getApiUsageStats, type UserStats } from '@/services/supabase';
import { formatNumber } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

interface DashboardStats {
  totalUsers: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  totalApiRequests: number;
  usersWithAdminKey: number;
  usersWithoutAdminKey: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usageByType, setUsageByType] = useState<{ name: string; value: number }[]>([]);
  const [usageByDay, setUsageByDay] = useState<{ date: string; requests: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [users, apiUsage] = await Promise.all([
          getUserStats(),
          getApiUsageStats(),
        ]);

        // Calculate dashboard stats
        const now = new Date();
        const sevenDaysAgo = subDays(now, 7);
        const thirtyDaysAgo = subDays(now, 30);

        const activeUsersLast7Days = users.filter(
          (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= sevenDaysAgo
        ).length;

        const activeUsersLast30Days = users.filter(
          (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= thirtyDaysAgo
        ).length;

        setStats({
          totalUsers: users.length,
          activeUsersLast7Days,
          activeUsersLast30Days,
          totalApiRequests: apiUsage.length,
          usersWithAdminKey: users.filter((u) => u.has_admin_key).length,
          usersWithoutAdminKey: users.filter((u) => !u.has_admin_key).length,
        });

        // Calculate usage by type
        const typeCount: Record<string, number> = {};
        apiUsage.forEach((u) => {
          typeCount[u.request_type] = (typeCount[u.request_type] || 0) + 1;
        });
        setUsageByType(
          Object.entries(typeCount).map(([name, value]) => ({ name, value }))
        );

        // Calculate usage by day (last 14 days)
        const dayCount: Record<string, number> = {};
        for (let i = 13; i >= 0; i--) {
          const date = format(subDays(now, i), 'yyyy-MM-dd');
          dayCount[date] = 0;
        }
        apiUsage.forEach((u) => {
          const date = format(new Date(u.created_at), 'yyyy-MM-dd');
          if (dayCount[date] !== undefined) {
            dayCount[date]++;
          }
        });
        setUsageByDay(
          Object.entries(dayCount).map(([date, requests]) => ({
            date: format(new Date(date), 'MMM d'),
            requests,
          }))
        );
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Failed to load dashboard data
      </div>
    );
  }

  const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsersLast7Days} active last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users (30d)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.activeUsersLast30Days)}</div>
            <p className="text-xs text-muted-foreground">
              {((stats.activeUsersLast30Days / stats.totalUsers) * 100).toFixed(0)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalApiRequests)}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usersWithAdminKey}</div>
            <p className="text-xs text-muted-foreground">
              {stats.usersWithoutAdminKey} without keys
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Requests (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={usageByDay}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="requests" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Requests by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {usageByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={usageByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {usageByType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No API usage data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
