import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ 知识库工具 ============

export function createKnowledgeBaseTools(
  config: Config["services"]["knowledgeBase"]
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

  // 搜索知识库
  const searchTool: Tool = {
    name: "kb_search",
    description: "搜索知识库",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        category: { type: "string", description: "文档分类" },
        limit: { type: "number", description: "返回结果数量" },
      },
      required: ["query"],
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/search`;
        const queryParams = new URLSearchParams({
          q: String(params.query),
        });

        if (params.category) {
          queryParams.set("category", String(params.category));
        }
        if (params.limit) {
          queryParams.set("limit", String(params.limit));
        }

        const response = await fetch(`${url}?${queryParams.toString()}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`知识库 API 错误: ${response.status}`);
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
          error: `搜索知识库失败: ${error}`,
        };
      }
    },
  };

  // 获取文档
  const getDocumentTool: Tool = {
    name: "kb_get_document",
    description: "获取知识库文档",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "文档ID" },
        format: {
          type: "string",
          enum: ["markdown", "html", "text"],
          description: "返回格式",
        },
      },
      required: ["documentId"],
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/documents/${params.documentId}`;
        if (params.format) {
          url += `?format=${params.format}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`知识库 API 错误: ${response.status}`);
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
          error: `获取文档失败: ${error}`,
        };
      }
    },
  };

  // 创建文档
  const createDocumentTool: Tool = {
    name: "kb_create_document",
    description: "创建知识库文档",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "文档标题" },
        content: { type: "string", description: "文档内容（Markdown）" },
        category: { type: "string", description: "分类" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "标签",
        },
      },
      required: ["title", "content"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/documents`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`知识库 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            documentId: data.id,
            title: data.title,
            url: data.url,
            message: "文档创建成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `创建文档失败: ${error}`,
        };
      }
    },
  };

  // 更新文档
  const updateDocumentTool: Tool = {
    name: "kb_update_document",
    description: "更新知识库文档",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "string", description: "文档ID" },
        title: { type: "string", description: "新标题" },
        content: { type: "string", description: "新内容" },
        category: { type: "string", description: "新分类" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "新标签",
        },
      },
      required: ["documentId"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/documents/${params.documentId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`知识库 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            documentId: params.documentId,
            message: "文档更新成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `更新文档失败: ${error}`,
        };
      }
    },
  };

  // 获取分类列表
  const categoryListTool: Tool = {
    name: "kb_categories",
    description: "获取知识库分类列表",
    inputSchema: {
      type: "object",
      properties: {
        parentId: { type: "string", description: "上级分类ID" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/categories`;
        if (params.parentId) {
          url += `?parent_id=${params.parentId}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`知识库 API 错误: ${response.status}`);
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
          error: `获取分类列表失败: ${error}`,
        };
      }
    },
  };

  return [searchTool, getDocumentTool, createDocumentTool, updateDocumentTool, categoryListTool];
}
