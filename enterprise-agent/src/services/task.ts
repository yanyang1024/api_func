import { ApiResponse, TaskInfo } from "../core/types.js";
import { v4 as uuidv4 } from "uuid";

export interface TaskServiceConfig {
  storagePath: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: number;
  metadata?: Record<string, unknown>;
}

export class TaskService {
  private tasks: Map<string, TaskInfo> = new Map();
  private storagePath: string;

  constructor(config: TaskServiceConfig) {
    this.storagePath = config.storagePath;
  }

  async initialize(): Promise<void> {
    // 初始化任务存储
    console.log(`任务服务初始化，存储路径: ${this.storagePath}`);
  }

  async createTask(input: CreateTaskInput): Promise<ApiResponse<TaskInfo>> {
    const task: TaskInfo = {
      id: uuidv4(),
      title: input.title,
      description: input.description || "",
      status: "pending",
      assignee: input.assignee,
      dueDate: input.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tasks.set(task.id, task);
    
    return {
      success: true,
      data: task,
      statusCode: 201,
    };
  }

  async getTask(taskId: string): Promise<ApiResponse<TaskInfo | null>> {
    const task = this.tasks.get(taskId) || null;
    
    return {
      success: true,
      data: task,
      statusCode: task ? 200 : 404,
    };
  }

  async listTasks(filters?: {
    status?: TaskInfo["status"];
    assignee?: string;
  }): Promise<ApiResponse<TaskInfo[]>> {
    let tasks = Array.from(this.tasks.values());

    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }

    if (filters?.assignee) {
      tasks = tasks.filter(t => t.assignee === filters.assignee);
    }

    // 按创建时间倒序
    tasks.sort((a, b) => b.createdAt - a.createdAt);

    return {
      success: true,
      data: tasks,
      statusCode: 200,
    };
  }

  async updateTask(
    taskId: string,
    updates: Partial<Omit<TaskInfo, "id" | "createdAt">>
  ): Promise<ApiResponse<TaskInfo | null>> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return { success: false, error: "任务不存在", statusCode: 404 };
    }

    const updatedTask: TaskInfo = {
      ...task,
      ...updates,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);

    return {
      success: true,
      data: updatedTask,
      statusCode: 200,
    };
  }

  async startTask(taskId: string): Promise<ApiResponse<TaskInfo | null>> {
    return this.updateTask(taskId, { status: "in_progress" });
  }

  async completeTask(taskId: string): Promise<ApiResponse<TaskInfo | null>> {
    return this.updateTask(taskId, { status: "completed" });
  }

  async failTask(taskId: string): Promise<ApiResponse<TaskInfo | null>> {
    return this.updateTask(taskId, { status: "failed" });
  }

  async deleteTask(taskId: string): Promise<ApiResponse> {
    const deleted = this.tasks.delete(taskId);
    
    return {
      success: deleted,
      error: deleted ? undefined : "任务不存在",
      statusCode: deleted ? 200 : 404,
    };
  }

  async getMyTasks(assignee: string): Promise<ApiResponse<TaskInfo[]>> {
    return this.listTasks({ assignee });
  }

  async getPendingTasks(): Promise<ApiResponse<TaskInfo[]>> {
    return this.listTasks({ status: "pending" });
  }

  async getOverdueTasks(): Promise<ApiResponse<TaskInfo[]>> {
    const now = Date.now();
    const overdueTasks = Array.from(this.tasks.values()).filter(
      t => t.dueDate && t.dueDate < now && t.status !== "completed"
    );

    return {
      success: true,
      data: overdueTasks,
      statusCode: 200,
    };
  }

  async getTaskStats(): Promise<ApiResponse<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }>> {
    const tasks = Array.from(this.tasks.values());

    return {
      success: true,
      data: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === "pending").length,
        inProgress: tasks.filter(t => t.status === "in_progress").length,
        completed: tasks.filter(t => t.status === "completed").length,
        failed: tasks.filter(t => t.status === "failed").length,
      },
      statusCode: 200,
    };
  }
}

export const createTaskService = (config: TaskServiceConfig): TaskService => {
  return new TaskService(config);
};
