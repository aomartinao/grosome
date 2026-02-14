import { createClient, type SupabaseClient, type User, type Session } from '@supabase/supabase-js';

// Supabase configuration from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Admin email for auto-promotion (must be set via environment variable)
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;
if (!ADMIN_EMAIL) {
  console.warn('[Admin] VITE_ADMIN_EMAIL not configured - admin auto-promotion disabled');
}

// Create Supabase client
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// User stats view type
export interface UserStats {
  user_id: string;
  email: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  food_entries_count: number;
  chat_messages_count: number;
  api_requests_count: number;
  last_api_request: string | null;
  has_admin_key: boolean;
}

// API usage record type
export interface ApiUsageRecord {
  id: string;
  user_id: string;
  request_type: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
  created_at: string;
}

// Check if user is admin
export async function isAdmin(user: User): Promise<boolean> {
  console.log('isAdmin check for user:', user.id, user.email);

  // Check if user is in admin_users table
  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('user_id', user.id)
    .single();

  console.log('admin_users query result:', { data, error });

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found
    console.error('Error checking admin status:', error);
  }

  console.log('isAdmin returning:', !!data);
  return !!data;
}

// Get all users with stats (via admin-only RPC function)
export async function getUserStats(): Promise<UserStats[]> {
  const { data, error } = await supabase.rpc('admin_get_user_stats');

  if (error) {
    console.error('Error fetching user stats:', error);
    throw error;
  }

  // Sort by signed_up_at descending (RPC doesn't support .order())
  const stats = (data || []) as UserStats[];
  stats.sort((a, b) => new Date(b.signed_up_at).getTime() - new Date(a.signed_up_at).getTime());
  return stats;
}

// Get single user stats (via admin-only RPC function)
export async function getUserById(userId: string): Promise<UserStats | null> {
  const { data, error } = await supabase.rpc('admin_get_user_by_id', {
    target_user_id: userId,
  });

  if (error) {
    console.error('Error fetching user:', error);
    throw error;
  }

  const rows = data as UserStats[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

// Get API usage for a user
export async function getUserApiUsage(userId: string, limit = 100): Promise<ApiUsageRecord[]> {
  const { data, error } = await supabase
    .from('api_usage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching API usage:', error);
    throw error;
  }

  return data || [];
}

// Get aggregated API usage stats
export async function getApiUsageStats() {
  const { data, error } = await supabase
    .from('api_usage')
    .select('request_type, created_at');

  if (error) {
    console.error('Error fetching API usage stats:', error);
    throw error;
  }

  return data || [];
}

// Add API key for a user
export async function addApiKeyForUser(userId: string, apiKey: string): Promise<boolean> {
  const { error } = await supabase.rpc('admin_add_api_key', {
    target_user_id: userId,
    new_api_key: apiKey,
  });

  if (error) {
    console.error('Error adding API key:', error);
    throw error;
  }

  return true;
}

// Revoke API key for a user
export async function revokeApiKeyForUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('admin_revoke_api_key', {
    target_user_id: userId,
  });

  if (error) {
    console.error('Error revoking API key:', error);
    throw error;
  }

  return data === true;
}

// Auth helpers
export async function signIn(email: string, password: string): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  // Check if user is admin
  if (data.user && !(await isAdmin(data.user))) {
    await supabase.auth.signOut();
    return { user: null, session: null, error: 'Access denied. Admin privileges required.' };
  }

  return { user: data.user, session: data.session, error: null };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<{ user: User | null; session: Session | null }> {
  const { data } = await supabase.auth.getSession();
  return { user: data.session?.user ?? null, session: data.session };
}
