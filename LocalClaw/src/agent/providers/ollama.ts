import type { LLMProvider, Message } from "../types.js";
import type { Config } from "../../config/index.js";

// ============ Ollama Provider ============

export class OllamaProvider implements LLMProvider {
  name = "ollama";

  private host: string;
  private model: string;
  private timeout: number;

  constructor(config: Config["ollama"]) {
    this.host = config.host;
    this.model = config.model;
    this.timeout = config.timeout;
  }

  async complete(params: {
    messages: Message[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<{
    content: string;
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    const url = `${this.host}/api/generate`;

    // 转换消息格式
    const prompt = this.buildPrompt(params.messages, params.systemPrompt);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || this.model,
        prompt,
        stream: false,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens || 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.response,
      usage: {
        inputTokens: data.eval_count || 0,
        outputTokens: data.prompt_eval_count || 0,
      },
    };
  }

  async *stream(params: {
    messages: Message[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): AsyncIterable<{
    delta: string;
    done: boolean;
  }> {
    const url = `${this.host}/api/generate`;

    const prompt = this.buildPrompt(params.messages, params.systemPrompt);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model || this.model,
        prompt,
        stream: true,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens || 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API 错误: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法获取响应流");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        yield { delta: "", done: true };
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.response) {
            yield { delta: data.response, done: false };
          }

          if (data.done) {
            yield { delta: "", done: true };
            return;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }

  private buildPrompt(messages: Message[], systemPrompt?: string): string {
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(`System: ${systemPrompt}`);
    }

    for (const msg of messages) {
      const role = msg.role.toUpperCase();
      parts.push(`${role}: ${msg.content}`);
    }

    return parts.join("\n\n");
  }
}

// ============ Provider 工厂 ============

export function createOllamaProvider(config: Config["ollama"]): OllamaProvider {
  return new OllamaProvider(config);
}
