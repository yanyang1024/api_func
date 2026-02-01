// Agent核心类型定义

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  images?: string[];
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
  is_error?: boolean;
}

export interface AgentContext {
  sessionId: string;
  agentId: string;
  workspaceDir: string;
  messages: Message[];
  tools: AgentTool[];
  config: AgentRuntimeConfig;
}

export interface AgentRuntimeConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  availableTools: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: ToolParameters;
  handler: ToolHandler;
  category: ToolCategory;
}

export interface ToolParameters {
  type: "object";
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: string;
  description: string;
  default?: unknown;
  enum?: string[];
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: AgentContext
) => Promise<ToolResult>;

export type ToolCategory = 
  | "file"        // 文件操作
  | "database"    // 数据库查询
  | "api"         // API调用
  | "search"      // 搜索服务
  | "system"      // 系统操作
  | "notification" // 通知服务
  | "task"        // 任务管理
  | "code";       // 代码执行

export interface AgentResult {
  content: string;
  toolCalls: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "tool_calls" | "length" | "error";
}

export interface SessionInfo {
  id: string;
  agentId: string;
  createdAt: number;
  lastActiveAt: number;
  messageCount: number;
  workspaceDir: string;
}

export interface ServiceEndpoint {
  name: string;
  baseUrl: string;
  methods: string[];
  auth?: ServiceAuth;
}

export interface ServiceAuth {
  type: "none" | "basic" | "bearer" | "api_key";
  credentials: Record<string, string>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export interface SearchQuery {
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface TaskInfo {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  assignee?: string;
  dueDate?: number;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPayload {
  type: "email" | "sms" | "push" | "webhook";
  recipients: string[];
  subject: string;
  content: string;
  priority?: "low" | "normal" | "high" | "urgent";
}
