import { AgentTool, ToolHandler, AgentContext, ToolCategory } from "../core/types.js";
import { ServiceRegistry } from "../services/registry.js";

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: ToolHandler;
}

export interface ToolManagerConfig {
  serviceRegistry: ServiceRegistry;
  workspaceDir: string;
  allowedCategories?: ToolCategory[];
}

export class ToolManager {
  private tools: Map<string, ToolDefinition> = new Map();
  private config: ToolManagerConfig;

  constructor(config: ToolManagerConfig) {
    this.config = config;
    this.registerBuiltInTools();
  }

  private registerBuiltInTools(): void {
    // 文件操作工具
    this.register({
      name: "file_read",
      description: "读取文件内容",
      category: "file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径",
            required: true,
          },
          encoding: {
            type: "string",
            description: "文件编码，默认utf-8",
          },
        },
        required: ["path"],
      },
      handler: this.createFileReadHandler(),
    });

    this.register({
      name: "file_write",
      description: "写入文件内容",
      category: "file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "文件路径",
            required: true,
          },
          content: {
            type: "string",
            description: "文件内容",
            required: true,
          },
        },
        required: ["path", "content"],
      },
      handler: this.createFileWriteHandler(),
    });

    this.register({
      name: "file_list",
      description: "列出目录内容",
      category: "file",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "目录路径，默认当前目录",
          },
          recursive: {
            type: "boolean",
            description: "是否递归列出子目录",
          },
        },
      },
      handler: this.createFileListHandler(),
    });

    this.register({
      name: "file_search",
      description: "搜索文件",
      category: "file",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词",
            required: true,
          },
          path: {
            type: "string",
            description: "搜索目录",
          },
        },
        required: ["query"],
      },
      handler: this.createFileSearchHandler(),
    });

    // 数据库工具
    this.register({
      name: "db_query",
      description: "执行SQL查询",
      category: "database",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "SQL查询语句",
            required: true,
          },
          params: {
            type: "array",
            description: "查询参数",
          },
        },
        required: ["sql"],
      },
      handler: this.createDbQueryHandler(),
    });

    // 搜索工具
    this.register({
      name: "search",
      description: "搜索文档",
      category: "search",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索查询",
            required: true,
          },
          limit: {
            type: "number",
            description: "返回结果数量限制",
          },
        },
        required: ["query"],
      },
      handler: this.createSearchHandler(),
    });

    this.register({
      name: "search_index",
      description: "索引文档到搜索系统",
      category: "search",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "文档ID",
            required: true,
          },
          title: {
            type: "string",
            description: "文档标题",
            required: true,
          },
          content: {
            type: "string",
            description: "文档内容",
            required: true,
          },
        },
        required: ["id", "title", "content"],
      },
      handler: this.createSearchIndexHandler(),
    });

    // 任务管理工具
    this.register({
      name: "task_create",
      description: "创建新任务",
      category: "task",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "任务标题",
            required: true,
          },
          description: {
            type: "string",
            description: "任务描述",
          },
          assignee: {
            type: "string",
            description: "任务负责人",
          },
        },
        required: ["title"],
      },
      handler: this.createTaskCreateHandler(),
    });

    this.register({
      name: "task_list",
      description: "列出任务",
      category: "task",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "任务状态筛选",
            enum: ["pending", "in_progress", "completed", "failed"],
          },
          assignee: {
            type: "string",
            description: "负责人筛选",
          },
        },
      },
      handler: this.createTaskListHandler(),
    });

    this.register({
      name: "task_complete",
      description: "完成任务",
      category: "task",
      parameters: {
        type: "object",
        properties: {
          taskId: {
            type: "string",
            description: "任务ID",
            required: true,
          },
        },
        required: ["taskId"],
      },
      handler: this.createTaskCompleteHandler(),
    });

    // 通知工具
    this.register({
      name: "notify",
      description: "发送通知",
      category: "notification",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "通知类型",
            enum: ["email", "webhook", "log"],
            required: true,
          },
          recipients: {
            type: "array",
            description: "通知接收者",
            required: true,
          },
          subject: {
            type: "string",
            description: "通知主题",
            required: true,
          },
          content: {
            type: "string",
            description: "通知内容",
            required: true,
          },
        },
        required: ["type", "recipients", "subject", "content"],
      },
      handler: this.createNotifyHandler(),
    });

    // 系统工具
    this.register({
      name: "exec",
      description: "执行系统命令",
      category: "system",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "要执行的命令",
            required: true,
          },
          timeout: {
            type: "number",
            description: "超时时间(毫秒)",
          },
        },
        required: ["command"],
      },
      handler: this.createExecHandler(),
    });
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): ToolDefinition | null {
    return this.tools.get(name) || null;
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter(t => t.category === category);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: AgentContext
  ): Promise<{ success: boolean; content: string; error?: string }> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return { success: false, error: `工具不存在: ${name}` };
    }

    try {
      const result = await tool.handler(args, context);
      return { success: true, content: result.content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  // 工具处理器工厂方法
  private createFileReadHandler(): ToolHandler {
    return async (args, context) => {
      const fileService = this.config.serviceRegistry.getFile();
      if (!fileService) {
        throw new Error("文件服务不可用");
      }

      const result = await fileService.read(args.path as string, {
        encoding: args.encoding as string,
      });

      if (!result.success) {
        throw new Error(result.error || "读取文件失败");
      }

      return { content: result.data || "" };
    };
  }

  private createFileWriteHandler(): ToolHandler {
    return async (args, context) => {
      const fileService = this.config.serviceRegistry.getFile();
      if (!fileService) {
        throw new Error("文件服务不可用");
      }

      const result = await fileService.write(
        args.path as string,
        args.content as string
      );

      if (!result.success) {
        throw new Error(result.error || "写入文件失败");
      }

      return { content: `文件已写入: ${args.path}` };
    };
  }

  private createFileListHandler(): ToolHandler {
    return async (args, context) => {
      const fileService = this.config.serviceRegistry.getFile();
      if (!fileService) {
        throw new Error("文件服务不可用");
      }

      const result = await fileService.list(
        (args.path as string) || "/",
        args.recursive as boolean
      );

      if (!result.success) {
        throw new Error(result.error || "列出目录失败");
      }

      return {
        content: result.data?.map(f => 
          `${f.isDirectory ? "[DIR]" : "[FILE]"} ${f.name} (${f.size} bytes)`
        ).join("\n") || "目录为空",
      };
    };
  }

  private createFileSearchHandler(): ToolHandler {
    return async (args, context) => {
      const fileService = this.config.serviceRegistry.getFile();
      if (!fileService) {
        throw new Error("文件服务不可用");
      }

      const result = await fileService.search(
        args.query as string,
        args.path as string
      );

      if (!result.success) {
        throw new Error(result.error || "搜索失败");
      }

      return {
        content: result.data?.map(f =>
          `${f.path} (${f.isDirectory ? "目录" : `${f.size} bytes`})`
        ).join("\n") || "未找到匹配文件",
      };
    };
  }

  private createDbQueryHandler(): ToolHandler {
    return async (args, context) => {
      const dbService = this.config.serviceRegistry.getDatabase();
      if (!dbService) {
        throw new Error("数据库服务不可用");
      }

      const result = await dbService.query(
        args.sql as string,
        args.params as unknown[]
      );

      if (result.rowCount === 0) {
        return { content: "查询结果为空" };
      }

      const table = result.rows.map(row =>
        result.columns.map(col => String(row[col])).join(" | ")
      ).join("\n");

      return {
        content: `查询结果 (${result.rowCount} 行, ${result.executionTime}ms):\n\n${table}`,
      };
    };
  }

  private createSearchHandler(): ToolHandler {
    return async (args, context) => {
      const searchService = this.config.serviceRegistry.getSearch();
      if (!searchService) {
        throw new Error("搜索服务不可用");
      }

      const result = await searchService.search({
        query: args.query as string,
        limit: args.limit as number,
      });

      if (!result.success) {
        throw new Error(result.error || "搜索失败");
      }

      return {
        content: result.data?.map(r =>
          `[${r.score.toFixed(2)}] ${r.title}\n${r.content}`
        ).join("\n\n") || "未找到结果",
      };
    };
  }

  private createSearchIndexHandler(): ToolHandler {
    return async (args, context) => {
      const searchService = this.config.serviceRegistry.getSearch();
      if (!searchService) {
        throw new Error("搜索服务不可用");
      }

      const result = await searchService.indexDocument({
        id: args.id as string,
        title: args.title as string,
        content: args.content as string,
      });

      if (!result.success) {
        throw new Error(result.error || "索引失败");
      }

      return { content: `文档已索引: ${args.id}` };
    };
  }

  private createTaskCreateHandler(): ToolHandler {
    return async (args, context) => {
      const taskService = this.config.serviceRegistry.getTask();
      if (!taskService) {
        throw new Error("任务服务不可用");
      }

      const result = await taskService.createTask({
        title: args.title as string,
        description: args.description as string,
        assignee: args.assignee as string,
      });

      if (!result.success) {
        throw new Error(result.error || "创建任务失败");
      }

      return { content: `任务已创建: ${result.data?.id}\n标题: ${result.data?.title}` };
    };
  }

  private createTaskListHandler(): ToolHandler {
    return async (args, context) => {
      const taskService = this.config.serviceRegistry.getTask();
      if (!taskService) {
        throw new Error("任务服务不可用");
      }

      const result = await taskService.listTasks({
        status: args.status as any,
        assignee: args.assignee as string,
      });

      if (!result.success) {
        throw new Error(result.error || "获取任务列表失败");
      }

      return {
        content: result.data?.map(t =>
          `[${t.status}] ${t.title} ${t.assignee ? `(负责人: ${t.assignee})` : ""}`
        ).join("\n") || "暂无任务",
      };
    };
  }

  private createTaskCompleteHandler(): ToolHandler {
    return async (args, context) => {
      const taskService = this.config.serviceRegistry.getTask();
      if (!taskService) {
        throw new Error("任务服务不可用");
      }

      const result = await taskService.completeTask(args.taskId as string);
      
      if (!result.success) {
        throw new Error(result.error || "完成任务失败");
      }

      return { content: "任务已完成" };
    };
  }

  private createNotifyHandler(): ToolHandler {
    return async (args, context) => {
      const notificationService = this.config.serviceRegistry.getNotification();
      if (!notificationService) {
        throw new Error("通知服务不可用");
      }

      const result = await notificationService.send({
        type: args.type as any,
        recipients: args.recipients as string[],
        subject: args.subject as string,
        content: args.content as string,
      });

      if (!result.success) {
        throw new Error(result.error || "发送通知失败");
      }

      return { content: `通知已发送: ${result.data?.id}` };
    };
  }

  private createExecHandler(): ToolHandler {
    return async (args, context) => {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      
      const execAsync = promisify(exec);
      
      try {
        const { stdout, stderr } = await execAsync(args.command as string, {
          cwd: this.config.workspaceDir,
          timeout: args.timeout as number || 30000,
        });

        return { content: stdout || stderr || "命令执行成功(无输出)" };
      } catch (error) {
        throw new Error(`命令执行失败: ${error}`);
      }
    };
  }
}

export const createToolManager = (config: ToolManagerConfig): ToolManager => {
  return new ToolManager(config);
};
