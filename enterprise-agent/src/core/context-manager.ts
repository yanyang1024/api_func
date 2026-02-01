import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Message, AgentContext } from "../types.js";
import { getEmbedding } from "./embedding.js";

export interface ContextConfig {
  maxTokens: number;
  maxHistory: number;
  compressionThreshold: number;
  reserveTokens: number;
}

export interface ContextStats {
  totalTokens: number;
  messageCount: number;
  isCompressed: boolean;
  lastSummary?: string;
}

export class ContextManager {
  private config: ContextConfig;
  private sessionDir: string;

  constructor(config: ContextConfig, sessionDir: string) {
    this.config = config;
    this.sessionDir = sessionDir;
  }

  async initializeSession(sessionId: string, systemPrompt: string): Promise<Message[]> {
    await fs.mkdir(path.join(this.sessionDir, sessionId), { recursive: true });
    
    return [
      {
        role: "system",
        content: systemPrompt,
        timestamp: Date.now(),
      },
    ];
  }

  async loadContext(sessionId: string): Promise<Message[]> {
    const contextFile = path.join(this.sessionDir, sessionId, "context.json");
    
    try {
      const content = await fs.readFile(contextFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  async saveContext(sessionId: string, messages: Message[]): Promise<void> {
    const contextFile = path.join(this.sessionDir, sessionId, "context.json");
    await fs.writeFile(contextFile, JSON.stringify(messages, null, 2));
  }

  async addMessage(
    sessionId: string,
    message: Message,
    messages: Message[]
  ): Promise<Message[]> {
    const updatedMessages = [...messages, message];
    
    // 检查是否需要压缩
    const tokenCount = this.estimateTokenCount(updatedMessages);
    
    if (tokenCount > this.config.maxTokens - this.config.reserveTokens) {
      // 执行压缩
      const compressedMessages = await this.compressContext(
        updatedMessages,
        this.config.maxTokens - this.config.reserveTokens
      );
      await this.saveContext(sessionId, compressedMessages);
      return compressedMessages;
    }

    // 限制历史消息数量
    const limitedMessages = this.limitHistory(updatedMessages);
    await this.saveContext(sessionId, limitedMessages);
    return limitedMessages;
  }

  async compressContext(
    messages: Message[],
    maxTokens: number
  ): Promise<Message[]> {
    // 保留系统提示
    const systemMessages = messages.filter(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");

    if (conversationMessages.length === 0) {
      return messages;
    }

    // 估算需要压缩的历史
    let currentTokens = this.estimateTokenCount(systemMessages);
    const compressedMessages: Message[] = [...systemMessages];

    // 从后向前保留最近的对话
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = this.estimateTokenCount([msg]);

      if (currentTokens + msgTokens > maxTokens) {
        // 需要压缩这个位置之前的所有消息
        break;
      }

      compressedMessages.unshift(msg);
      currentTokens += msgTokens;
    }

    // 如果还有空间被压缩的消息，生成摘要
    if (compressedMessages.length < messages.length) {
      const summaryMessage = await this.generateSummary(
        conversationMessages.slice(0, compressedMessages.length - 1)
      );
      
      // 在系统消息后插入摘要
      compressedMessages.splice(1, 0, {
        role: "user",
        content: `[历史摘要] ${summaryMessage}`,
        timestamp: Date.now(),
      });
    }

    return compressedMessages;
  }

  private async generateSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) {
      return "无历史对话";
    }

    const conversationText = messages
      .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
      .join("\n");

    return `以下是之前对话的摘要，包含${messages.length}条消息。关键主题和决策已总结。`;
  }

  limitHistory(messages: Message[], maxTurns?: number): Message[] {
    const limit = maxTurns || this.config.maxHistory * 2; // user + assistant pairs
    
    const systemMessages = messages.filter(m => m.role === "system");
    const otherMessages = messages.filter(m => m.role !== "system");

    if (otherMessages.length <= limit) {
      return messages;
    }

    return [...systemMessages, ...otherMessages.slice(-limit)];
  }

  getStats(messages: Message[]): ContextStats {
    const tokenCount = this.estimateTokenCount(messages);
    
    return {
      totalTokens: tokenCount,
      messageCount: messages.length,
      isCompressed: messages.some(m => m.content.includes("[历史摘要]")),
    };
  }

  estimateTokenCount(messages: Message[]): number {
    let total = 0;

    for (const msg of messages) {
      total += this.estimateMessageTokens(msg);
    }

    return total;
  }

  private estimateMessageTokens(message: Message): number {
    const baseCount = message.content.length;
    
    // 考虑工具调用的额外开销
    if (message.tool_calls) {
      return baseCount + message.tool_calls.length * 100;
    }
    
    if (message.tool_results) {
      return baseCount + message.tool_results.length * 50;
    }

    // 中文约1字符/token，英文约4字符/token
    const chineseChars = (message.content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = baseCount - chineseChars;
    
    return Math.ceil(chineseChars + otherChars / 4);
  }

  async createSummary(
    messages: Message[],
    systemPrompt: string
  ): Promise<string> {
    const recentMessages = messages.slice(-10); // 最近10条消息
    const conversation = recentMessages
      .filter(m => m.role !== "system")
      .map(m => `${m.role}: ${m.content}`)
      .join("\n");

    return `对话摘要:\n${conversation}`;
  }

  async clearContext(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionDir, sessionId);
    
    try {
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  }
}

export const createContextManager = (
  maxTokens: number = 32768,
  maxHistory: number = 20,
  sessionDir: string
): ContextManager => {
  return new ContextManager(
    {
      maxTokens,
      maxHistory,
      compressionThreshold: maxTokens * 0.8,
      reserveTokens: 2048,
    },
    sessionDir
  );
};
