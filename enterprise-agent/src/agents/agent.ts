import { Message, AgentContext, AgentResult, ToolCall, ToolResult } from "./core/types.js";
import { OllamaClient, createOllamaClient } from "./core/ollama-client.js";
import { ContextManager, createContextManager } from "./core/context-manager.js";
import { SessionManager, createSessionManager } from "./core/session-manager.js";
import { ToolManager, createToolManager } from "./tools/tool-manager.js";
import { ServiceRegistry, createServiceRegistry } from "./services/registry.js";
import { ConfigLoader, getConfig } from "./config/index.js";

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentRunOptions {
  sessionId?: string;
  stream?: boolean;
  onChunk?: (chunk: string) => void;
}

export class Agent {
  private config: AgentConfig;
  private ollama: OllamaClient;
  private contextManager: ContextManager;
  private sessionManager: SessionManager;
  private toolManager: ToolManager;
  private serviceRegistry: ServiceRegistry;

  constructor(
    config: AgentConfig,
    dependencies: {
      ollama: OllamaClient;
      contextManager: ContextManager;
      sessionManager: SessionManager;
      toolManager: ToolManager;
      serviceRegistry: ServiceRegistry;
    }
  ) {
    this.config = config;
    this.ollama = dependencies.ollama;
    this.contextManager = dependencies.contextManager;
    this.sessionManager = dependencies.sessionManager;
    this.toolManager = dependencies.toolManager;
    this.serviceRegistry = dependencies.serviceRegistry;
  }

  async run(userInput: string, options: AgentRunOptions = {}): Promise<AgentResult> {
    const sessionId = options.sessionId || `session_${Date.now()}`;
    
    // 获取或创建会话
    let session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      session = await this.sessionManager.createSession(
        this.config.id,
        `./workspace/${sessionId}`
      );
      // 添加系统提示
      const systemMessage: Message = {
        role: "system",
        content: this.config.systemPrompt,
        timestamp: Date.now(),
      };
      await this.sessionManager.addMessage(sessionId, systemMessage);
    }

    // 加载会话消息
    let messages = await this.sessionManager.getMessages(sessionId);

    // 添加用户消息
    const userMessage: Message = {
      role: "user",
      content: userInput,
      timestamp: Date.now(),
    };
    messages.push(userMessage);
    await this.sessionManager.addMessage(sessionId, userMessage);

    // 构建Agent上下文
    const context: AgentContext = {
      sessionId,
      agentId: this.config.id,
      workspaceDir: session.workspaceDir,
      messages,
      tools: this.toolManager.getAll().map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters as any,
        handler: () => Promise.resolve({ content: "" }),
        category: t.category,
      })),
      config: {
        model: this.config.model || "default",
        temperature: this.config.temperature || 0.7,
        maxTokens: this.config.maxTokens || 4096,
        systemPrompt: this.config.systemPrompt,
        availableTools: this.toolManager.getAll().map(t => t.name),
      },
    };

    // 主循环：处理工具调用
    let maxIterations = 10;
    let currentMessages = [...messages];
    let finalContent = "";

    while (maxIterations > 0) {
      maxIterations--;

      // 调用LLM
      const result = await this.ollama.chat(currentMessages, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });

      // 如果没有工具调用，直接返回
      if (result.toolCalls.length === 0) {
        finalContent = result.content;
        
        // 添加助手消息
        const assistantMessage: Message = {
          role: "assistant",
          content: result.content,
          timestamp: Date.now(),
        };
        currentMessages.push(assistantMessage);
        await this.sessionManager.addMessage(sessionId, assistantMessage);
        
        break;
      }

      // 处理工具调用
      const toolResults: ToolResult[] = [];

      for (const toolCall of result.toolCalls) {
        // 添加助手消息（包含工具调用）
        const assistantMessage: Message = {
          role: "assistant",
          content: result.content,
          timestamp: Date.now(),
          tool_calls: [toolCall],
        };
        currentMessages.push(assistantMessage);

        // 执行工具
        const execResult = await this.toolManager.execute(
          toolCall.name,
          toolCall.arguments,
          context
        );

        const toolResult: ToolResult = {
          tool_call_id: toolCall.id,
          content: execResult.content,
          is_error: !execResult.success,
        };
        toolResults.push(toolResult);

        // 添加工具结果消息
        const resultMessage: Message = {
          role: "user",
          content: "",  // 工具结果在tool_results中
          timestamp: Date.now(),
          tool_results: [toolResult],
        };
        currentMessages.push(resultMessage);
      }

      // 更新会话消息
      await this.sessionManager.setMessages(sessionId, currentMessages);
    }

    // 更新消息计数
    session = await this.sessionManager.getSession(sessionId);
    if (session) {
      await this.sessionManager.updateMetadata(sessionId, {
        summary: finalContent.substring(0, 200),
      });
    }

    return {
      content: finalContent,
      toolCalls: [],
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      finishReason: "stop",
    };
  }

  async runStream(userInput: string, options: AgentRunOptions = {}): Promise<string> {
    // 流式版本实现
    return "";
  }

  async getSessionHistory(sessionId: string): Promise<Message[]> {
    return this.sessionManager.getMessages(sessionId);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.sessionManager.deleteSession(sessionId);
  }

  async listSessions(): Promise<Array<{ id: string; lastActiveAt: number; messageCount: number }>> {
    const sessions = await this.sessionManager.listSessions(this.config.id);
    return sessions.map(s => ({
      id: s.id,
      lastActiveAt: s.lastActiveAt,
      messageCount: s.messageCount,
    }));
  }
}

