/**
 * 本地 AI Agent 核心运行器
 *
 * ==================== 教学说明 ====================
 *
 * 什么是 Agent？
 * ---------------
 * Agent 是一个能够：
 * 1. 理解用户意图
 * 2. 制定执行计划
 * 3. 调用工具完成任务
 * 4. 处理工具结果
 * 5. 生成最终回复
 *
 * Agent vs 传统聊天机器人：
 * ---------------
 * 传统聊天机器人：只能生成文本
 * Agent：可以执行动作（调用工具、读写文件、运行命令等）
 *
 * Agent 工作流程：
 * ---------------
 * 1. 接收用户消息
 * 2. 构建上下文（系统提示词 + 历史消息）
 * 3. 调用 LLM 生成响应
 * 4. 如果 LLM 想要调用工具：
 *    a. 解析工具调用请求
 *    b. 执行工具
 *    c. 将工具结果返回给 LLM
 *    d. 重复步骤 3-4，直到 LLM 不再调用工具
 * 5. 返回最终回复
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { OllamaProvider } from '../providers/ollama.js';
import { SessionManager } from './session.js';
import { ContextBuilder } from '../prompts/context.js';
import { ToolRegistry } from '../tools/registry.js';
import { globalQueue } from './queue.js';

/**
 * 本地 Agent 类
 */
export class LocalAgent {
  /** @type {Object} 配置对象 */
  config;

  /** @type {OllamaProvider} LLM 提供商 */
  provider;

  /** @type {Map<string, SessionManager>} 会话管理器映射 */
  sessions;

  /** @type {ToolRegistry} 工具注册表 */
  tools;

  /** @type {ContextBuilder} 上下文构建器 */
  contextBuilder;

  /** @type {boolean} 是否已初始化 */
  initialized;

  /**
   * 初始化 Agent
   * @param {Object} options
   * @param {string} [options.configPath='./config/agent.yaml'] - 配置文件路径
   */
  async initialize(options = {}) {
    const configPath = options.configPath || './config/agent.yaml';

    console.log('========================================');
    console.log('  Local Agent - Initializing...');
    console.log('========================================\n');

    // 1. 加载配置
    console.log('[1/6] Loading configuration...');
    this.config = await this.loadConfig(configPath);
    console.log(`      ✓ Config loaded from ${configPath}`);

    // 2. 初始化 LLM Provider
    console.log('[2/6] Initializing LLM provider...');
    this.provider = new OllamaProvider({
      baseUrl: this.config.agent.model.baseUrl,
      model: this.config.agent.model.name,
      temperature: this.config.agent.model.temperature,
    });

    // 测试连接
    const connected = await this.provider.testConnection();
    if (!connected) {
      throw new Error(
        `Cannot connect to Ollama at ${this.config.agent.model.baseUrl}. ` +
        'Make sure Ollama is running: https://ollama.ai'
      );
    }
    console.log(`      ✓ Connected to Ollama: ${this.config.agent.model.name}`);

    // 3. 初始化工具注册表
    console.log('[3/6] Registering tools...');
    this.tools = new ToolRegistry(this.config);
    await this.tools.registerCoreTools();
    await this.tools.registerLocalServiceTools();
    console.log(`      ✓ Registered ${this.tools.getAvailableNames().length} tools`);

    // 4. 初始化上下文构建器
    console.log('[4/6] Initializing context builder...');
    this.contextBuilder = new ContextBuilder({
      workspace: this.config.agent.workspace,
      config: this.config,
    });
    console.log(`      ✓ Workspace: ${this.config.agent.workspace}`);

    // 5. 初始化会话存储
    console.log('[5/6] Initializing session storage...');
    this.sessions = new Map();
    await fs.mkdir('./sessions', { recursive: true });
    console.log(`      ✓ Session storage: ./sessions/`);

    // 6. 创建工作区
    console.log('[6/6] Creating workspace...');
    await this.createWorkspace();
    console.log('      ✓ Workspace ready');

    this.initialized = true;

    console.log('\n========================================');
    console.log('  Initialization Complete!');
    console.log('========================================\n');
  }

