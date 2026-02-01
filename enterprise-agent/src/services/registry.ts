import { ApiResponse } from "../core/types.js";
import { createDatabaseService, DatabaseService } from "./database.js";
import { createSearchService, SearchService } from "./search.js";
import { createTaskService, TaskService } from "./task.js";
import { createNotificationService, NotificationService } from "./notification.js";
import { createFileService, FileService } from "./file.js";

export interface ServiceRegistryConfig {
  database?: Parameters<typeof createDatabaseService>[0];
  search?: Parameters<typeof createSearchService>[0];
  task?: Parameters<typeof createTaskService>[0];
  notification?: Parameters<typeof createNotificationService>[0];
  file?: Parameters<typeof createFileService>[0];
}

export class ServiceRegistry {
  private services: Map<string, any> = new Map();
  private initialized: Set<string> = new Set();

  constructor(private config: ServiceRegistryConfig) {}

  async initializeAll(): Promise<void> {
    // 初始化所有服务
    for (const [name, factory] of this.getServiceFactories()) {
      try {
        const service = factory();
        if (service.initialize) {
          await service.initialize();
        }
        this.services.set(name, service);
        this.initialized.add(name);
        console.log(`服务已初始化: ${name}`);
      } catch (error) {
        console.error(`服务初始化失败: ${name}`, error);
      }
    }
  }

  private getServiceFactories(): Iterable<[string, () => any]> {
    return [
      ["database", () => createDatabaseService(this.config.database!)],
      ["search", () => createSearchService(this.config.search!)],
      ["task", () => createTaskService(this.config.task!)],
      ["notification", () => createNotificationService(this.config.notification!)],
      ["file", () => createFileService(this.config.file)],
    ];
  }

  get<T = any>(name: string): T | null {
    return this.services.get(name) || null;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  isInitialized(name: string): boolean {
    return this.initialized.has(name);
  }

  getDatabase(): DatabaseService | null {
    return this.get<DatabaseService>("database");
  }

  getSearch(): SearchService | null {
    return this.get<SearchService>("search");
  }

  getTask(): TaskService | null {
    return this.get<TaskService>("task");
  }

  getNotification(): NotificationService | null {
    return this.get<NotificationService>("notification");
  }

  getFile(): FileService | null {
    return this.get<FileService>("file");
  }

  async closeAll(): Promise<void> {
    for (const [name, service] of this.services) {
      if (service.close) {
        await service.close();
      }
      console.log(`服务已关闭: ${name}`);
    }
    this.services.clear();
    this.initialized.clear();
  }

  async getServiceStats(): Promise<Record<string, { initialized: boolean; type: string }>> {
    const stats: Record<string, { initialized: boolean; type: string }> = {};
    
    for (const [name, service] of this.services) {
      stats[name] = {
        initialized: this.initialized.has(name),
        type: service.constructor?.name || "unknown",
      };
    }

    return stats;
  }
}

export const createServiceRegistry = (config: ServiceRegistryConfig): ServiceRegistry => {
  return new ServiceRegistry(config);
};
