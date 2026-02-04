import type {
  AgentParams,
  AgentRunResult,
  EventData,
  EventHandler,
  LLMProvider,
  Message,
  Tool,
  ToolResult,
} from "./types.js";
import {
  SessionManager,
  limitHistoryTurns,
  estimateMessagesTokens,
  checkContextWindow,
} from "../context/index.js";
import type { Config } from "../config/index.js";

// ============ Agent 核心 ============

export class LocalAgent {
  private provider: LLMProvider;
  private sessionManager: SessionManager;
  private tools: Map<string, Tool> = new Map();
  private eventHandlers: Set<EventHandler> = new Set();
  private config: Config;

  constructor(
    provider: LLMProvider,
    sessionManager: SessionManager,
    config: Config
  ) {
    this.provider = provider;
    this.sessionManager = sessionManager;
    this.config = config;
  }

  // ============ 工具管理 ============

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // ============ 事件系统 ============

  onEvent(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: Omit<EventData, "runId" | "timestamp">): void {
    const fullEvent: EventData = {
      ...event,
      runId: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(fullEvent);
      } catch (error) {
        console.error("Event handler error:", error);
      }
    }
  }

  // ============ 主执行流程 ============

  async run(params: AgentParams): Promise<AgentRunResult> {
    const startTime = Date.now();
    const runId = crypto.randomUUID();

    // 初始化或获取会话
    let session = this.sessionManager.getSession(params.sessionKey);
    if (!session) {
      session = this.sessionManager.createSession(params.sessionKey, {
        model: this.config.ollama.model,
      });
    }

    try {
      // 1. 发送开始事件
      this.emit({
        type: "agent:start",
        data: {
          sessionId: params.sessionId,
          prompt: params.prompt,
        },
      });

      // 2. 构建消息
      const userMessage: Message = {
        role: "user",
        content: params.prompt,
        timestamp: Date.now(),
      };

      this.sessionManager.addMessage(params.sessionKey, userMessage);

      // 3. 获取历史消息
      let messages = this.sessionManager.getMessages(params.sessionKey);

      // 4. 检查上下文窗口
      const ctxStatus = checkContextWindow(
        messages,
        this.config.ollama.contextWindow
      );

      if (ctxStatus.isOverflow) {
        // 尝试压缩
        const compacted = await this.compactSession(params.sessionKey);
        if (!compacted) {
          return {
            success: false,
            content: "",
            error: `上下文溢出 (${ctxStatus.totalTokens}/${ctxStatus.limit} tokens)。请减少输入或开启上下文压缩。`,
          };
        }
        messages = this.sessionManager.getMessages(params.sessionKey);
      }

      // 5. 构建系统提示
      const systemPrompt = this.buildSystemPrompt();

      // 6. 执行 Agent 循环
      const result = await this.agentLoop({
        runId,
        sessionKey: params.sessionKey,
        messages,
        systemPrompt,
        timeout: params.timeout || this.config.agent.defaultTimeout,
        thinkLevel: params.thinkLevel || "off",
      });

      // 7. 记录工具结果
      if (result.toolResults && result.toolResults.length > 0) {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "assistant") {
          lastMessage.toolResults = result.toolResults;
        }
      }

      // 8. 发送完成事件
      this.emit({
        type: "agent:end",
        data: {
          success: result.success,
          duration: Date.now() - startTime,
        },
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration: Date.now() - startTime,
          model: this.config.ollama.model,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.emit({
        type: "agent:error",
        data: {
          error: errorMessage,
        },
      });

      return {
        success: false,
        content: "",
        error: errorMessage,
      };
    }
  }

  // ============ Agent 循环 ============

  private async agentLoop(params: {
    runId: string;
    sessionKey: string;
    messages: Message[];
    systemPrompt: string;
    timeout: number;
    thinkLevel: "off" | "on" | "stream";
  }): Promise<AgentRunResult> {
    let messages = [...params.messages];
    const toolResults: ToolResult[] = [];
    const maxIterations = 20;
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      // 调用 LLM
      const response = await this.callLLM({
        messages,
        systemPrompt: params.systemPrompt,
      });

      // 添加助手消息
      const assistantMessage: Message = {
        role: "assistant",
        content: response.content,
        timestamp: Date.now(),
      };

      messages.push(assistantMessage);

      // 检查是否有工具调用
      const toolCalls = this.parseToolCalls(response.content);

      if (toolCalls.length === 0) {
        // 没有工具调用，返回结果
        return {
          success: true,
          content: response.content,
          toolResults,
        };
      }

      // 执行工具调用
      const callResults = await this.executeTools({
        runId: params.runId,
        sessionKey: params.sessionKey,
        calls: toolCalls,
      });

      toolResults.push(...callResults);

      // 添加工具结果到消息
      for (const callResult of callResults) {
        const toolMessage: Message = {
          role: "tool",
          content: typeof callResult.output === "string"
            ? callResult.output
            : JSON.stringify(callResult.output),
          timestamp: Date.now(),
          toolResults: [callResult],
        };
        messages.push(toolMessage);
      }

      // 发送消息完成事件
      this.emit({
        type: "message:done",
        data: {
          hasTools: toolCalls.length > 0,
        },
      });
    }

    return {
      success: false,
      content: messages[messages.length - 1]?.content || "",
      toolResults,
      error: "达到最大迭代次数",
    };
  }

  // ============ LLM 调用 ============

  private async callLLM(params: {
    messages: Message[];
    systemPrompt: string;
  }): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
    // 转换消息格式
    const apiMessages = params.messages.map((msg) => {
      if (msg.role === "system") {
        return { role: "system", content: msg.content };
      }
      if (msg.role === "tool") {
        return {
          role: "user",
          content: `[Tool Result] ${msg.content}`,
        };
      }
      return { role: msg.role, content: msg.content };
    });

    return this.provider.complete({
      messages: apiMessages as Message[],
      model: this.config.ollama.model,
      systemPrompt: params.systemPrompt,
    });
  }

  // ============ 工具调用解析 ============

  private parseToolCalls(content: string): Array<{
    name: string;
    input: Record<string, unknown>;
  }> {
    // 简单解析 XML 格式的工具调用
    const toolCallRegex = /<tool_calls>([\s\S]*?)<\/tool_calls>/g;
    const calls: Array<{ name: string; input: Record<string, unknown> }> = [];

    let match;
    while ((match = toolCallRegex.exec(content)) !== null) {
      try {
        const callData = JSON.parse(match[1]);
        if (Array.isArray(callData)) {
          for (const call of callData) {
            if (call.name && call.arguments) {
              calls.push({
                name: call.name,
                input: call.arguments,
              });
            }
          }
        }
      } catch {
        // 解析失败，忽略
      }
    }

    return calls;
  }

  // ============ 工具执行 ============

  private async executeTools(params: {
    runId: string;
    sessionKey: string;
    calls: Array<{ name: string; input: Record<string, unknown> }>;
  }): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of params.calls) {
      const tool = this.getTool(call.name);

      this.emit({
        type: "tool:start",
        data: {
          toolName: call.name,
          input: call.input,
        },
      });

      if (!tool) {
        const result: ToolResult = {
          success: false,
          output: null,
          error: `Unknown tool: ${call.name}`,
        };
        results.push(result);

        this.emit({
          type: "tool:error",
          data: { toolName: call.name, error: result.error },
        });
        continue;
      }

      try {
        const result = await tool.execute(call.input, {
          sessionId: params.sessionKey,
          sessionKey: params.sessionKey,
          config: this.config,
        });

        results.push(result);

        this.emit({
          type: "tool:end",
          data: { toolName: call.name, success: result.success },
        });
      } catch (error) {
        const result: ToolResult = {
          success: false,
          output: null,
          error: error instanceof Error ? error.message : String(error),
        };
        results.push(result);

        this.emit({
          type: "tool:error",
          data: { toolName: call.name, error: result.error },
        });
      }
    }

    return results;
  }

  // ============ 上下文压缩 ============

  private async compactSession(sessionKey: string): Promise<boolean> {
    const messages = this.sessionManager.getMessages(sessionKey);

    // 保留最近 5 轮对话
    const recentMessages = limitHistoryTurns(messages, 5);

    // 摘要早期消息
    const earlyMessages = messages.slice(0, messages.length - recentMessages.length);

    if (earlyMessages.length === 0) {
      return false;
    }

    const earlySummary = await this.summarizeMessages(earlyMessages);

    // 清空并重建会话
    this.sessionManager.clearSession(sessionKey);

    // 添加摘要
    this.sessionManager.addMessage(sessionKey, {
      role: "system",
      content: `[历史摘要] ${earlySummary}`,
      timestamp: Date.now(),
    });

    // 添加最近消息
    for (const msg of recentMessages) {
      this.sessionManager.addMessage(sessionKey, msg);
    }

    return true;
  }

  private async summarizeMessages(messages: Message[]): Promise<string> {
    const text = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const response = await this.provider.complete({
      messages: [
        {
          role: "user",
          content: `请用简洁的中文总结以下对话的主要内容（100字以内）：\n\n${text}`,
        },
      ],
      model: this.config.ollama.model,
      maxTokens: 200,
    });

    return response.content;
  }

  // ============ 系统提示词 ============

  private buildSystemPrompt(): string {
    const toolDescriptions = this.getAllTools()
      .map(
        (t) =>
          `- ${t.name}: ${t.description}\n  输入: ${JSON.stringify(t.inputSchema.properties)}`
      )
      .join("\n");

    return `你是一个企业内网智能助手，帮助用户完成各种任务。

## 可用工具
${toolDescriptions}

## 使用规则
1. 当需要使用工具时，用以下格式调用：
<tool_calls>
[{"name": "工具名", "arguments": {"参数": "值"}}]
</tool_calls>

2. 工具调用会返回结果，请根据结果继续回答用户问题。
3. 如果工具调用失败，请尝试其他方法或告知用户。
4. 请始终用中文回答（除非用户要求用其他语言）。

## 内网环境
- 你可以访问企业内部的各种服务（HR、OA、文件服务器等）
- 请遵守企业的数据安全规范
- 不要泄露敏感信息`;
  }
}
