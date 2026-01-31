/**
 * 上下文构建器
 *
 * ==================== 教学说明 ====================
 *
 * 什么是上下文（Context）？
 * ---------------
 * 上下文是传递给 LLM 的所有信息，包括：
 * - 系统提示词（System Prompt）：定义 AI 的角色和行为
 * - 用户消息：当前的请求
 * - 历史消息：之前的对话
 * - 工具定义：可用的工具列表
 * - 项目文件：如 CLAUDE.md、AGENTS.md 等
 *
 * 为什么需要上下文构建？
 * ---------------
 * 1. 提供足够的信息：AI 需要了解环境和规则
 * 2. 控制 AI 行为：通过系统提示词指导 AI
 * 3. 动态适应：根据可用工具和配置动态生成提示词
 * 4. 节省 tokens：只包含必要的信息
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 上下文构建器类
 */
export class ContextBuilder {
  /** @type {string} 工作区路径 */
  workspace;

  /** @type {Object} 配置 */
  config;

  /**
   * @param {Object} options
   * @param {string} options.workspace - 工作区路径
   * @param {Object} options.config - 配置对象
   */
  constructor(options) {
    this.workspace = options.workspace;
    this.config = options.config;
  }

  /**
   * 构建系统提示词
   *
   * ==================== 教学说明 ====================
   *
   * 系统提示词的结构：
   * ---------------
   * 1. 基础身份声明：告诉 AI 它是谁
   * 2. 工具列表：说明可以使用哪些工具
   * 3. 工作区信息：告诉 AI 工作目录在哪里
   * 4. 本地服务：列出可用的本地服务
   * 5. 引导文件：注入用户定义的上下文文件
   * 6. 推理级别：指导 AI 如何思考
   * 7. 记忆系统：告诉 AI 如何使用记忆
   * 8. 运行时信息：环境元数据
   *
   * @param {Object} params
   * @param {string} params.mode - 模式：full, minimal, none
   * @param {string[]} params.toolNames - 可用工具名称列表
   * @param {string} params.thinkingLevel - 推理级别
   * @returns {Promise<string>} 系统提示词
   */
  async build(params) {
    const { mode = 'full', toolNames = [], thinkingLevel } = params;

    // "none" 模式只返回基础身份
    if (mode === 'none') {
      return 'You are a helpful local AI assistant running on Ollama.';
    }

    const sections = [];

    // 1. 基础身份
    sections.push(this.getBaseSection());

    // 2. 工具列表
    sections.push(this.getToolingSection(toolNames));

    // 3. 工具使用指南
    sections.push(this.getToolUsageSection());

    // 4. 工作区信息
    sections.push(this.getWorkspaceSection());

    // 5. 本地服务
    const localServicesSection = this.getLocalServicesSection();
    if (localServicesSection) {
      sections.push(localServicesSection);
    }

    if (mode === 'full') {
      // 6. 引导文件（仅在 full 模式）
      const bootstrapSection = await this.getBootstrapSection();
      if (bootstrapSection) {
        sections.push(bootstrapSection);
      }

      // 7. 推理指导
      const thinkingSection = this.getThinkingSection(thinkingLevel);
      if (thinkingSection) {
        sections.push(thinkingSection);
      }

      // 8. 记忆系统
      const memorySection = this.getMemorySection();
      if (memorySection) {
        sections.push(memorySection);
      }

      // 9. 静默回复
      sections.push(this.getSilentReplySection());

      // 10. 运行时信息
      sections.push(this.getRuntimeSection(thinkingLevel));
    }

    return sections.filter(Boolean).join('\n\n');
  }

  /**
   * 基础身份部分
   */
  getBaseSection() {
    return `# Identity
You are a local AI assistant running on Ollama, an open-source LLM platform.

Your purpose is to help users accomplish tasks by:
- Understanding their requests
- Using available tools when needed
- Providing clear and helpful responses
- Thinking step by step for complex tasks`;
  }

  /**
   * 工具列表部分
   */
  getToolingSection(toolNames) {
    if (toolNames.length === 0) {
      return `# Available Tools
No tools are currently available.`;
    }

    const toolList = toolNames.map(name => `- \`${name}\``).join('\n');
    return `# Available Tools
You have access to the following tools:

${toolList}

Use these tools when needed to accomplish tasks. Tools help you interact with the system beyond just generating text.`;
  }

  /**
   * 工具使用指南
   */
  getToolUsageSection() {
    return `# Tool Usage Guidelines

## When to Use Tools
- Use tools to accomplish tasks that require system interaction
- Don't use tools if you can directly answer from your knowledge
- Always explain what tool you're using and why (for complex operations)

## Tool Call Format
When you need to use a tool, format your response to indicate the tool call with the tool name and parameters.

## After Tool Execution
- Always review the tool result
- If a tool fails, try again with different parameters or explain the error
- Provide a summary of what was accomplished`;
  }

