/**
 * 工具注册表
 *
 * ==================== 教学说明 ====================
 *
 * 什么是工具（Tools）？
 * ---------------
 * 工具是 AI Agent 可以调用的函数，用于扩展其能力。
 * 例如：
 * - read: 读取文件
 * - write: 写入文件
 * - exec: 执行 shell 命令
 * - web_search: 搜索网络
 *
 * 工具的工作流程：
 * ---------------
 * 1. Agent 决定需要调用某个工具
 * 2. Agent 生成工具调用请求（包含参数）
 * 3. 系统执行工具，获取结果
 * 4. 将工具结果返回给 Agent
 * 5. Agent 基于工具结果生成最终回复
 *
 * Function Calling 机制：
 * ---------------
 * 这是现代 LLM 的一个重要特性，允许模型：
 * - 理解何时需要调用工具
 * - 生成符合工具定义的参数
 * - 处理工具返回的结果
 */

import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 工具基类
 * @abstract
 */
export class Tool {
  /** @type {string} 工具名称 */
  name;

  /** @type {string} 工具描述 */
  description;

  /**
   * 获取工具的参数模式（JSON Schema 格式）
   * @abstract
   * @returns {Object}
   */
  getSchema() {
    throw new Error('Tool.getSchema() must be implemented');
  }

  /**
   * 执行工具
   * @abstract
   * @param {Object} args - 参数
   * @returns {Promise<string>} 执行结果
   */
  async execute(args) {
    throw new Error('Tool.execute() must be implemented');
  }
}

/**
 * 文件读取工具
 */
export class ReadTool extends Tool {
  name = 'read';
  description = 'Read the contents of a file. Use this when you need to see what\'s in a file.';

  /**
   * @param {Object} options
   * @param {string} options.workspace - 工作区目录
   */
  constructor(options) {
    super();
    this.workspace = options.workspace;
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the file to read (relative to workspace)',
        },
      },
      required: ['filepath'],
    };
  }

  async execute(args) {
    const { filepath } = args;
    const fullPath = `${this.workspace}/${filepath}`;

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
}

/**
 * 文件写入工具
 */
export class WriteTool extends Tool {
  name = 'write';
  description = 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does.';

  constructor(options) {
    super();
    this.workspace = options.workspace;
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the file to write (relative to workspace)',
        },
        content: {
          type: 'string',
          description: 'Content to write to the file',
        },
      },
      required: ['filepath', 'content'],
    };
  }

  async execute(args) {
    const { filepath, content } = args;
    const fullPath = `${this.workspace}/${filepath}`;

    try {
      // 确保目录存在
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');
      return `Successfully wrote to ${filepath}`;
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }
}

/**
 * 文件编辑工具
 */
export class EditTool extends Tool {
  name = 'edit';
  description = 'Make a precise edit to a file by replacing a specific string with another.';

  constructor(options) {
    super();
    this.workspace = options.workspace;
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        filepath: {
          type: 'string',
          description: 'Path to the file to edit (relative to workspace)',
        },
        oldText: {
          type: 'string',
          description: 'The exact text to replace (must match exactly)',
        },
        newText: {
          type: 'string',
          description: 'The new text to replace with',
        },
      },
      required: ['filepath', 'oldText', 'newText'],
    };
  }

  async execute(args) {
    const { filepath, oldText, newText } = args;
    const fullPath = `${this.workspace}/${filepath}`;

    try {
      let content = await fs.readFile(fullPath, 'utf-8');

      if (!content.includes(oldText)) {
        throw new Error(`Old text not found in file`);
      }

      content = content.replace(oldText, newText);
      await fs.writeFile(fullPath, content, 'utf-8');

      return `Successfully edited ${filepath}`;
    } catch (error) {
      throw new Error(`Failed to edit file: ${error.message}`);
    }
  }
}

/**
 * Shell 执行工具
 */
export class ExecTool extends Tool {
  name = 'exec';
  description = 'Execute a shell command. Use this for running commands, scripts, or programs.';

