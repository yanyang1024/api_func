import type { Tool } from "../agent/types.js";
import type { Config } from "../config/index.js";

// ============ 执行工具 ============

export function createExecTool(config: Config): Tool {
  const deniedPatterns = config.security.deniedPatterns;

  const isDangerousCommand = (cmd: string): boolean => {
    for (const pattern of deniedPatterns) {
      if (cmd.includes(pattern)) {
        return true;
      }
    }
    return false;
  };

  return {
    name: "exec",
    description: "执行 Shell 命令",
    inputSchema: {
      type: "object",
      properties: {
        cmd: { type: "string", description: "要执行的命令" },
        timeout: { type: "number", description: "超时时间（毫秒）" },
        workdir: { type: "string", description: "工作目录" },
        env: {
          type: "object",
          description: "环境变量",
        },
      },
      required: ["cmd"],
    },
    async execute(params, context) {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");

      const execAsync = promisify(exec);

      const cmd = String(params.cmd);

      // 安全检查
      if (isDangerousCommand(cmd)) {
        return {
          success: false,
          output: null,
          error: `命令被拒绝：包含危险模式`,
        };
      }

      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: params.workdir || process.cwd(),
          env: {
            ...process.env,
            ...(params.env as Record<string, string>),
          },
          timeout: params.timeout || 30000,
        });

        return {
          success: true,
          output: {
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: 0,
          },
        };
      } catch (error: any) {
        return {
          success: false,
          output: {
            stdout: error.stdout || "",
            stderr: error.stderr || "",
            exitCode: error.code || 1,
          },
          error: `命令执行失败: ${error.message}`,
        };
      }
    },
  };
}

// ============ 工具工厂 ============

import type { Config as ConfigType } from "../config/index.js";
import { createHRServiceTools } from "./services/hr.js";
import { createOATools } from "./services/oa.js";
import { createFileServerTools } from "./services/file.js";
import { createMailTools } from "./services/mail.js";
import { createProjectManagementTools } from "./services/project.js";
import { createKnowledgeBaseTools } from "./services/knowledge.js";
import { createBaseTools } from "./index.js";

export function createAllTools(config: ConfigType, workspaceDir: string): Tool[] {
  const tools: Tool[] = [];

  // 基础工具
  tools.push(...createBaseTools({ workspaceDir, config }));

  // 执行工具
  tools.push(createExecTool(config));

  // HR 服务
  if (config.services.hr) {
    tools.push(...createHRServiceTools(config.services.hr));
  }

  // OA 服务
  if (config.services.oa) {
    tools.push(...createOATools(config.services.oa));
  }

  // 文件服务器
  if (config.services.fileServer) {
    tools.push(...createFileServerTools(config.services.fileServer));
  }

  // 邮件服务
  if (config.services.mail) {
    tools.push(...createMailTools(config.services.mail));
  }

  // 项目管理
  if (config.services.projectManagement) {
    tools.push(...createProjectManagementTools(config.services.projectManagement));
  }

  // 知识库
  if (config.services.knowledgeBase) {
    tools.push(...createKnowledgeBaseTools(config.services.knowledgeBase));
  }

  return tools;
}