  /**
   * 工作区部分
   */
  getWorkspaceSection() {
    return `# Workspace
Your working directory is: \`${this.workspace}\`

All file operations are relative to this directory. Treat this as your main workspace for file-related tasks.`;
  }

  /**
   * 本地服务部分
   */
  getLocalServicesSection() {
    const services = this.config.agent.localServices || [];

    if (services.length === 0) {
      return '';
    }

    const serviceList = services
      .map(s => `- \`local_${s.name}\`: ${s.description} (${s.endpoint})`)
      .join('\n');

    return `# Local Services
You have access to the following local services:

${serviceList}

Use the \`local_service\` tool to interact with these services. Each service may support different actions like "query", "list", "create", "delete", etc.`;
  }

  /**
   * 引导文件部分
   *
   * ==================== 教学说明 ====================
   *
   * 引导文件（Bootstrap Files）是用户放在工作区的特殊文件，
   * 用于为 AI 提供项目特定的上下文和规则。
   *
   * 常见引导文件：
   * - CLAUDE.md: 项目特定的指令和规则
   * - AGENTS.md: AI 行为规范
   * - SOUL.md: AI 个性化设定
   */
  async getBootstrapSection() {
    const bootstrapFiles = [
      'CLAUDE.md',
      'AGENTS.md',
      'SOUL.md',
    ];

    const contextParts = ['# Project Context', ''];
    let hasAnyFile = false;

    for (const filename of bootstrapFiles) {
      const filepath = path.join(this.workspace, filename);

      try {
        const content = await fs.readFile(filepath, 'utf-8');
        contextParts.push(`## ${filename}`, '', content, '');
        hasAnyFile = true;
      } catch (error) {
        // 文件不存在，跳过
        if (error.code !== 'ENOENT') {
          console.warn(`Failed to read ${filename}: ${error.message}`);
        }
      }
    }

    if (!hasAnyFile) {
      return '';
    }

    // 如果有 SOUL.md，添加提醒
    if (bootstrapFiles.includes('SOUL.md')) {
      try {
        await fs.access(path.join(this.workspace, 'SOUL.md'));
        contextParts.unshift(
          '**Note:** If SOUL.md is present, embody its persona and tone in your responses.',
          ''
        );
      } catch {
        // SOUL.md 不存在
      }
    }

    return contextParts.join('\n');
  }

  /**
   * 推理指导部分
   */
  getThinkingSection(level) {
    if (!level || level === 'off') {
      return '';
    }

    const guidance = {
      low: 'Briefly consider the task before answering.',
      medium: 'Think through the task step by step, considering different approaches.',
      high: 'Perform deep analysis before answering. Break down complex problems into smaller parts.',
    };

    const text = guidance[level] || '';

    return `# Thinking
${text}

Format your thinking inside <thinking>...</thinking> tags if needed, then provide your final answer.

Example:
<thinking>
Let me analyze this request...
1. First, I need to...
2. Then, I should...
</thinking>

Based on my analysis, here's my response...`;
  }

  /**
   * 记忆系统部分
   */
  getMemorySection() {
    if (!this.config.agent.memory.enabled) {
      return '';
    }

    return `# Memory
You have access to a memory system that stores information from previous conversations.

## When to Use Memory
- Before answering questions about prior work, decisions, or preferences
- When you need to recall specific dates, people, or past events
- To maintain consistency across conversations

## How to Use Memory
- Use the \`memory_search\` tool to search for relevant information
- The memory is stored in: \`${this.config.agent.memory.storePath}\`
- Search results will include relevant excerpts from past conversations`;
  }

  /**
   * 静默回复部分
   */
  getSilentReplySection() {
    return `# Silent Replies
When you have nothing meaningful to say, respond with ONLY: \`NO_REPLY\`

This is useful for:
- Acknowledging a command that doesn't need a response
- Avoiding unnecessary confirmations
- Keeping interactions clean and focused

**Rules:**
- It must be your ENTIRE message
- Never append it to an actual response
- Never wrap it in markdown or code blocks`;
  }

  /**
   * 运行时信息部分
   */
  getRuntimeSection(thinkingLevel) {
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
    const timeStr = now.toLocaleTimeString('zh-CN');

    return `# Runtime Information
- **Date**: ${dateStr}
- **Time**: ${timeStr}
- **Model**: ${this.config.agent.model.name}
- **Thinking Level**: ${thinkingLevel || 'off'}
- **Workspace**: ${this.workspace}
- **Provider**: Ollama (Local)

All interactions are processed locally on your machine.`;
  }

  /**
   * 构建工具摘要（用于压缩提示词）
   * @param {string[]} toolNames
   * @returns {string}
   */
  buildToolSummary(toolNames) {
    return toolNames.map(name => `- ${name}`).join('\n');
  }
}
