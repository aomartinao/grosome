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

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-20250514",
]);

const MAX_TOKENS = 2048;
const MAX_MESSAGES = 40;
const MAX_CONTENT_BLOCKS_PER_MESSAGE = 16;
const MAX_IMAGES = 4;
const MAX_SYSTEM_LENGTH = 20_000;
const MAX_TEXT_LENGTH = 20_000;
const MAX_REQUEST_TYPE_LENGTH = 64;
const MAX_REQUEST_BYTES = 10 * 1024 * 1024; // 10MB total request body
const MAX_BASE64_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB per image
const MAX_TOTAL_BASE64_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB across all images
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour window
const RATE_LIMIT_MAX_REQUESTS = 120;

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

interface ErrorBody {
  error: string;
  code?: "INVALID_REQUEST" | "RATE_LIMITED" | "MODEL_NOT_ALLOWED" | "PAYLOAD_TOO_LARGE" | "NO_ADMIN_KEY";
  details?: string;
}

function jsonResponse(
  req: Request,
  status: number,
  body: ErrorBody | Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function invalidRequest(req: Request, details: string): Response {
  return jsonResponse(req, 400, {
    error: "Invalid request body",
    code: "INVALID_REQUEST",
    details,
  });
}

function modelNotAllowed(req: Request, model: string): Response {
  return jsonResponse(req, 400, {
    error: "Requested model is not allowed",
    code: "MODEL_NOT_ALLOWED",
    details: model,
  });
}

function payloadTooLarge(req: Request, details: string): Response {
  return jsonResponse(req, 413, {
    error: "Request payload is too large",
    code: "PAYLOAD_TOO_LARGE",
    details,
  });
}

function estimateBase64Bytes(base64: string): number {
  const normalized = base64.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(obj: Record<string, unknown>, allowedKeys: string[]): boolean {
  return Object.keys(obj).every((key) => allowedKeys.includes(key));
}

function validateRequestBody(
  req: Request,
  rawBody: unknown
): { body: AnthropicRequest; requestType: string } | Response {
  if (!isObject(rawBody)) {
    return invalidRequest(req, "Body must be a JSON object");
  }

  const allowedTopLevelKeys = ["model", "max_tokens", "system", "messages", "request_type"];
  if (!hasOnlyKeys(rawBody, allowedTopLevelKeys)) {
    return invalidRequest(req, "Body contains unknown top-level fields");
  }

  const model = rawBody.model;
  if (typeof model !== "string" || model.length === 0) {
    return invalidRequest(req, "model must be a non-empty string");
  }
  if (!ALLOWED_MODELS.has(model)) {
    return modelNotAllowed(req, model);
  }

  const maxTokens = rawBody.max_tokens;
  if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0) {
    return invalidRequest(req, "max_tokens must be a positive integer");
  }
  if (maxTokens > MAX_TOKENS) {
    return invalidRequest(req, `max_tokens must be <= ${MAX_TOKENS}`);
  }

  const system = rawBody.system;
  if (system !== undefined) {
    if (typeof system !== "string") {
      return invalidRequest(req, "system must be a string");
    }
    if (system.length > MAX_SYSTEM_LENGTH) {
      return payloadTooLarge(req, `system prompt exceeds ${MAX_SYSTEM_LENGTH} characters`);
    }
  }

  const requestType = rawBody.request_type;
  if (requestType !== undefined) {
    if (typeof requestType !== "string" || requestType.length === 0) {
      return invalidRequest(req, "request_type must be a non-empty string when provided");
    }
    if (requestType.length > MAX_REQUEST_TYPE_LENGTH) {
      return invalidRequest(req, `request_type must be <= ${MAX_REQUEST_TYPE_LENGTH} characters`);
    }
  }

  const messages = rawBody.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return invalidRequest(req, "messages must be a non-empty array");
  }
  if (messages.length > MAX_MESSAGES) {
    return invalidRequest(req, `messages length must be <= ${MAX_MESSAGES}`);
  }

  let imageCount = 0;
  let totalBase64Bytes = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (!isObject(message)) {
      return invalidRequest(req, `messages[${i}] must be an object`);
    }
    if (!hasOnlyKeys(message, ["role", "content"])) {
      return invalidRequest(req, `messages[${i}] contains unknown fields`);
    }

    if (message.role !== "user" && message.role !== "assistant") {
      return invalidRequest(req, `messages[${i}].role must be 'user' or 'assistant'`);
    }

    const content = message.content;
    if (typeof content === "string") {
      if (content.length > MAX_TEXT_LENGTH) {
        return payloadTooLarge(req, `messages[${i}].content exceeds ${MAX_TEXT_LENGTH} characters`);
      }
      continue;
    }

    if (!Array.isArray(content) || content.length === 0) {
      return invalidRequest(req, `messages[${i}].content must be a string or non-empty array`);
    }
    if (content.length > MAX_CONTENT_BLOCKS_PER_MESSAGE) {
      return invalidRequest(
        req,
        `messages[${i}].content length must be <= ${MAX_CONTENT_BLOCKS_PER_MESSAGE}`
      );
    }

    for (let j = 0; j < content.length; j++) {
      const block = content[j];
      if (!isObject(block)) {
        return invalidRequest(req, `messages[${i}].content[${j}] must be an object`);
      }

      if (block.type === "text") {
        if (!hasOnlyKeys(block, ["type", "text"])) {
          return invalidRequest(req, `messages[${i}].content[${j}] has unknown fields`);
        }
        if (typeof block.text !== "string" || block.text.length === 0) {
          return invalidRequest(req, `messages[${i}].content[${j}].text must be a non-empty string`);
        }
        if (block.text.length > MAX_TEXT_LENGTH) {
          return payloadTooLarge(
            req,
            `messages[${i}].content[${j}].text exceeds ${MAX_TEXT_LENGTH} characters`
          );
        }
        continue;
      }

      if (block.type === "image") {
        if (!hasOnlyKeys(block, ["type", "source"])) {
          return invalidRequest(req, `messages[${i}].content[${j}] has unknown fields`);
        }
        if (!isObject(block.source)) {
          return invalidRequest(req, `messages[${i}].content[${j}].source must be an object`);
        }
        if (!hasOnlyKeys(block.source, ["type", "media_type", "data"])) {
          return invalidRequest(req, `messages[${i}].content[${j}].source has unknown fields`);
        }

        if (block.source.type !== "base64") {
          return invalidRequest(req, `messages[${i}].content[${j}].source.type must be 'base64'`);
        }
        if (
          block.source.media_type !== "image/jpeg"
          && block.source.media_type !== "image/png"
          && block.source.media_type !== "image/webp"
        ) {
          return invalidRequest(
            req,
            `messages[${i}].content[${j}].source.media_type must be image/jpeg, image/png, or image/webp`
          );
        }
        if (typeof block.source.data !== "string" || block.source.data.length === 0) {
          return invalidRequest(req, `messages[${i}].content[${j}].source.data must be a non-empty string`);
        }

        const normalizedData = block.source.data.replace(/\s+/g, "");
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalizedData)) {
          return invalidRequest(req, `messages[${i}].content[${j}].source.data must be valid base64`);
        }

        const imageBytes = estimateBase64Bytes(normalizedData);
        if (imageBytes > MAX_BASE64_IMAGE_BYTES) {
          return payloadTooLarge(
            req,
            `messages[${i}].content[${j}] image exceeds ${MAX_BASE64_IMAGE_BYTES} bytes`
          );
        }

        block.source.data = normalizedData;
        totalBase64Bytes += imageBytes;
        imageCount += 1;

        continue;
      }

      return invalidRequest(req, `messages[${i}].content[${j}].type must be 'text' or 'image'`);
    }
  }

  if (imageCount > MAX_IMAGES) {
    return invalidRequest(req, `No more than ${MAX_IMAGES} images are allowed`);
  }
  if (totalBase64Bytes > MAX_TOTAL_BASE64_IMAGE_BYTES) {
    return payloadTooLarge(req, `Total image payload exceeds ${MAX_TOTAL_BASE64_IMAGE_BYTES} bytes`);
  }

  return {
    body: {
      model,
      max_tokens: maxTokens,
      system: system as string | undefined,
      messages: messages as AnthropicRequest["messages"],
    },
    requestType: (requestType as string | undefined) || "unknown",
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, 405, {
      error: "Method not allowed",
      code: "INVALID_REQUEST",
      details: "Only POST requests are supported",
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, 401, {
        error: "Missing authorization header",
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
      return jsonResponse(req, 401, {
        error: "Invalid or expired token",
      });
    }

    // Rate limit by request volume in rolling window
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentCount, error: rateError } = await serviceClient
      .from("api_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", windowStart);

    if (rateError) {
      console.error("Rate limit check failed:", rateError);
      return jsonResponse(req, 500, { error: "Internal server error" });
    }

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
      return jsonResponse(req, 429, {
        error: "Rate limit exceeded",
        code: "RATE_LIMITED",
        details: `Limit is ${RATE_LIMIT_MAX_REQUESTS} requests per ${Math.floor(RATE_LIMIT_WINDOW_MS / 60000)} minutes`,
      });
    }

    // Get the API key using service client (via RPC function)
    const { data: keyData, error: keyError } = await serviceClient.rpc(
      "get_admin_api_key_for_user",
      { target_user_id: user.id }
    );

    if (keyError || !keyData) {
      return jsonResponse(req, 403, {
        error: "No admin API key configured for this user",
        code: "NO_ADMIN_KEY",
      });
    }

    const apiKey = keyData as string;

    // Request size guard before parsing JSON
    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
        return payloadTooLarge(req, `Body exceeds ${MAX_REQUEST_BYTES} bytes`);
      }
    }

    const rawBodyText = await req.text();
    if (new TextEncoder().encode(rawBodyText).length > MAX_REQUEST_BYTES) {
      return payloadTooLarge(req, `Body exceeds ${MAX_REQUEST_BYTES} bytes`);
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBodyText);
    } catch {
      return invalidRequest(req, "Body must be valid JSON");
    }

    const validationResult = validateRequestBody(req, parsedBody);
    if (validationResult instanceof Response) {
      return validationResult;
    }

    const { body, requestType } = validationResult;

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

    const responseText = await anthropicResponse.text();
    let responseData: Record<string, unknown>;
    try {
      responseData = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      responseData = { error: "Invalid response from upstream model provider" };
    }

    // Log usage (async, don't wait)
    if (anthropicResponse.ok && isObject(responseData.usage)) {
      const usageLog: UsageLog = {
        request_type: requestType,
        tokens_in: Number(responseData.usage.input_tokens) || 0,
        tokens_out: Number(responseData.usage.output_tokens) || 0,
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
    return jsonResponse(req, anthropicResponse.status, responseData);
  } catch (error) {
    console.error("Proxy error:", error);
    return jsonResponse(req, 500, { error: "Internal server error" });
  }
});
