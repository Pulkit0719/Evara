import { ENV } from "../_core/env";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatCompletionParams = {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: { type: "text" | "json_object" };
};

export type ChatCompletionResult = {
  content: string;
  role: "assistant";
  finishReason?: string;
  model: string;
  isQuotaExhausted?: boolean;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export interface AIService {
  isConfigured(): boolean;
  getProviderName(): string;
  generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult>;
}

// In-memory daily quota guard to prevent abuse of free tiers (max 100 calls per 24 hours per instance)
let dailyAiCallCount = 0;
let dailyAiWindowStart = Date.now();
const MAX_FREE_DAILY_CALLS = 100;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function checkLocalAiQuota(): boolean {
  const now = Date.now();
  if (now - dailyAiWindowStart > ONE_DAY_MS) {
    dailyAiCallCount = 0;
    dailyAiWindowStart = now;
  }
  return dailyAiCallCount < MAX_FREE_DAILY_CALLS;
}

function incrementLocalAiCount(): void {
  dailyAiCallCount += 1;
}

/**
 * Universal Zero-Cost AI provider adapter.
 * Works seamlessly with:
 * 1. Google Gemini Developer API Free Tier (via official OpenAI-compatible endpoint)
 * 2. Groq Developer Free Tier (via official OpenAI-compatible endpoint)
 * 3. Local Ollama (100% free, runs locally, no API key needed)
 * 4. Standard OpenAI-compatible endpoints (DeepSeek, Together, vLLM, etc.)
 */
export class OpenAICompatibleAdapter implements AIService {
  private provider: string;
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(options?: {
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    defaultModel?: string;
  }) {
    this.provider = (options?.provider ?? ENV.aiProvider ?? "openai").toLowerCase();
    this.apiKey = options?.apiKey ?? ENV.aiApiKey;

    // Resolve base URL based on provider if not explicitly provided
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    } else if (process.env.AI_BASE_URL) {
      this.baseUrl = process.env.AI_BASE_URL.replace(/\/+$/, "");
    } else if (this.provider === "gemini") {
      // Official Google AI Studio OpenAI-compatible endpoint (free tier available)
      this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";
    } else if (this.provider === "groq") {
      // Official Groq developer free tier endpoint
      this.baseUrl = "https://api.groq.com/openai/v1";
    } else if (this.provider === "ollama") {
      // Free local Ollama daemon
      this.baseUrl = "http://localhost:11434/v1";
    } else {
      this.baseUrl = (ENV.aiBaseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    }

    // Resolve default model based on provider
    if (options?.defaultModel) {
      this.defaultModel = options.defaultModel;
    } else if (process.env.AI_MODEL) {
      this.defaultModel = process.env.AI_MODEL;
    } else if (this.provider === "gemini") {
      this.defaultModel = "gemini-1.5-flash";
    } else if (this.provider === "groq") {
      this.defaultModel = "llama-3.3-70b-versatile";
    } else if (this.provider === "ollama") {
      this.defaultModel = "llama3.2";
    } else {
      this.defaultModel = ENV.aiModel ?? "gpt-4o-mini";
    }
  }

  isConfigured(): boolean {
    // Local Ollama does not require an API key
    if (this.provider === "ollama" || this.baseUrl.includes("localhost") || this.baseUrl.includes("127.0.0.1")) {
      return true;
    }
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getProviderName(): string {
    switch (this.provider) {
      case "gemini":
        return "Google Gemini Free Tier (OpenAI-Compatible)";
      case "groq":
        return "Groq Developer Free Tier";
      case "ollama":
        return "Local Ollama (100% Free / Offline)";
      default:
        return "Universal OpenAI-Compatible Adapter";
    }
  }

  async generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "AI provider is not configured. Configure AI_API_KEY (or set AI_PROVIDER=ollama for local free execution)."
      );
    }

    // Check application-level daily free quota guard
    if (!checkLocalAiQuota() && this.provider !== "ollama") {
      return {
        content: "AI service is temporarily unavailable because the daily free quota limit has been reached.",
        role: "assistant",
        finishReason: "quota_exhausted",
        model: params.model ?? this.defaultModel,
        isQuotaExhausted: true,
      };
    }

    const endpoint = this.baseUrl.endsWith("/chat/completions")
      ? this.baseUrl
      : `${this.baseUrl}/chat/completions`;
    const model = params.model ?? this.defaultModel;

    const payload: Record<string, unknown> = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
    };

    if (params.maxTokens) {
      payload.max_tokens = params.maxTokens;
    }

    if (params.responseFormat) {
      payload.response_format = params.responseFormat;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      // Handle Quota Exhaustion / Rate Limits gracefully (HTTP 429)
      if (response.status === 429) {
        console.warn(`[AI Service] Free quota exhausted on provider ${this.provider}. Failing safely with ₹0 cost.`);
        return {
          content: "AI service is temporarily unavailable because the free quota has been reached.",
          role: "assistant",
          finishReason: "quota_exhausted",
          model,
          isQuotaExhausted: true,
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        if (
          errorText.toLowerCase().includes("quota") ||
          errorText.toLowerCase().includes("rate limit") ||
          errorText.toLowerCase().includes("resource exhausted")
        ) {
          return {
            content: "AI service is temporarily unavailable because the free quota has been reached.",
            role: "assistant",
            finishReason: "quota_exhausted",
            model,
            isQuotaExhausted: true,
          };
        }
        throw new Error(`AI request failed [${response.status}]: ${errorText}`);
      }

      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      incrementLocalAiCount();

      return {
        content: choice?.message?.content ?? "",
        role: "assistant",
        finishReason: choice?.finish_reason,
        model: data.model ?? model,
        isQuotaExhausted: false,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error: any) {
      if (
        error.message?.toLowerCase().includes("quota") ||
        error.message?.toLowerCase().includes("rate limit")
      ) {
        return {
          content: "AI service is temporarily unavailable because the free quota has been reached.",
          role: "assistant",
          finishReason: "quota_exhausted",
          model,
          isQuotaExhausted: true,
        };
      }
      throw error;
    }
  }
}

// Default singleton instance
export const aiService: AIService = new OpenAICompatibleAdapter();
