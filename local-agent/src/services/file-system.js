/**
 * 文件系统服务示例
 *
 * ==================== 教学说明 ====================
 *
 * 什么是本地服务？
 * ---------------
 * 本地服务是通过 HTTP API 暴露的功能模块，Agent 可以通过调用这些服务
 * 来执行特定的任务。
 *
 * 为什么需要本地服务？
 * ---------------
 * 1. 模块化：将不同功能分离到独立服务
 * 2. 可扩展：轻松添加新的服务
 * 3. 安全性：可以在服务层实现权限控制
 * 4. 复用：多个 Agent 可以共享同一个服务
 *
 * 本示例实现了一个简单的文件系统服务，展示如何：
 * - 创建 Express 服务器
 * - 定义 API 端点
 * - 处理请求和响应
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

/**
 * 启动文件系统服务
 * @param {Object} options
 * @param {number} [options.port=3001] - 服务端口
 * @param {string} [options.baseDir='./workspace/files'] - 基础目录
 */
export async function startFileSystemService(options = {}) {
  const port = options.port || 3001;
  const baseDir = options.baseDir || './workspace/files';

  const app = express();
  app.use(cors());
  app.use(express.json());

  // 确保基础目录存在
  await fs.mkdir(baseDir, { recursive: true });

  // ==================== API 端点 ====================

  /**
   * 健康检查
   * GET /api/health
   */
  app.get('/api/health', (req, res) => {
    res.json({
      service: 'file-system',
      status: 'ok',
      baseDir,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * 列出目录内容
   * POST /api/list
   *
   * 请求体：{ dir: string }
   * 返回：{ success: boolean, data: Array<{name: string, type: string}> }
   */
  app.post('/api/list', async (req, res) => {
    try {
      const { dir = '.' } = req.body;
      const targetPath = path.resolve(baseDir, dir);

      // 安全检查：确保路径在 baseDir 内
      if (!targetPath.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      const result = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      }));

      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 读取文件
   * POST /api/read
   *
   * 请求体：{ filepath: string }
   * 返回：{ success: boolean, data: string }
   */
  app.post('/api/read', async (req, res) => {
    try {
      const { filepath } = req.body;
      const targetPath = path.resolve(baseDir, filepath);

      // 安全检查
      if (!targetPath.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      const content = await fs.readFile(targetPath, 'utf-8');
      res.json({ success: true, data: content });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 写入文件
   * POST /api/write
   *
   * 请求体：{ filepath: string, content: string }
   * 返回：{ success: boolean }
   */
  app.post('/api/write', async (req, res) => {
    try {
      const { filepath, content } = req.body;
      const targetPath = path.resolve(baseDir, filepath);

      // 安全检查
      if (!targetPath.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      // 确保目录存在
      const dir = path.dirname(targetPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(targetPath, content, 'utf-8');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 删除文件
   * POST /api/delete
   *
   * 请求体：{ filepath: string }
   * 返回：{ success: boolean }
   */
  app.post('/api/delete', async (req, res) => {
    try {
      const { filepath } = req.body;
      const targetPath = path.resolve(baseDir, filepath);

      // 安全检查
      if (!targetPath.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      await fs.unlink(targetPath);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 获取文件信息
   * POST /api/info
   *
   * 请求体：{ filepath: string }
   * 返回：{ success: boolean, data: { size: number, created: Date, modified: Date } }
   */
  app.post('/api/info', async (req, res) => {
    try {
      const { filepath } = req.body;
      const targetPath = path.resolve(baseDir, filepath);

      // 安全检查
      if (!targetPath.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      const stats = await fs.stat(targetPath);

      res.json({
        success: true,
        data: {
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
        },
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 搜索文件
   * POST /api/search
   *
   * 请求体：{ pattern: string, dir?: string }
   * 返回：{ success: boolean, data: string[] }
   */
  app.post('/api/search', async (req, res) => {
    try {
      const { pattern, dir = '.' } = req.body;
      const targetDir = path.resolve(baseDir, dir);

      // 安全检查
      if (!targetDir.startsWith(path.resolve(baseDir))) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: path outside base directory',
        });
      }

      const results = [];
      const entries = await fs.readdir(targetDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.includes(pattern)) {
          results.push(entry.name);
        }

        // 递归搜索子目录
        if (entry.isDirectory()) {
          const subPath = path.join(dir, entry.name);
          const subResults = await searchRecursive(path.join(baseDir, subPath), pattern);
          results.push(...subResults.map(p => path.join(subPath, p)));
        }
      }

      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 递归搜索辅助函数
   */
  async function searchRecursive(dir, pattern) {
    const results = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.includes(pattern)) {
        results.push(entry.name);
      }

      if (entry.isDirectory()) {
        const subResults = await searchRecursive(path.join(dir, entry.name), pattern);
        results.push(...subResults.map(p => path.join(entry.name, p)));
      }
    }

    return results;
  }

  // ==================== 启动服务器 ====================

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`\n========================================`);
      console.log(`  File System Service`);
      console.log(`========================================`);
      console.log(`  Running on: http://localhost:${port}`);
      console.log(`  Base directory: ${baseDir}`);
      console.log(`  API endpoints:`);
      console.log(`    - GET  /api/health`);
      console.log(`    - POST /api/list`);
      console.log(`    - POST /api/read`);
      console.log(`    - POST /api/write`);
      console.log(`    - POST /api/delete`);
      console.log(`    - POST /api/info`);
      console.log(`    - POST /api/search`);
      console.log(`========================================\n`);

      resolve({ app, server });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please choose a different port.`);
      } else {
        console.error(`Failed to start file system service: ${error}`);
      }
      process.exit(1);
    });
  });
}

// 如果直接运行此文件，启动服务
if (import.meta.url === `file://${process.argv[1]}`) {
  startFileSystemService().catch(console.error);
}
