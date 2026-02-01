import { ApiResponse } from "../core/types.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface FileServiceConfig {
  baseDir: string;
  maxFileSize: number;
  allowedExtensions: string[];
}

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: number;
  createdAt: number;
  extension: string;
}

export interface ReadFileOptions {
  encoding?: string;
  offset?: number;
  limit?: number;
}

export interface WriteFileOptions {
  encoding?: string;
  mode?: number;
}

export class FileService {
  private config: FileServiceConfig;

  constructor(config: FileServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.config.baseDir, { recursive: true });
  }

  async list(dir: string, recursive: boolean = false): Promise<ApiResponse<FileInfo[]>> {
    const fullPath = path.join(this.config.baseDir, dir);
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files: FileInfo[] = [];

      for (const entry of entries) {
        const fullEntryPath = path.join(fullPath, entry.name);
        const stat = await fs.stat(fullEntryPath);

        files.push({
          name: entry.name,
          path: path.join(dir, entry.name),
          size: stat.size,
          isDirectory: entry.isDirectory(),
          modifiedAt: stat.mtimeMs,
          createdAt: stat.birthtimeMs,
          extension: entry.isDirectory() ? "" : path.extname(entry.name),
        });
      }

      if (recursive) {
        // 递归列出子目录
        for (const file of files) {
          if (file.isDirectory) {
            const subFiles = await this.list(path.join(dir, file.name), true);
            if (subFiles.data) {
              files.push(...subFiles.data.map(f => ({ ...f, path: path.join(file.name, f.path) })));
            }
          }
        }
      }

      return { success: true, data: files, statusCode: 200 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async read(filePath: string, options?: ReadFileOptions): Promise<ApiResponse<string>> {
    const fullPath = path.join(this.config.baseDir, filePath);

    try {
      // 检查文件大小
      const stat = await fs.stat(fullPath);
      if (stat.size > this.config.maxFileSize) {
        return {
          success: false,
          error: `文件大小超过限制: ${stat.size} > ${this.config.maxFileSize}`,
          statusCode: 413,
        };
      }

      // 检查扩展名
      const ext = path.extname(filePath).toLowerCase();
      if (!this.config.allowedExtensions.includes(ext)) {
        return {
          success: false,
          error: `不支持的文件类型: ${ext}`,
          statusCode: 403,
        };
      }

      const content = await fs.readFile(fullPath, {
        encoding: options?.encoding || "utf-8",
        start: options?.offset,
        end: options?.limit ? (options.offset || 0) + options.limit - 1 : undefined,
      });

      return { success: true, data: content, statusCode: 200 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async write(
    filePath: string,
    content: string,
    options?: WriteFileOptions
  ): Promise<ApiResponse<FileInfo>> {
    const fullPath = path.join(this.config.baseDir, filePath);
    const dir = path.dirname(fullPath);

    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.writeFile(fullPath, content, {
        encoding: options?.encoding || "utf-8",
        mode: options?.mode,
      });

      const stat = await fs.stat(fullPath);

      return {
        success: true,
        data: {
          name: path.basename(filePath),
          path: filePath,
          size: stat.size,
          isDirectory: false,
          modifiedAt: stat.mtimeMs,
          createdAt: stat.birthtimeMs,
          extension: path.extname(filePath),
        },
        statusCode: 201,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async createDirectory(dirPath: string): Promise<ApiResponse> {
    const fullPath = path.join(this.config.baseDir, dirPath);

    try {
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true, statusCode: 201 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async delete(filePath: string): Promise<ApiResponse> {
    const fullPath = path.join(this.config.baseDir, filePath);

    try {
      const stat = await fs.stat(fullPath);
      
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true });
      } else {
        await fs.unlink(fullPath);
      }

      return { success: true, statusCode: 200 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async copy(srcPath: string, destPath: string): Promise<ApiResponse> {
    const srcFull = path.join(this.config.baseDir, srcPath);
    const destFull = path.join(this.config.baseDir, destPath);
    const destDir = path.dirname(destFull);

    try {
      await fs.mkdir(destDir, { recursive: true });
      
      const stat = await fs.stat(srcFull);
      if (stat.isDirectory()) {
        await fs.cp(srcFull, destFull, { recursive: true });
      } else {
        await fs.copyFile(srcFull, destFull);
      }

      return { success: true, statusCode: 201 };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async move(srcPath: string, destPath: string): Promise<ApiResponse> {
    const copyResult = await this.copy(srcPath, destPath);
    if (!copyResult.success) {
      return copyResult;
    }

    return this.delete(srcPath);
  }

  async exists(filePath: string): Promise<ApiResponse<boolean>> {
    const fullPath = path.join(this.config.baseDir, filePath);

    try {
      await fs.access(fullPath);
      return { success: true, data: true, statusCode: 200 };
    } catch {
      return { success: true, data: false, statusCode: 200 };
    }
  }

  async getInfo(filePath: string): Promise<ApiResponse<FileInfo | null>> {
    const fullPath = path.join(this.config.baseDir, filePath);

    try {
      const stat = await fs.stat(fullPath);

      return {
        success: true,
        data: {
          name: path.basename(filePath),
          path: filePath,
          size: stat.size,
          isDirectory: stat.isDirectory(),
          modifiedAt: stat.mtimeMs,
          createdAt: stat.birthtimeMs,
          extension: stat.isDirectory() ? "" : path.extname(filePath),
        },
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
        statusCode: 500,
      };
    }
  }

  async search(query: string, dir: string = "/"): Promise<ApiResponse<FileInfo[]>> {
    const results: FileInfo[] = [];
    const queryLower = query.toLowerCase();

    const listResult = await this.list(dir, true);
    if (!listResult.data) {
      return { success: false, error: listResult.error, statusCode: 500 };
    }

    for (const file of listResult.data) {
      if (file.name.toLowerCase().includes(queryLower)) {
        results.push(file);
      }
    }

    return { success: true, data: results, statusCode: 200 };
  }
}

export const createFileService = (config: Partial<FileServiceConfig> = {}): FileService => {
  return new FileService({
    baseDir: config.baseDir || "./workspace",
    maxFileSize: config.maxFileSize || 10 * 1024 * 1024,
    allowedExtensions: config.allowedExtensions || [
      ".txt", ".md", ".json", ".yaml", ".yml",
      ".js", ".ts", ".py", ".java", ".go",
      ".html", ".css", ".xml", ".csv",
    ],
  });
};
