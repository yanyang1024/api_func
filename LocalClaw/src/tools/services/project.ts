import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ 项目管理工具 ============

export function createProjectManagementTools(
  config: Config["services"]["projectManagement"]
): Tool[] {
  if (!config?.enabled || !config.baseUrl) {
    return [];
  }

  const baseUrl = config.baseUrl;
  const apiKey = config.apiKey;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // 项目列表
  const projectListTool: Tool = {
    name: "pm_projects",
    description: "获取项目列表",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "completed", "archived"],
          description: "项目状态",
        },
        page: { type: "number", description: "页码" },
        limit: { type: "number", description: "每页数量" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/projects`;
        const queryParams = new URLSearchParams();

        if (params.status) {
          queryParams.set("status", String(params.status));
        }
        if (params.page) {
          queryParams.set("page", String(params.page));
        }
        if (params.limit) {
          queryParams.set("limit", String(params.limit));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`项目管理 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: data,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `获取项目列表失败: ${error}`,
        };
      }
    },
  };

  // 任务列表
  const taskListTool: Tool = {
    name: "pm_tasks",
    description: "获取任务列表",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        assignee: { type: "string", description: "负责人" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "review", "done"],
          description: "任务状态",
        },
        page: { type: "number", description: "页码" },
        limit: { type: "number", description: "每页数量" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/tasks`;
        const queryParams = new URLSearchParams();

        if (params.projectId) {
          queryParams.set("project_id", String(params.projectId));
        }
        if (params.assignee) {
          queryParams.set("assignee", String(params.assignee));
        }
        if (params.status) {
          queryParams.set("status", String(params.status));
        }
        if (params.page) {
          queryParams.set("page", String(params.page));
        }
        if (params.limit) {
          queryParams.set("limit", String(params.limit));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`项目管理 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: data,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `获取任务列表失败: ${error}`,
        };
      }
    },
  };

  // 创建任务
  const createTaskTool: Tool = {
    name: "pm_create_task",
    description: "创建新任务",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目ID" },
        title: { type: "string", description: "任务标题" },
        description: { type: "string", description: "任务描述" },
        assignee: { type: "string", description: "负责人" },
        dueDate: { type: "string", description: "截止日期 YYYY-MM-DD" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "urgent"],
          description: "优先级",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "标签",
        },
      },
      required: ["projectId", "title"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/tasks`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`项目管理 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            taskId: data.id,
            title: data.title,
            status: "todo",
            message: "任务创建成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `创建任务失败: ${error}`,
        };
      }
    },
  };

  // 更新任务状态
  const updateTaskTool: Tool = {
    name: "pm_update_task",
    description: "更新任务状态",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "任务ID" },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "review", "done"],
          description: "新状态",
        },
        progress: { type: "number", description: "进度百分比 0-100" },
        comment: { type: "string", description: "备注" },
      },
      required: ["taskId", "status"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/tasks/${params.taskId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`项目管理 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            taskId: params.taskId,
            status: data.status,
            message: "任务更新成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `更新任务失败: ${error}`,
        };
      }
    },
  };

  // 工时记录
  const logTimeTool: Tool = {
    name: "pm_log_time",
    description: "记录工时",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "任务ID" },
        hours: { type: "number", description: "工时（小时）" },
        date: { type: "string", description: "日期 YYYY-MM-DD" },
        description: { type: "string", description: "工作内容描述" },
      },
      required: ["taskId", "hours"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/time-logs`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`项目管理 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            logId: data.id,
            hours: params.hours,
            message: "工时记录成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `记录工时失败: ${error}`,
        };
      }
    },
  };

  return [projectListTool, taskListTool, createTaskTool, updateTaskTool, logTimeTool];
}