  /**
   * 加载配置文件
   * @param {string} configPath - 配置文件路径
   * @returns {Promise<Object>}
   */
  async loadConfig(configPath) {
    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return yaml.load(content);
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  /**
   * 创建工作区结构
   */
  async createWorkspace() {
    const dirs = [
      this.config.agent.workspace,
      path.join(this.config.agent.workspace, 'skills'),
      path.join(this.config.agent.workspace, 'memory'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // 创建示例 CLAUDE.md 如果不存在
    const claudePath = path.join(this.config.agent.workspace, 'CLAUDE.md');
    try {
      await fs.access(claudePath);
    } catch {
      await fs.writeFile(
        claudePath,
        `# Project Instructions

This is a placeholder for project-specific instructions for the AI assistant.

## Examples

You can use this file to:
- Define coding standards
- Specify project structure
- Set up conventions
- Document workflows

## How to Use

Edit this file to provide context and instructions for the AI assistant.
`,
        'utf-8'
      );
    }
  }

  /**
   * 运行 Agent
   *
   * ==================== 教学说明 ====================
   *
   * 这是 Agent 的主入口方法，执行完整的推理循环。
   *
   * @param {Object} params
   * @param {string} params.sessionId - 会话 ID
   * @param {string} params.message - 用户消息
   * @param {string} [params.thinking] - 推理级别（覆盖默认值）
   * @param {string[]} [params.images] - 图片列表
   * @returns {Promise<string>} Agent 的最终回复
   */
  async run(params) {
    if (!this.initialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { sessionId, message, thinking, images } = params;

    console.log(`\n[Agent] New request in session "${sessionId}"`);
    console.log(`[Agent] Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

    // 使用队列确保同一会话的请求串行执行
    return globalQueue.enqueue(sessionId, async () => {
      return this.runInferenceLoop({
        sessionId,
        message,
        thinking: thinking || this.config.agent.thinking.default,
        images,
      });
    });
  }

  /**
   * 推理循环（Agent 的核心逻辑）
   *
   * ==================== 教学说明 ====================
   *
   * 推理循环的工作流程：
   * ---------------
   * 1. 获取或创建会话
   * 2. 检查上下文窗口，必要时压缩
   * 3. 构建系统提示词
   * 4. 添加用户消息到会话
   * 5. 调用 LLM
   * 6. 如果 LLM 调用工具：
   *    a. 执行工具
   *    b. 将结果添加到会话
   *    c. 返回步骤 5
   * 7. 否则，返回最终回复
   *
   * @param {Object} params
   * @param {string} params.sessionId
   * @param {string} params.message
   * @param {string} params.thinking
   * @param {string[]} [params.images]
   * @returns {Promise<string>}
   */
  async runInferenceLoop(params) {
    const { sessionId, message, thinking, images } = params;

    // 1. 获取或创建会话
    let session = this.sessions.get(sessionId);
    if (!session) {
      const sessionFile = `./sessions/${sessionId}.jsonl`;
      session = new SessionManager({
        sessionId,
        storePath: sessionFile,
        contextWindow: this.config.agent.model.contextWindow,
      });
      await session.load();
      this.sessions.set(sessionId, session);
    }

    // 2. 检查上下文窗口
    const contextCheck = session.checkContextWindow();
    if (contextCheck.exceeded) {
      console.log(`[Agent] Context window exceeded (${(contextCheck.usage * 100).toFixed(1)}%), compacting...`);
      await session.compact({
        provider: this.provider,
        systemPrompt: '', // 将在下一步构建
      });
    }

    // 3. 构建系统提示词
    const systemPrompt = await this.contextBuilder.build({
      mode: 'full',
      toolNames: this.tools.getAvailableNames(),
      thinkingLevel: thinking,
    });

    // 4. 添加用户消息
    await session.addMessage({
      role: 'user',
      content: message,
      images,
    });

    // 5-7. 推理循环
    const maxIterations = 10; // 防止无限循环
    let iteration = 0;
    let finalResponse = '';

    while (iteration < maxIterations) {
      iteration++;

      // 获取消息历史
      const messages = await session.getMessages();

      console.log(`[Agent] Iteration ${iteration}: ${messages.length} messages, ${session.estimatedTokens} tokens`);

      // 调用 LLM
      let fullContent = '';
      let toolCalls = [];

      try {
        for await (const chunk of this.provider.chat({
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          tools: this.tools.toLLMFormat(),
          stream: true,
        })) {
          if (chunk.content) {
            fullContent += chunk.content;
            finalResponse = fullContent; // 实时更新
            process.stdout.write('.'); // 显示进度
          }

          if (chunk.toolCalls) {
            toolCalls.push(...chunk.toolCalls);
          }

          if (chunk.done) {
            process.stdout.write('\n');
            break;
          }
        }
      } catch (error) {
        console.error(`[Agent] LLM error: ${error}`);
        throw error;
      }

      // 添加助手响应
      await session.addMessage({
        role: 'assistant',
        content: fullContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });

      // 如果没有工具调用，返回响应
      if (toolCalls.length === 0) {
        console.log(`[Agent] Final response: ${fullContent.substring(0, 100)}...`);
        return fullContent;
      }

      // 执行工具调用
      console.log(`[Agent] Executing ${toolCalls.length} tool(s)...`);

      for (const call of toolCalls) {
        const toolName = call.function?.name || call.name;
        const toolArgs = typeof call.function?.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function?.arguments || call.arguments;

        console.log(`[Agent]   - ${toolName}`);

        try {
          const result = await this.tools.execute(toolName, toolArgs);

          // 添加工具结果
          await session.addMessage({
            role: 'tool',
            content: result,
            toolCallId: call.id,
          });
        } catch (error) {
          // 添加错误结果
          await session.addMessage({
            role: 'tool',
            content: `Error: ${error.message}`,
            toolCallId: call.id,
          });
        }
      }

      // 继续循环，让 LLM 基于工具结果生成最终回复
    }

    throw new Error('Agent exceeded maximum iterations');
  }

  /**
   * 获取会话统计信息
   * @param {string} sessionId
   * @returns {Object}
   */
  getSessionStats(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return session.getStats();
  }

  /**
   * 清空会话
   * @param {string} sessionId
   */
  async clearSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.clear();
    }
  }

  /**
   * 列出所有会话
   * @returns {string[]}
   */
  listSessions() {
    return Array.from(this.sessions.keys());
  }
}
