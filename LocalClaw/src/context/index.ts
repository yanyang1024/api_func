// ============ 类型定义 ============

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  output: unknown;
  success: boolean;
  error?: string;
}

export interface Session {
  id: string;
  key: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface SessionConfig {
  maxTurns: number;
  contextWindow: number;
  enableCompression: boolean;
}

// ============ 历史管理 ============

export function limitHistoryTurns(
  messages: Message[],
  limit: number
): Message[] {
  if (!limit || limit <= 0 || messages.length === 0) {
    return messages;
  }

  let userCount = 0;
  let lastUserIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount > limit) {
        return messages.slice(lastUserIndex);
      }
      lastUserIndex = i;
    }
  }

  return messages;
}

export function sanitizeMessages(
  messages: Message[],
  config: SessionConfig
): Message[] {
  // 1. 移除过时的工具调用
  const sanitized = messages.map((msg) => {
    if (msg.toolCalls && msg.role === "assistant") {
      return {
        ...msg,
        toolCalls: msg.toolCalls.slice(-5), // 只保留最近5个
      };
    }
    return msg;
  });

  // 2. 移除空的工具结果
  const filtered = sanitized.filter((msg) => {
    if (msg.role === "tool") {
      return msg.content && msg.content.length > 0;
    }
    return true;
  });

  // 3. 限制轮次
  return limitHistoryTurns(filtered, config.maxTurns);
}

// ============ Token 估算 ============

export function estimateTokens(text: string): number {
  // 简单估算：中文约 2 tokens/字，英文约 4 chars/token
  // 实际应使用 tokenizer
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return chineseChars + Math.ceil(otherChars / 4);
}

export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    let tokens = estimateTokens(msg.content);

    // 工具调用消耗更多 tokens
    if (msg.toolCalls) {
      tokens += msg.toolCalls.length * 100;
    }

    // 工具结果也消耗 tokens
    if (msg.toolResults) {
      for (const result of msg.toolResults) {
        tokens += estimateTokens(
          JSON.stringify(result.output || "")
        );
      }
    }

    return total + tokens;
  }, 0);
}

// ============ 上下文窗口检查 ============

export interface ContextWindowInfo {
  totalTokens: number;
  limit: number;
  usagePercent: number;
  isOverflow: boolean;
  warning: boolean;
}

export function checkContextWindow(
  messages: Message[],
  limit: number
): ContextWindowInfo {
  const totalTokens = estimateMessagesTokens(messages);
  const usagePercent = (totalTokens / limit) * 100;

  return {
    totalTokens,
    limit,
    usagePercent,
    isOverflow: totalTokens > limit,
    warning: usagePercent > 80,
  };
}

// ============ 会话管理 ============

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private config: SessionConfig;

  constructor(config?: Partial<SessionConfig>) {
    this.config = {
      maxTurns: config?.maxTurns || 50,
      contextWindow: config?.contextWindow || 131072,
      enableCompression: config?.enableCompression ?? true,
    };
  }

  createSession(key: string, metadata?: Record<string, unknown>): Session {
    const session: Session = {
      id: crypto.randomUUID(),
      key,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    };

    this.sessions.set(key, session);
    return session;
  }

  getSession(key: string): Session | undefined {
    return this.sessions.get(key);
  }

  addMessage(sessionKey: string, message: Message): void {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();

    // 自动清理
    session.messages = sanitizeMessages(session.messages, this.config);
  }

  getMessages(sessionKey: string): Message[] {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    return session.messages;
  }

  clearSession(sessionKey: string): void {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
    }
  }

  deleteSession(sessionKey: string): boolean {
    return this.sessions.delete(sessionKey);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getContextStatus(sessionKey: string): ContextWindowInfo {
    const session = this.sessions.get(sessionKey);
    if (!session) {
      throw new Error(`Session not found: ${sessionKey}`);
    }

    return checkContextWindow(session.messages, this.config.contextWindow);
  }
}
