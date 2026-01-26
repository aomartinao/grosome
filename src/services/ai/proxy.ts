// Proxy service for Anthropic API calls through Supabase Edge Function
// Used when users have admin-provided API keys stored securely in Supabase Vault

import { getSupabase } from '@/services/supabase';

// Edge Function URL for the anthropic proxy
const PROXY_FUNCTION_NAME = 'anthropic-proxy';

export interface ProxyMessageContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ProxyRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | ProxyMessageContent[];
  }>;
  request_type?: string; // For usage logging: 'food_analysis', 'advisor', 'menu_analysis'
}

export interface ProxyResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ProxyError {
  error: string;
  code?: string;
  details?: string;
}

/**
 * Check if the current user has an admin-provided API key
 */
export async function checkHasAdminApiKey(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data, error } = await supabase.rpc('has_admin_api_key', {
      target_user_id: user.id
    });

    if (error) {
      console.error('[Proxy] Error checking admin API key:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Proxy] Failed to check admin API key:', err);
    return false;
  }
}

/**
 * Send a request through the Anthropic proxy Edge Function
 */
export async function sendProxyRequest(request: ProxyRequest): Promise<ProxyResponse> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  // Get the Supabase URL from env
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  // Build the Edge Function URL
  const functionUrl = `${supabaseUrl}/functions/v1/${PROXY_FUNCTION_NAME}`;

  // Send the request
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ProxyError;
    if (errorData.code === 'NO_ADMIN_KEY') {
      throw new Error('No admin API key configured for this user');
    }
    throw new Error(errorData.error || 'Proxy request failed');
  }

  return data as ProxyResponse;
}

/**
 * Parse the text content from a proxy response
 */
export function parseProxyResponse(response: ProxyResponse): string {
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent) {
    throw new Error('No text response from AI');
  }
  return textContent.text;
}
