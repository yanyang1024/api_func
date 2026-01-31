/**
 * 会话管理器
 *
 * ==================== 教学说明 ====================
 *
 * 什么是会话（Session）？
 * ---------------
 * 会话是一次完整的对话记录，包含：
 * - 用户消息
 * - AI 助手的回复
 * - 工具调用记录
 * - 工具执行结果
 *
 * 为什么需要会话管理？
 * ---------------
 * 1. 保持对话上下文：LLM 需要看到历史消息才能理解上下文
 * 2. 持久化存储：将对话保存到文件，供后续查询和分析
 * 3. Token 计算：监控 token 使用，避免超过上下文窗口
 * 4. 自动压缩：当对话过长时，自动压缩历史消息
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 消息类型
 * @typedef {Object} Message
 * @property {string} role - 角色：user, assistant, tool, system
 * @property {string} content - 消息内容
 * @property {string} [toolCallId] - 工具调用 ID（仅 tool 消息）
 * @property {Array} [toolCalls] - 工具调用列表（仅 assistant 消息）
 * @property {Array} [images] - 图片列表（base64 或 URL）
 */

/**
 * 压缩结果类型
 * @typedef {Object} CompactionResult
 * @property {boolean} success - 是否成功
 * @property {number} originalMessages - 原始消息数
 * @property {number} compactedMessages - 压缩后消息数
 * @property {number} tokensSaved - 保存的 token 数
 */

export class SessionManager {
  /** @type {string} 会话 ID */
  sessionId;

  /** @type {string} 会话文件路径 */
  sessionFile;

  /** @type {number} 上下文窗口大小 */
  contextWindow;

  /** @type {Message[]} 内存中的消息列表 */
  messages = [];

  /** @type {number} 估计的 token 使用量 */
  estimatedTokens = 0;

  /** @type {boolean} 是否已加载 */
  loaded = false;

  /**
   * @param {Object} options
   * @param {string} options.sessionId - 会话 ID
   * @param {string} options.storePath - 存储路径
   * @param {number} options.contextWindow - 上下文窗口大小
   */
  constructor({ sessionId, storePath, contextWindow }) {
    this.sessionId = sessionId;
    this.sessionFile = storePath;
    this.contextWindow = contextWindow;
  }

