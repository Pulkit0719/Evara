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

/**
 * Universal OpenAI-compatible AI provider adapter.
 * Works seamlessly with OpenAI, Groq, Ollama, DeepSeek, Together AI, vLLM, OpenRouter, etc.
 * Driven entirely by standard server-side environment variables:
 * - AI_BASE_URL (defaults to https://api.openai.com/v1)
 * - AI_API_KEY
 * - AI_MODEL (defaults to gpt-4o-mini)
 */
export class OpenAICompatibleAdapter implements AIService {
  private baseUrl: string;
  private apiKey: string;
  private defaultModel: string;

  constructor(options?: { baseUrl?: string; apiKey?: string; defaultModel?: string }) {
    this.baseUrl = (options?.baseUrl ?? ENV.aiBaseUrl).replace(/\/+$/, "");
    this.apiKey = options?.apiKey ?? ENV.aiApiKey;
    this.defaultModel = options?.defaultModel ?? ENV.aiModel ?? "gpt-4o-mini";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getProviderName(): string {
    return "OpenAI-Compatible Universal Adapter";
  }

  async generateChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResult> {
    if (!this.isConfigured()) {
      throw new Error(
        "AI provider is not configured. Please set AI_API_KEY (and optionally AI_BASE_URL and AI_MODEL) in your environment."
      );
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
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

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`AI request failed [${response.status}]: ${errorText}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content ?? "",
      role: "assistant",
      finishReason: choice?.finish_reason,
      model: data.model ?? model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }
}

// Default singleton instance
export const aiService: AIService = new OpenAICompatibleAdapter();