export interface AgentFactoryOptions {
  configPath?: string;
}

export class AgentFactory {
  private ollama: OllamaClient | null = null;
  private contextManager: ContextManager | null = null;
  private sessionManager: SessionManager | null = null;
  private toolManager: ToolManager | null = null;
  private serviceRegistry: ServiceRegistry | null = null;

  async initialize(options: AgentFactoryOptions = {}): Promise<void> {
    const config = await new ConfigLoader(options.configPath).load();
    const cfg = getConfig();

    // 初始化Ollama客户端
    this.ollama = createOllamaClient({
      host: cfg.ollama.host,
      model: cfg.ollama.model,
      embedModel: cfg.ollama.embedModel,
      timeout: cfg.ollama.timeout,
    });

    // 初始化目录
    const dataDir = cfg.storage.dataDir;
    const sessionDir = cfg.storage.sessionDir;
    
    // 初始化上下文管理器
    this.contextManager = createContextManager(
      cfg.ollama.contextWindow || 32768,
      20,
      sessionDir
    );

    // 初始化会话管理器
    this.sessionManager = createSessionManager(sessionDir);
    await this.sessionManager.initialize();

    // 初始化服务注册表
    this.serviceRegistry = createServiceRegistry({
      file: {
        baseDir: path.join(dataDir, "files"),
        maxFileSize: cfg.security.maxFileSize,
        allowedExtensions: [".txt", ".md", ".json", ".yaml", ".js", ".py"],
      },
      task: {
        storagePath: path.join(dataDir, "tasks"),
      },
      search: {
        type: "local",
        index: "documents",
      },
      notification: {
        type: "log",
      },
    });
    await this.serviceRegistry.initializeAll();

    // 初始化工具管理器
    this.toolManager = createToolManager({
      serviceRegistry: this.serviceRegistry,
      workspaceDir: "./workspace",
    });

    console.log("Agent工厂初始化完成");
  }

  createAgent(config: AgentConfig): Agent {
    if (!this.ollama || !this.contextManager || !this.sessionManager || !this.toolManager || !this.serviceRegistry) {
      throw new Error("Agent工厂未初始化");
    }

    return new Agent(config, {
      ollama: this.ollama,
      contextManager: this.contextManager,
      sessionManager: this.sessionManager,
      toolManager: this.toolManager,
      serviceRegistry: this.serviceRegistry,
    });
  }

  async checkOllamaStatus(): Promise<boolean> {
    return this.ollama?.isAvailable() || false;
  }

  async getAvailableModels(): Promise<{ name: string; size: number }[]> {
    return this.ollama?.getModelInfo() || [];
  }

  async shutdown(): Promise<void> {
    await this.serviceRegistry?.closeAll();
  }
}

import * as path from "node:path";

export const createAgentFactory = async (options: AgentFactoryOptions = {}): Promise<AgentFactory> => {
  const factory = new AgentFactory();
  await factory.initialize(options);
  return factory;
};
