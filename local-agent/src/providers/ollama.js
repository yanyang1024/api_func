/**
 * Ollama Provider
 *
 * ==================== 教学说明 ====================
 *
 * 什么是 Ollama？
 * ---------------
 * Ollama 是一个本地运行大模型的工具，支持多种开源模型：
 * - Llama 3.1 (Meta)
 * - Qwen 2.5 (阿里)
 * - Mistral (Mistral AI)
 * - 等等...
 *
 * 为什么使用 Ollama？
 * ---------------
 * 1. 完全本地运行，无需联网
 * 2. 数据隐私，所有数据都在本地
 * 3. 免费，没有 API 调用成本
 * 4. 支持多种模型，可根据需求选择
 *
 * Ollama API 文档：
 * ---------------
 * https://github.com/ollama/ollama/blob/main/docs/api.md
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} role - 角色：system, user, assistant, tool
 * @property {string} content - 消息内容
 * @property {Array} [tool_calls] - 工具调用（仅 assistant）
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {Object} type - 类型，固定为 "function"
 * @property {Object} function - 函数定义
 * @property {string} function.name - 函数名
 * @property {string} function.description - 函数描述
 * @property {Object} function.parameters - JSON Schema 格式的参数定义
 */

/**
 * Ollama Provider 类
 */
export class OllamaProvider {
  /** @type {string} Ollama API 基础 URL */
  baseUrl;

  /** @type {string} 模型名称 */
  model;

  /** @type {Object} 默认选项 */
  defaultOptions;

  /**
   * @param {Object} config
   * @param {string} config.baseUrl - Ollama API 地址
   * @param {string} config.model - 模型名称
   * @param {number} [config.temperature=0.7] - 生成温度
   */
  constructor(config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // 移除尾部斜杠
    this.model = config.model;
    this.defaultOptions = {
      temperature: config.temperature ?? 0.7,
      stream: true,
    };
  }

  /**
   * 聊天补全（流式）
   *
   * ==================== 教学说明 ====================
   *
   * 什么是流式（Streaming）？
   * ---------------
   * 流式是指模型在生成内容时，边生成边返回，而不是等全部生成完再返回。
   *
   * 流式的优势：
   * 1. 更快的响应时间：用户可以立即看到开始的内容
   * 2. 更好的用户体验：逐字显示，像打字一样
   * 3. 超时保护：如果模型生成时间过长，用户可以看到部分结果
   *
   * @param {Object} params
   * @param {ChatMessage[]} params.messages - 消息历史
   * @param {ToolDefinition[]} [params.tools] - 工具定义
   * @param {boolean} [params.stream=true] - 是否流式输出
   * @returns {AsyncGenerator<{content?: string, toolCalls?: any[], done?: boolean}>}
   */
  async *chat(params) {
    const { messages, tools, stream = true } = params;

    console.log(`[Ollama] Sending ${messages.length} messages to ${this.model}`);

    // 构建 Ollama API 请求格式
    const requestBody = {
      model: this.model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      options: {
        temperature: this.defaultOptions.temperature,
      },
      stream,
      tools: tools ? this.convertTools(tools) : undefined,
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      if (!stream) {
        // 非流式响应
        const data = await response.json();
        yield {
          content: data.message?.content || '',
          done: true,
        };
        return;
      }

      // 流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            // 提取内容
            if (data.message?.content) {
              yield { content: data.message.content };
            }

            // 提取工具调用（Ollama 可能支持）
            if (data.message?.tool_calls) {
              yield { toolCalls: data.message.tool_calls };
            }

            // 检查是否完成
            if (data.done) {
              yield { done: true };
              console.log(`[Ollama] Response completed`);
              return;
            }
          } catch (e) {
            console.error(`[Ollama] Parse error: ${e.message}, line: ${line.substring(0, 100)}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Ollama] Request failed: ${error}`);
      throw error;
    }
  }

  /**
   * 生成文本（非聊天）
   * @param {string} prompt - 提示词
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    console.log(`[Ollama] Generating with ${this.model}, prompt length: ${prompt.length}`);

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generate error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * 生成文本嵌入（用于语义搜索）
   *
   * ==================== 教学说明 ====================
   *
   * 什么是文本嵌入（Embedding）？
   * ---------------
   * 文本嵌入是将文本转换为数字向量，这些向量可以表示文本的语义。
   *
   * 用途：
   * 1. 语义搜索：找到与查询语义相似的文档
   * 2. 文档聚类：将相似的文档分组
   * 3. 推荐系统：根据内容相似度推荐
   *
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} 向量
   */
  async embed(text) {
    // Ollama 需要单独的嵌入模型
    // 常用嵌入模型：nomic-embed-text, mxbai-embed-large
    const embedModel = 'nomic-embed-text';

    console.log(`[Ollama] Embedding with ${embedModel}, text length: ${text.length}`);

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: embedModel,
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embed error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.embeddings?.[0] || [];
  }

  /**
   * 列出已安装的模型
   * @returns {Promise<Array<{name: string, size: number, modified_at: string}>>}
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama list models error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.models || [];
  }

  /**
   * 检查模型是否存在
   * @param {string} modelName - 模型名称
   * @returns {Promise<boolean>}
   */
  async modelExists(modelName) {
    try {
      const models = await this.listModels();
      return models.some(m => m.name.includes(modelName));
    } catch (error) {
      console.error(`[Ollama] Failed to check model existence: ${error}`);
      return false;
    }
  }

  /**
   * 转换工具格式为 Ollama 格式
   * @param {ToolDefinition[]} tools
   * @returns {Object[]}
   */
  convertTools(tools) {
    return tools.map(tool => ({
      type: tool.type,
      function: tool.function,
    }));
  }

  /**
   * 测试连接
   * @returns {Promise<boolean>}
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error(`[Ollama] Connection test failed: ${error}`);
      return false;
    }
  }

  /**
   * 获取模型信息
   * @param {string} [modelName] - 模型名称（默认使用当前模型）
   * @returns {Promise<Object>}
   */
  async getModelInfo(modelName) {
    const model = modelName || this.model;

    const response = await fetch(`${this.baseUrl}/api/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: model }),
    });

    if (!response.ok) {
      throw new Error(`Ollama show model error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}
