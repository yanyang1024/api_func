import { ChatResponse, Message as OllamaMessage } from "ollama";
import { Message, AgentResult, ToolCall, ToolResult } from "../types.js";

export interface OllamaClientConfig {
  host: string;
  model: string;
  embedModel: string;
  timeout: number;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface EmbeddingOptions {
  model?: string;
}

export class OllamaClient {
  private config: OllamaClientConfig;
  private importOllama: Promise<typeof import("ollama")>;

  constructor(config: OllamaClientConfig) {
    this.config = config;
    this.importOllama = import("ollama").catch(() => null);
  }

  async isAvailable(): Promise<boolean> {
    try {
      const ollama = await this.importOllama;
      if (!ollama) return false;
      
      const host = this.config.host.replace(/\/$/, "");
      const response = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(
    messages: Message[],
    options: ChatOptions = {}
  ): Promise<AgentResult> {
    const ollama = await this.importOllama;
    if (!ollama) {
      throw new Error("Ollama客户端未初始化");
    }

    const ollamaMessages = this.convertMessages(messages, options.systemPrompt);
    
    try {
      const response = await ollama.chat({
        model: this.config.model,
        messages: ollamaMessages,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
        stream: false,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw new Error(`Ollama调用失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async chatStream(
    messages: Message[],
    options: ChatOptions = {},
    onChunk: (chunk: string) => void
  ): Promise<AgentResult> {
    const ollama = await this.importOllama;
    if (!ollama) {
      throw new Error("Ollama客户端未初始化");
    }

    const ollamaMessages = this.convertMessages(messages, options.systemPrompt);
    let fullContent = "";

    try {
      const response = await ollama.chat({
        model: this.config.model,
        messages: ollamaMessages,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
        stream: true,
      });

      for await (const chunk of response) {
        const content = chunk.message?.content || "";
        fullContent += content;
        onChunk(content);
      }

      return {
        content: fullContent,
        toolCalls: [],
        usage: {
          promptTokens: this.estimateTokens(JSON.stringify(ollamaMessages)),
          completionTokens: this.estimateTokens(fullContent),
          totalTokens: this.estimateTokens(JSON.stringify(ollamaMessages)) + this.estimateTokens(fullContent),
        },
        finishReason: "stop",
      };
    } catch (error) {
      throw new Error(`Ollama流式调用失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async getEmbedding(text: string, options: EmbeddingOptions = {}): Promise<number[]> {
    const ollama = await this.importOllama;
    if (!ollama) {
      throw new Error("Ollama客户端未初始化");
    }

    const model = options.model || this.config.embedModel;

    try {
      const response = await ollama.embed({
        model,
        input: text,
      });

      return response.embeddings?.[0] || [];
    } catch (error) {
      throw new Error(`Embedding生成失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }

  async getModelInfo(): Promise<{ name: string; size: number; parameter_size: string }[]> {
    const ollama = await this.importOllama;
    if (!ollama) {
      return [];
    }

    try {
      const host = this.config.host.replace(/\/$/, "");
      const response = await fetch(`${host}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        parameter_size: m.parameter_size,
      }));
    } catch {
      return [];
    }
  }

  private convertMessages(messages: Message[], systemPrompt?: string): OllamaMessage[] {
    const result: OllamaMessage[] = [];

    // 添加系统提示
    if (systemPrompt) {
      result.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      result.push({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        images: msg.images as string[],
      });
    }

    return result;
  }

  private parseResponse(response: ChatResponse): AgentResult {
    const message = response.message;
    const content = message?.content || "";
    
    // 检查是否有工具调用
    const toolCalls: ToolCall[] = [];
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const tc of message.tool_calls) {
        toolCalls.push({
          id: tc.function?.name || `call_${Date.now()}`,
          name: tc.function?.name || "",
          arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
        });
      }
    }

    return {
      content,
      toolCalls,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
      finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
    };
  }

  private estimateTokens(text: string): number {
    // 简单估算：中文约1字符/token，英文约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars + otherChars / 4);
  }
}

export const createOllamaClient = (config: OllamaClientConfig): OllamaClient => {
  return new OllamaClient(config);
};