  /**
   * 加载会话历史
   */
  async load() {
    if (this.loaded) {
      return;
    }

    try {
      const content = await fs.readFile(this.sessionFile, 'utf-8');
      const lines = content.trim().split('\n');

      this.messages = [];
      for (const line of lines) {
        if (line.trim()) {
          try {
            const msg = JSON.parse(line);
            this.messages.push(msg);
          } catch (e) {
            console.warn(`Failed to parse message: ${line.substring(0, 50)}...`);
          }
        }
      }

      this.estimatedTokens = this.estimateTokens(this.messages);
      this.loaded = true;

      console.log(
        `[Session] Loaded ${this.messages.length} messages from ${this.sessionFile}`
      );
    } catch (error) {
      if (error.code === 'ENOENT') {
        // 文件不存在，创建新会话
        this.messages = [];
        this.estimatedTokens = 0;
        this.loaded = true;
        console.log(`[Session] Created new session: ${this.sessionId}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * 添加消息到会话
   * @param {Message} message - 消息对象
   */
  async addMessage(message) {
    if (!this.loaded) {
      await this.load();
    }

    this.messages.push(message);

    // 更新 token 估计
    const tokens = this.estimateTokens([message]);
    this.estimatedTokens += tokens;

    // 持久化到文件
    await this.persist();

    console.log(
      `[Session] Added ${message.role} message: ${tokens} tokens, total ${this.estimatedTokens}`
    );
  }

  /**
   * 获取所有消息
   * @returns {Message[]}
   */
  async getMessages() {
    if (!this.loaded) {
      await this.load();
    }
    return this.messages;
  }

  /**
   * 检查上下文窗口是否超出
   * @returns {Object} 检查结果
   */
  checkContextWindow() {
    const usage = this.estimatedTokens / this.contextWindow;
    const exceeded = usage > 0.9; // 90% 阈值

    return {
      exceeded,
      usage,
      tokens: this.estimatedTokens,
      window: this.contextWindow,
      remaining: this.contextWindow - this.estimatedTokens,
    };
  }

  /**
   * 压缩会话历史
   *
   * ==================== 教学说明 ====================
   *
   * 压缩策略：
   * 1. 保留最近的 N 条消息（例如最近 20 条）
   * 2. 将更早的消息用摘要替换
   * 3. 使用 LLM 生成摘要（在提供 provider 的情况下）
   *
   * @param {Object} options
   * @param {Object} [options.provider] - LLM provider（用于生成摘要）
   * @param {string} [options.systemPrompt] - 系统提示词
   * @param {number} [options.recentCount=20] - 保留的最近消息数
   * @returns {Promise<CompactionResult>}
   */
  async compact({ provider, systemPrompt, recentCount = 20 } = {}) {
    if (!this.loaded) {
      await this.load();
    }

    const originalCount = this.messages.length;
    const originalTokens = this.estimatedTokens;

    if (originalCount <= recentCount) {
      return {
        success: true,
        originalMessages: originalCount,
        compactedMessages: originalCount,
        tokensSaved: 0,
      };
    }

    // 分离历史消息和最近消息
    const toCompact = this.messages.slice(0, -recentCount);
    const recent = this.messages.slice(-recentCount);

    if (!provider) {
      // 如果没有提供 provider，简单删除旧消息
      this.messages = recent;
      this.estimatedTokens = this.estimateTokens(this.messages);
      await this.persist();

      return {
        success: true,
        originalMessages: originalCount,
        compactedMessages: this.messages.length,
        tokensSaved: originalTokens - this.estimatedTokens,
      };
    }

    // 使用 LLM 生成摘要
    try {
      const summaryPrompt = `请将以下对话历史总结为一个简洁的摘要，保留关键信息和决策：

${toCompact.map(m => `${m.role}: ${m.content}`).join('\n\n')}

摘要：`;

      const summary = await provider.generate(summaryPrompt);

      // 创建摘要消息
      const summaryMessage = {
        role: 'system',
        content: `[对话摘要]\n${summary}`,
      };

      // 用摘要替换历史消息
      this.messages = [summaryMessage, ...recent];
      this.estimatedTokens = this.estimateTokens(this.messages);
      await this.persist();

      const tokensSaved = originalTokens - this.estimatedTokens;

      console.log(
        `[Session] Compacted: ${originalCount} → ${this.messages.length} messages, saved ${tokensSaved} tokens`
      );

      return {
        success: true,
        originalMessages: originalCount,
        compactedMessages: this.messages.length,
        tokensSaved,
      };
    } catch (error) {
      console.error(`[Session] Compaction failed: ${error}`);
      // 失败时回退到简单删除
      this.messages = recent;
      this.estimatedTokens = this.estimateTokens(this.messages);
      await this.persist();

      return {
        success: false,
        originalMessages: originalCount,
        compactedMessages: this.messages.length,
        tokensSaved: originalTokens - this.estimatedTokens,
      };
    }
  }

  /**
   * 持久化消息到文件
   */
  async persist() {
    const dir = path.dirname(this.sessionFile);
    await fs.mkdir(dir, { recursive: true });

    const lines = this.messages.map(msg => JSON.stringify(msg));
    await fs.writeFile(this.sessionFile, lines.join('\n') + '\n');
  }

  /**
   * 估算消息的 token 数量
   *
   * ==================== 教学说明 ====================
   *
   * 这是一个简单的估算方法：
   * - 英文：约 4 个字符 = 1 token
   * - 中文：约 1.5-2 个汉字 = 1 token
   * - 代码：约 3-4 个字符 = 1 token
   *
   * 为了简化，我们使用 4 个字符 = 1 token 的粗略估计
   *
   * @param {Message[]} messages - 消息列表
   * @returns {number} 估计的 token 数
   */
  estimateTokens(messages) {
    let totalChars = 0;

    for (const msg of messages) {
      // 内容
      totalChars += String(msg.content || '').length;

      // 工具调用
      if (msg.toolCalls) {
        totalChars += JSON.stringify(msg.toolCalls).length;
      }

      // 图片（每个图片约 1000 tokens）
      if (msg.images && msg.images.length > 0) {
        totalChars += msg.images.length * 4000;
      }
    }

    // 粗略估计：4 个字符 = 1 token
    return Math.ceil(totalChars / 4);
  }

  /**
   * 清空会话
   */
  async clear() {
    this.messages = [];
    this.estimatedTokens = 0;
    await this.persist();
    console.log(`[Session] Cleared: ${this.sessionId}`);
  }

  /**
   * 获取会话统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      messageCount: this.messages.length,
      estimatedTokens: this.estimatedTokens,
      contextWindow: this.contextWindow,
      usage: this.estimatedTokens / this.contextWindow,
      loaded: this.loaded,
    };
  }
}
