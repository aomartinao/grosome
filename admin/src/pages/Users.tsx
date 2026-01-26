import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Key, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getUserStats, type UserStats } from '@/services/supabase';
import { formatDate, timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';

type SortField = 'email' | 'signed_up_at' | 'last_sign_in_at' | 'api_requests_count' | 'food_entries_count';
type SortDirection = 'asc' | 'desc';

export function Users() {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('signed_up_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const data = await getUserStats();
        setUsers(data);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((u) => u.email.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number | null;
      let bVal: string | number | null;

      switch (sortField) {
        case 'email':
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'signed_up_at':
          aVal = a.signed_up_at;
          bVal = b.signed_up_at;
          break;
        case 'last_sign_in_at':
          aVal = a.last_sign_in_at || '';
          bVal = b.last_sign_in_at || '';
          break;
        case 'api_requests_count':
          aVal = a.api_requests_count;
          bVal = b.api_requests_count;
          break;
        case 'food_entries_count':
          aVal = a.food_entries_count;
          bVal = b.food_entries_count;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, searchQuery, sortField, sortDirection]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium uppercase tracking-wider hover:text-foreground transition-colors',
        sortField === field ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {children}
      {sortField === field && (
        <ArrowUpDown className="h-3 w-3" />
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-4">
                    <SortButton field="email">Email</SortButton>
                  </th>
                  <th className="text-left p-4">
                    <SortButton field="signed_up_at">Signed Up</SortButton>
                  </th>
                  <th className="text-left p-4">
                    <SortButton field="last_sign_in_at">Last Active</SortButton>
                  </th>
                  <th className="text-right p-4">
                    <SortButton field="food_entries_count">Entries</SortButton>
                  </th>
                  <th className="text-right p-4">
                    <SortButton field="api_requests_count">API Calls</SortButton>
                  </th>
                  <th className="text-center p-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Key
                    </span>
                  </th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedUsers.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-medium">{user.email}</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {formatDate(user.signed_up_at)}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {timeAgo(user.last_sign_in_at)}
                    </td>
                    <td className="p-4 text-right text-sm">
                      {user.food_entries_count}
                    </td>
                    <td className="p-4 text-right text-sm">
                      {user.api_requests_count}
                    </td>
                    <td className="p-4 text-center">
                      {user.has_admin_key ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          <Key className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link to={`/users/${user.user_id}`}>
                        <Button variant="ghost" size="sm">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedUsers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'No users match your search' : 'No users found'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
