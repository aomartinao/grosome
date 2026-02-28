// Supabase Edge Function: Anthropic API Proxy
// Proxies requests to Anthropic for users with admin-provided API keys
// The API key is retrieved from Supabase Vault and never exposed to the client

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS — production Vercel domains and local dev
const ALLOWED_ORIGINS = [
  "https://grosome.app",
  "https://grosome.vercel.app",
  "https://grrromode.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  // Allow exact matches and Vercel preview deployments (grosome-*.vercel.app)
  const isAllowed = ALLOWED_ORIGINS.includes(origin)
    || /^https:\/\/grosome-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$/.test(origin)
    || /^https:\/\/grrromode-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$/.test(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{
    role: "user" | "assistant";
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
}

interface UsageLog {
  request_type: string;
  tokens_in: number;
  tokens_out: number;
  model: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client for user verification (uses anon key context)
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for vault access (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user and get their ID
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get the API key using service client (via RPC function)
    const { data: keyData, error: keyError } = await serviceClient.rpc(
      "get_admin_api_key_for_user",
      { target_user_id: user.id }
    );

    console.log("Key lookup for user:", user.id, "Result:", keyData ? "found" : "not found", "Error:", keyError);

    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({
          error: "No admin API key configured for this user",
          code: "NO_ADMIN_KEY"
        }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = keyData as string;

    // Parse request body
    const body: AnthropicRequest & { request_type?: string } = await req.json();
    const requestType = body.request_type || "unknown";
    delete body.request_type; // Don't send to Anthropic

    // Forward request to Anthropic
    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const responseData = await anthropicResponse.json();

    // Log usage (async, don't wait)
    if (anthropicResponse.ok && responseData.usage) {
      const usageLog: UsageLog = {
        request_type: requestType,
        tokens_in: responseData.usage.input_tokens || 0,
        tokens_out: responseData.usage.output_tokens || 0,
        model: body.model,
      };

      // Fire and forget - don't block response
      serviceClient
        .from("api_usage")
        .insert({
          user_id: user.id,
          ...usageLog,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to log usage:", error);
        });
    }

    // Return Anthropic response
    return new Response(JSON.stringify(responseData), {
      status: anthropicResponse.status,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  }
});
