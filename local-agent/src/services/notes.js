/**
 * 笔记服务示例
 *
 * ==================== 教学说明 ====================
 *
 * 这个服务展示了如何创建一个简单的笔记管理 API：
 * - CRUD 操作（创建、读取、更新、删除）
 * - 搜索功能
 * - 标签系统
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';

/**
 * 笔记数据存储
 */
const notes = new Map();
let nextId = 1;

/**
 * 启动笔记服务
 * @param {Object} options
 * @param {number} [options.port=3004]
 */
export async function startNotesService(options = {}) {
  const port = options.port || 3004;

  const app = express();
  app.use(cors());
  app.use(express.json());

  // ==================== API 端点 ====================

  /**
   * 健康检查
   */
  app.get('/api/health', (req, res) => {
    res.json({
      service: 'notes',
      status: 'ok',
      count: notes.size,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * 列出所有笔记
   * GET /api/list
   */
  app.get('/api/list', (req, res) => {
    const allNotes = Array.from(notes.values()).sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      data: allNotes,
    });
  });

  /**
   * 获取单个笔记
   * POST /api/get
   * { id: number }
   */
  app.post('/api/get', (req, res) => {
    const { id } = req.body;
    const note = notes.get(id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    res.json({ success: true, data: note });
  });

  /**
   * 创建笔记
   * POST /api/create
   * { title: string, content: string, tags?: string[] }
   */
  app.post('/api/create', async (req, res) => {
    const { title, content, tags = [] } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Title and content are required',
      });
    }

    const note = {
      id: nextId++,
      title,
      content,
      tags: Array.isArray(tags) ? tags : [tags],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    notes.set(note.id, note);

    res.json({ success: true, data: note });
  });

  /**
   * 更新笔记
   * POST /api/update
   * { id: number, title?: string, content?: string, tags?: string[] }
   */
  app.post('/api/update', (req, res) => {
    const { id, title, content, tags } = req.body;
    const note = notes.get(id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (tags !== undefined) note.tags = Array.isArray(tags) ? tags : [tags];
    note.updatedAt = new Date().toISOString();

    res.json({ success: true, data: note });
  });

  /**
   * 删除笔记
   * POST /api/delete
   * { id: number }
   */
  app.post('/api/delete', (req, res) => {
    const { id } = req.body;

    if (!notes.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Note not found',
      });
    }

    notes.delete(id);

    res.json({ success: true });
  });

  /**
   * 搜索笔记
   * POST /api/search
   * { query: string }
   */
  app.post('/api/search', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    const lowerQuery = query.toLowerCase();
    const results = Array.from(notes.values()).filter(note => {
      return (
        note.title.toLowerCase().includes(lowerQuery) ||
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });

    res.json({ success: true, data: results });
  });

  /**
   * 按标签获取笔记
   * POST /api/by-tag
   * { tag: string }
   */
  app.post('/api/by-tag', (req, res) => {
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({
        success: false,
        error: 'Tag is required',
      });
    }

    const lowerTag = tag.toLowerCase();
    const results = Array.from(notes.values()).filter(note => {
      return note.tags.some(t => t.toLowerCase() === lowerTag);
    });

    res.json({ success: true, data: results });
  });

  // ==================== 启动服务器 ====================

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`\n========================================`);
      console.log(`  Notes Service`);
      console.log(`========================================`);
      console.log(`  Running on: http://localhost:${port}`);
      console.log(`  API endpoints:`);
      console.log(`    - GET  /api/health`);
      console.log(`    - GET  /api/list`);
      console.log(`    - POST /api/get`);
      console.log(`    - POST /api/create`);
      console.log(`    - POST /api/update`);
      console.log(`    - POST /api/delete`);
      console.log(`    - POST /api/search`);
      console.log(`    - POST /api/by-tag`);
      console.log(`========================================\n`);

      resolve({ app, server });
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use.`);
      } else {
        console.error(`Failed to start notes service: ${error}`);
      }
      process.exit(1);
    });
  });
}

// 如果直接运行此文件，启动服务
if (import.meta.url === `file://${process.argv[1]}`) {
  startNotesService().catch(console.error);
}
