import type { Config } from "../config/index.js";
import { LocalAgent } from "../agent/agent.js";
import { SessionManager } from "../context/index.js";
import { createOllamaProvider } from "../agent/providers/ollama.js";
import { createAllTools } from "../tools/exec.js";
import type { AgentParams } from "../agent/types.js";

export interface RunAgentOptions {
  prompt: string;
  sessionId?: string;
  sessionKey?: string;
  timeout?: number;
  thinkLevel?: "off" | "on" | "stream";
}

export async function runAgent(
  config: Config,
  options: RunAgentOptions
): Promise<{
  success: boolean;
  content: string;
  sessionId: string;
  sessionKey: string;
  error?: string;
}> {
  // 创建会话密钥
  const sessionId = options.sessionId || `session_${Date.now()}`;
  const sessionKey = options.sessionKey || `local:${sessionId}`;

  // 初始化组件
  const sessionManager = new SessionManager({
    maxTurns: config.agent.maxHistoryTurns,
    contextWindow: config.ollama.contextWindow,
    enableCompression: true,
  });

  // 创建 Provider
  const provider = createOllamaProvider(config.ollama);

  // 创建 Agent
  const agent = new LocalAgent(provider, sessionManager, config);

  // 注册工具
  const workspaceDir = process.cwd();
  const tools = createAllTools(config, workspaceDir);
  for (const tool of tools) {
    agent.registerTool(tool);
  }

  // 创建或获取会话
  let session = sessionManager.getSession(sessionKey);
  if (!session) {
    session = sessionManager.createSession(sessionKey, {
      model: config.ollama.model,
    });
  }

  // 设置系统提示词
  if (session.messages.length === 0) {
    sessionManager.addMessage(sessionKey, {
      role: "system",
      content: buildSystemPrompt(),
      timestamp: Date.now(),
    });
  }

  // 运行 Agent
  const result = await agent.run({
    sessionId,
    sessionKey,
    prompt: options.prompt,
    timeout: options.timeout,
    thinkLevel: options.thinkLevel,
  });

  return {
    success: result.success,
    content: result.content,
    sessionId,
    sessionKey,
    error: result.error,
  };
}

function buildSystemPrompt(): string {
  return `你是一个企业内网智能助手，帮助用户完成各种任务。

## 可用工具
- read: 读取文件
- write: 写入文件
- edit: 编辑文件
- list_dir: 列出目录
- exec: 执行 Shell 命令
- hr_get_employee: 查询员工信息
- hr_get_department: 查询部门信息
- hr_leave_request: 请假申请
- hr_get_attendance: 查询考勤
- oa_approval_list: 审批列表
- oa_create_approval: 发起审批
- oa_approval_action: 审批操作
- oa_notice_list: 公告列表
- file_list: 列出文件
- file_upload: 上传文件
- file_download: 下载文件
- file_mkdir: 创建目录
- file_delete: 删除文件
- mail_send: 发送邮件
- mail_send_template: 发送模板邮件
- pm_projects: 项目列表
- pm_tasks: 任务列表
- pm_create_task: 创建任务
- pm_update_task: 更新任务
- pm_log_time: 记录工时
- kb_search: 搜索知识库
- kb_get_document: 获取文档
- kb_create_document: 创建文档
- kb_update_document: 更新文档
- kb_categories: 分类列表

## 使用规则
1. 当需要使用工具时，使用以下格式：
<tool_calls>
[{"name": "工具名", "arguments": {"参数": "值"}}]
</tool_calls>

2. 请始终用中文回答
3. 遵守企业数据安全规范`;
}
