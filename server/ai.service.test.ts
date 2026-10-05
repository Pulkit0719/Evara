import { describe, expect, it, vi } from "vitest";
import { OpenAICompatibleAdapter } from "./services/ai";

describe("OpenAICompatibleAdapter AI Service", () => {
  it("reports unconfigured when no API key is supplied", () => {
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "",
      defaultModel: "gpt-4o-mini",
    });

    expect(adapter.isConfigured()).toBe(false);
  });

  it("reports configured when API key is provided", () => {
    const adapter = new OpenAICompatibleAdapter({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-mock-api-key",
      defaultModel: "gpt-4o-mini",
    });

    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.getProviderName()).toContain("OpenAI-Compatible");
  });

  it("throws clear error when generateChatCompletion is called without configuration", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "",
    });

    await expect(
      adapter.generateChatCompletion({
        messages: [{ role: "user", content: "Hello" }],
      })
    ).rejects.toThrow(/AI provider is not configured/);
  });

  it("sends standard OpenAI-compatible chat payload and parses response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "chatcmpl-123",
        model: "gpt-4o-mini",
        choices: [
          {
            message: { role: "assistant", content: "Cycle insights overview." },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          total_tokens: 23,
        },
      }),
    });

    // Temporarily stub global fetch
    const originalFetch = global.fetch;
    global.fetch = mockFetch as any;

    try {
      const adapter = new OpenAICompatibleAdapter({
        baseUrl: "https://api.custom-ai-provider.com/v1",
        apiKey: "sk-mock-key-123",
        defaultModel: "custom-model-v1",
      });

      const result = await adapter.generateChatCompletion({
        messages: [{ role: "user", content: "Analyze trend" }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, requestInit] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.custom-ai-provider.com/v1/chat/completions");
      expect(requestInit.headers["Authorization"]).toBe("Bearer sk-mock-key-123");
      expect(JSON.parse(requestInit.body)).toMatchObject({
        model: "custom-model-v1",
        messages: [{ role: "user", content: "Analyze trend" }],
      });

      expect(result.content).toBe("Cycle insights overview.");
      expect(result.role).toBe("assistant");
      expect(result.usage?.totalTokens).toBe(23);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
