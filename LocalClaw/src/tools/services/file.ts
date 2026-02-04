import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ 文件服务器工具 ============

export function createFileServerTools(
  config: Config["services"]["fileServer"]
): Tool[] {
  if (!config?.enabled || !config.baseUrl) {
    return [];
  }

  const baseUrl = config.baseUrl;
  const token = config.token;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 列出文件
  const listFilesTool: Tool = {
    name: "file_list",
    description: "列出文件服务器上的文件",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "目录路径" },
        recursive: { type: "boolean", description: "是否递归列出" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/files`;
        const queryParams = new URLSearchParams();

        if (params.path) {
          queryParams.set("path", String(params.path));
        }
        if (params.recursive) {
          queryParams.set("recursive", "true");
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`文件服务器 API 错误: ${response.status}`);
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
          error: `列出文件失败: ${error}`,
        };
      }
    },
  };

  // 上传文件
  const uploadFileTool: Tool = {
    name: "file_upload",
    description: "上传文件到文件服务器",
    inputSchema: {
      type: "object",
      properties: {
        localPath: { type: "string", description: "本地文件路径" },
        remotePath: { type: "string", description: "远程目标路径" },
        overwrite: { type: "boolean", description: "是否覆盖已存在文件" },
      },
      required: ["localPath", "remotePath"],
    },
    async execute(params, context) {
      try {
        const fs = await import("fs/promises");
        const path = await import("path");

        // 读取本地文件
        const content = await fs.readFile(String(params.localPath));
        const filename = path.basename(String(params.localPath));

        const formData = new FormData();
        formData.append("file", new Blob([content]), filename);
        formData.append("path", String(params.remotePath));
        if (params.overwrite) {
          formData.append("overwrite", "true");
        }

        const response = await fetch(`${baseUrl}/upload`, {
          method: "POST",
          headers: {
            Authorization: headers["Authorization"] || "",
          },
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`文件服务器 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            fileId: data.id,
            url: data.url,
            path: params.remotePath,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `上传文件失败: ${error}`,
        };
      }
    },
  };

  // 下载文件
  const downloadFileTool: Tool = {
    name: "file_download",
    description: "从文件服务器下载文件",
    inputSchema: {
      type: "object",
      properties: {
        remotePath: { type: "string", description: "远程文件路径" },
        localPath: { type: "string", description: "本地保存路径" },
      },
      required: ["remotePath"],
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/download`;
        const queryParams = new URLSearchParams({
          path: String(params.remotePath),
        });

        const response = await fetch(`${url}?${queryParams.toString()}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`文件服务器 API 错误: ${response.status}`);
        }

        const blob = await response.blob();

        if (params.localPath) {
          const fs = await import("fs/promises");
          await fs.writeFile(String(params.localPath), Buffer.from(await blob.arrayBuffer()));
        }

        return {
          success: true,
          output: {
            path: params.remotePath,
            size: blob.size,
            contentType: blob.type,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `下载文件失败: ${error}`,
        };
      }
    },
  };

  // 创建目录
  const createDirTool: Tool = {
    name: "file_mkdir",
    description: "在文件服务器上创建目录",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "目录路径" },
      },
      required: ["path"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/directories`, {
          method: "POST",
          headers,
          body: JSON.stringify({ path: params.path }),
        });

        if (!response.ok) {
          throw new Error(`文件服务器 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            path: data.path,
            message: "目录创建成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `创建目录失败: ${error}`,
        };
      }
    },
  };

  // 删除文件
  const deleteFileTool: Tool = {
    name: "file_delete",
    description: "删除文件服务器上的文件",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
        recursive: { type: "boolean", description: "是否递归删除目录" },
      },
      required: ["path"],
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/files`;
        const queryParams = new URLSearchParams({
          path: String(params.path),
        });

        const response = await fetch(`${url}?${queryParams.toString()}`, {
          method: "DELETE",
          headers,
        });

        if (!response.ok) {
          throw new Error(`文件服务器 API 错误: ${response.status}`);
        }

        return {
          success: true,
          output: {
            path: params.path,
            message: "文件删除成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `删除文件失败: ${error}`,
        };
      }
    },
  };

  return [listFilesTool, uploadFileTool, downloadFileTool, createDirTool, deleteFileTool];
}
