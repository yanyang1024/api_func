import { describe, it, expect, beforeEach } from "vitest";
import { TaskService, createTaskService } from "../src/services/task.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, "test-data", `task-test-${Date.now()}`);

describe("TaskService", () => {
  let taskService: TaskService;

  beforeEach(async () => {
    taskService = createTaskService({ storagePath: TEST_DIR });
    await taskService.initialize();
  });

  it("should create task", async () => {
    const result = await taskService.createTask({
      title: "完成报告",
      description: "撰写季度报告",
      assignee: "张三",
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.title).toBe("完成报告");
    expect(result.data?.status).toBe("pending");
  });

  it("should get task", async () => {
    const createResult = await taskService.createTask({
      title: "测试任务",
    });

    const getResult = await taskService.getTask(createResult.data!.id);

    expect(getResult.success).toBe(true);
    expect(getResult.data?.title).toBe("测试任务");
  });

  it("should list tasks", async () => {
    await taskService.createTask({ title: "任务1" });
    await taskService.createTask({ title: "任务2" });
    await taskService.createTask({ title: "任务3", status: "completed" });

    const allTasks = await taskService.listTasks();
    expect(allTasks.data?.length).toBe(3);

    const pendingTasks = await taskService.listTasks({ status: "pending" });
    expect(pendingTasks.data?.length).toBe(2);
  });

  it("should update task", async () => {
    const createResult = await taskService.createTask({
      title: "原始标题",
    });

    const updateResult = await taskService.updateTask(createResult.data!.id, {
      title: "新标题",
      status: "in_progress",
    });

    expect(updateResult.data?.title).toBe("新标题");
    expect(updateResult.data?.status).toBe("in_progress");
  });

  it("should start task", async () => {
    const createResult = await taskService.createTask({ title: "任务" });

    const startResult = await taskService.startTask(createResult.data!.id);

    expect(startResult.data?.status).toBe("in_progress");
  });

  it("should complete task", async () => {
    const createResult = await taskService.createTask({ title: "任务" });

    const completeResult = await taskService.completeTask(createResult.data!.id);

    expect(completeResult.data?.status).toBe("completed");
  });

  it("should delete task", async () => {
    const createResult = await taskService.createTask({ title: "待删除" });

    const deleteResult = await taskService.deleteTask(createResult.data!.id);
    expect(deleteResult.success).toBe(true);

    const getResult = await taskService.getTask(createResult.data!.id);
    expect(getResult.data).toBeNull();
  });

  it("should get task stats", async () => {
    await taskService.createTask({ title: "任务1" });
    await taskService.createTask({ title: "任务2" });
    await taskService.createTask({ title: "任务3" });
    
    const task2 = await taskService.createTask({ title: "任务4" });
    await taskService.startTask(task2.data!.id);
    
    const task3 = await taskService.createTask({ title: "任务5" });
    await taskService.completeTask(task3.data!.id);

    const stats = await taskService.getTaskStats();

    expect(stats.data?.total).toBe(5);
    expect(stats.data?.pending).toBe(2);
    expect(stats.data?.inProgress).toBe(1);
    expect(stats.data?.completed).toBe(1);
    expect(stats.data?.failed).toBe(0);
  });

  it("should get my tasks", async () => {
    await taskService.createTask({ title: "任务1", assignee: "张三" });
    await taskService.createTask({ title: "任务2", assignee: "李四" });
    await taskService.createTask({ title: "任务3", assignee: "张三" });

    const myTasks = await taskService.getMyTasks("张三");

    expect(myTasks.data?.length).toBe(2);
  });
});