  constructor(options) {
    super();
    this.workspace = options.workspace;
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for the command (default: workspace)',
        },
      },
      required: ['command'],
    };
  }

  async execute(args) {
    const { command, cwd } = args;
    const workDir = cwd || this.workspace;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      let result = '';
      if (stdout) result += stdout;
      if (stderr) result += `\n[stderr]\n${stderr}`;

      return result || 'Command executed successfully (no output)';
    } catch (error) {
      return `[Error] Command failed: ${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`;
    }
  }
}

/**
 * 本地服务工具
 */
export class LocalServiceTool extends Tool {
  /** @type {string} 服务名称 */
  serviceName;

  /** @type {string} 服务端点 */
  endpoint;

  /** @type {string} 服务描述 */
  serviceDescription;

  /**
   * @param {Object} config
   * @param {string} config.name - 服务名称
   * @param {string} config.endpoint - 服务端点
   * @param {string} config.description - 服务描述
   */
  constructor(config) {
    super();
    this.serviceName = config.name;
    this.endpoint = config.endpoint;
    this.serviceDescription = config.description;
    this.name = `local_${config.name}`;
    this.description = `${config.description}. Endpoint: ${config.endpoint}`;
  }

  getSchema() {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform (e.g., query, execute, list, create)',
        },
        params: {
          type: 'object',
          description: 'Parameters for the action (object with key-value pairs)',
        },
      },
      required: ['action'],
    };
  }

  async execute(args) {
    const { action, params = {} } = args;

    try {
      const response = await fetch(`${this.endpoint}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(
        `Local service "${this.serviceName}" error: ${error.message}`
      );
    }
  }
}

/**
 * 工具注册表类
 */
export class ToolRegistry {
  /** @type {Map<string, Tool>} 已注册的工具 */
  tools = new Map();

  /** @type {Object} 配置 */
  config;

  /**
   * @param {Object} config
   */
  constructor(config) {
    this.config = config;
  }

  /**
   * 注册核心工具
   */
  async registerCoreTools() {
    const workspace = this.config.agent.workspace;

    // 文件工具
    this.register(new ReadTool({ workspace }));
    this.register(new WriteTool({ workspace }));
    this.register(new EditTool({ workspace }));

    // Shell 工具
    this.register(new ExecTool({ workspace }));

    console.log(`[Tools] Registered core tools: ${Array.from(this.tools.keys()).join(', ')}`);
  }

  /**
   * 注册本地服务工具
   */
  async registerLocalServiceTools() {
    const services = this.config.agent.localServices || [];

    for (const service of services) {
      const tool = new LocalServiceTool(service);
      this.register(tool);
    }

    if (services.length > 0) {
      console.log(`[Tools] Registered ${services.length} local service tools`);
    }
  }

  /**
   * 注册一个工具
   * @param {Tool} tool - 工具实例
   */
  register(tool) {
    this.tools.set(tool.name, tool);
  }

  /**
   * 获取工具
   * @param {string} name - 工具名称
   * @returns {Tool|undefined}
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * 获取允许的工具列表
   * @returns {Tool[]}
   */
  getAllowedTools() {
    const allowList = this.config.agent.tools.allow || [];
    const security = this.config.agent.tools.security;

    if (security === 'full') {
      return Array.from(this.tools.values());
    }

    if (security === 'deny') {
      return [];
    }

    // allowlist 模式
    return Array.from(this.tools.values()).filter(tool =>
      allowList.includes(tool.name)
    );
  }

  /**
   * 获取可用工具的名称列表
   * @returns {string[]}
   */
  getAvailableNames() {
    return this.getAllowedTools().map(t => t.name);
  }

  /**
   * 将工具转换为 LLM API 格式
   * @returns {Array}
   */
  toLLMFormat() {
    return this.getAllowedTools().map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.getSchema(),
      },
    }));
  }

  /**
   * 执行工具调用
   * @param {string} toolName - 工具名称
   * @param {Object} args - 参数
   * @returns {Promise<string>}
   */
  async execute(toolName, args) {
    const tool = this.get(toolName);

    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`);
    }

    console.log(`[Tools] Executing: ${toolName}`, Object.keys(args));

    const result = await tool.execute(args);
    return result;
  }
}
