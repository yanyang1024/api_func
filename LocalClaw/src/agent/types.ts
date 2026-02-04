import type { Message, ToolResult } from "../context/index.js";

// ============ Agent 参数 ============

export interface AgentParams {
  sessionId: string;
  sessionKey: string;
  prompt: string;
  images?: string[];
  timeout?: number;
  thinkLevel?: "off" | "on" | "stream";
}

// ============ 工具系统 ============

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (
    params: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolResult>;
}

export interface ToolContext {
  sessionId: string;
  sessionKey: string;
  workspace?: string;
  config: unknown;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  error?: string;
}

// ============ Agent 结果 ============

export interface AgentRunResult {
  success: boolean;
  content: string;
  toolResults?: ToolResult[];
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    model?: string;
  };
  error?: string;
}

// ============ Agent 配置 ============

export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  tools?: string[];
}

// ============ Provider 接口 ============

export interface LLMProvider {
  name: string;

  complete(params: {
    messages: Message[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<{
    content: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;

  stream(params: {
    messages: Message[];
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): AsyncIterable<{
    delta: string;
    done: boolean;
  }>;
}

// ============ 事件系统 ============

export type EventType =
  | "agent:start"
  | "agent:end"
  | "agent:error"
  | "tool:start"
  | "tool:end"
  | "tool:error"
  | "message:delta"
  | "message:done";

export interface EventData {
  runId: string;
  type: EventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export type EventHandler = (event: EventData) => void;
