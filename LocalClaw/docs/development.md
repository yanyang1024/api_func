---
title: 开发指南
description: LocalClaw 企业内网离线 Agent 框架完整开发指南
icon: 📚
---

# LocalClaw 开发指南

> 本文档详细介绍 LocalClaw 的架构设计、核心组件和扩展开发方法。

## 目录

1. [项目概述](#项目概述)
2. [核心架构](#核心架构)
3. [上下文工程](#上下文工程)
4. [工具系统](#工具系统)
5. [服务集成](#服务集成)
6. [CLI 设计](#cli-设计)
7. [Gateway 开发](#gateway-开发)
8. [扩展开发](#扩展开发)
9. [配置参考](#配置参考)

---

## 项目概述

### 什么是 LocalClaw？

LocalClaw 是一个**企业内网离线 Agent 框架**，基于 OpenClaw 设计思想，专为企业内网环境打造：

```
┌─────────────────────────────────────────────────────────────┐
│                      LocalClaw 核心特性                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔒 离线运行    - 无需外网，基于本地 Ollama                   │
│  🏢 企业集成    - 支持 HR、OA、文件服务器等企业服务           │
│  🔧 工具丰富    - 开箱即用的企业工具集                         │
│  📡 Gateway API - HTTP/WebSocket API 支持二次开发            │
│  🛡️ 安全可控    - 完整的权限控制和沙箱机制                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 设计理念

LocalClaw 借鉴了 OpenClaw 的核心设计，但进行了简化以适应内网环境：

| OpenClaw | LocalClaw | 说明 |
|----------|-----------|------|
| 多 Provider | 仅 Ollama | 简化模型层 |
| 复杂渠道 | Gateway API | 简化接入 |
| 完整插件 | 轻量扩展 | 简化扩展 |
| 在线服务 | 内网服务 | 适应内网 |

---

## 核心架构

### 项目结构

```
localclaw/
├── src/
│   ├── agent/          # Agent 核心
│   │   ├── agent.ts    # 主 Agent 类
│   │   ├── types.ts    # 类型定义
│   │   └── providers/  # LLM Provider
│   │       └── ollama.ts
│   ├── tools/          # 工具系统
│   │   ├── index.ts    # 基础工具
│   │   ├── exec.ts     # 执行工具
│   │   └── services/   # 服务工具
│   │       ├── hr.ts
│   │       ├── oa.ts
│   │       ├── file.ts
│   │       ├── mail.ts
│   │       ├── project.ts
│   │       └── knowledge.ts
│   ├── context/        # 上下文管理
│   │   └── index.ts
│   ├── cli/             # CLI
│   │   ├── index.ts
│   │   ├── interactive.ts
│   │   ├── run.ts
│   │   ├── session.ts
│   │   ├── tools.ts
│   │   └── config.ts
│   ├── gateway/         # Gateway 服务
│   │   └── index.ts
│   ├── sandbox/         # 沙箱
│   │   └── index.ts
│   └── config/          # 配置
│       └── index.ts
├── docs/                # 文档
├── tests/               # 测试
└── package.json
```

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                       数据流程                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  用户输入                                                    │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. 消息解析                                        │    │
│  │     - 解析提示词                                    │    │
│  │     - 处理特殊指令                                  │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  2. 上下文管理                                      │    │
│  │     - 加载历史消息                                  │    │
│  │     - 检查窗口限制                                  │    │
│  │     - 压缩（如需要）                                │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  3. Agent 循环                                      │    │
│  │     - 调用 LLM                                       │    │
│  │     - 解析工具调用                                  │    │
│  │     - 执行工具                                      │    │
│  │     - 结果反馈                                      │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  4. 结果输出                                        │    │
│  │     - 返回文本结果                                  │    │
│  │     - 保存会话历史                                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  用户结果                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 上下文工程

### 核心概念

上下文工程是 Agent 的"记忆系统"，LocalClaw 实现了以下功能：

```
┌─────────────────────────────────────────────────────────────┐
│                     上下文管理功能                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 消息历史管理                                             │
│     - 按轮次计算（User Turn）                                │
│     - 自动截断超限历史                                        │
│     - 渠道差异化配置                                          │
│                                                             │
│  2. Token 估算                                               │
│     - 中文：约 2 tokens/字                                   │
│     - 英文：约 4 chars/token                                 │
│     - 工具调用：额外 +100 tokens                             │
│                                                             │
│  3. 窗口检查                                                 │
│     - 实时监控使用量                                          │
│     - 80% 警告阈值                                           │
│     - 溢出保护                                                │
│                                                             │
│  4. 自动压缩                                                 │
│     - 保留最近 5 轮                                           │
│     - 摘要早期消息                                           │
│     - 智能合并                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 使用示例

```typescript
import { SessionManager, checkContextWindow } from "./context";

// 创建会话管理器
const manager = new SessionManager({
  maxTurns: 50,           // 最多 50 轮
  contextWindow: 131072,  // 上下文窗口
  enableCompression: true, // 启用压缩
});

// 创建会话
const session = manager.createSession("test:session-1");

// 添加消息
manager.addMessage("test:session-1", {
  role: "user",
  content: "帮我查询员工信息",
  timestamp: Date.now(),
});

// 获取消息
const messages = manager.getMessages("test:session-1");

// 检查上下文状态
const status = manager.getContextStatus("test:session-1");
console.log(status);
// { totalTokens: 150, limit: 131072, usagePercent: 0.11, isOverflow: false, warning: false }
```

### 消息类型

```typescript
// 用户消息
{ role: "user", content: "..." }

// 助手消息
{ role: "assistant", content: "..." }

// 系统消息
{ role: "system", content: "..." }

// 工具结果
{
  role: "tool",
  content: "{\"name\": \"hr_get_employee\", \"output\": {...}}",
  toolResults: [...]
}
```

---

## 工具系统

### 工具分类

```
┌─────────────────────────────────────────────────────────────┐
│                      工具分类                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 基础工具    │  │ 系统工具    │  │ 服务工具    │        │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤        │
│  │ read        │  │ exec        │  │ hr_*        │        │
│  │ write       │  │             │  │ oa_*        │        │
│  │ edit        │  │             │  │ file_*      │        │
│  │ list_dir    │  │             │  │ mail_*      │        │
│  │             │  │             │  │ pm_*        │        │
│  │             │  │             │  │ kb_*        │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 工具定义

每个工具都是一个包含以下属性的对象：

```typescript
interface Tool {
  name: string;                    // 工具名称
  description: string;             // 工具描述
  inputSchema: {                   // 输入 Schema
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (                       // 执行函数
    params: Record<string, unknown>,
    context: ToolContext
  ) => Promise<ToolResult>;
}
```

### 开发新工具

#### 1. 创建工具文件

```typescript
// src/tools/services/custom.ts
import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

export function createCustomTool(config: Config["services"]["custom"]): Tool {
  // 检查是否启用
  if (!config?.enabled) return null;

  const tool: Tool = {
    name: "custom_api_call",
    description: "调用自定义 API",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: { type: "string", description: "API 端点" },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "DELETE"],
          description: "HTTP 方法"
        },
        body: { type: "object", description: "请求体" },
      },
      required: ["endpoint"],
    },
    async execute(params, context) {
      try {
        // 实现工具逻辑
        const response = await fetch(params.endpoint as string, {
          method: params.method as string || "GET",
          body: params.body ? JSON.stringify(params.body) : undefined,
          headers: {
            "Content-Type": "application/json",
            ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
          },
        });

        const data = await response.json();

        return {
          success: true,
          output: data,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `API 调用失败: ${error}`,
        };
      }
    },
  };

  return tool;
}
```

#### 2. 注册工具

```typescript
// src/tools/exec.ts

export function createAllTools(config: Config, workspaceDir: string): Tool[] {
  const tools: Tool[] = [];

  // 现有工具
  tools.push(...createBaseTools({ workspaceDir, config }));
  tools.push(createExecTool(config));

  // 新工具
  if (config.services.custom) {
    const customTool = createCustomTool(config.services.custom);
    if (customTool) {
      tools.push(customTool);
    }
  }

  return tools;
}
```

### 工具调用格式

Agent 通过以下格式调用工具：

```xml
<tool_calls>
[{"name": "工具名", "arguments": {"参数": "值"}}]
</tool_calls>
```

示例：
```xml
<tool_calls>
[{"name": "hr_get_employee", "arguments": {"employeeId": "E001"}}]
</tool_calls>
```

---

## 服务集成

### 支持的服务

| 服务 | 工具前缀 | 功能 |
|------|---------|------|
| HR 系统 | `hr_*` | 员工查询、部门、请假、考勤 |
| OA 系统 | `oa_*` | 审批、公告 |
| 文件服务器 | `file_*` | 上传、下载、列表 |
| 邮件服务 | `mail_*` | 发送邮件 |
| 项目管理 | `pm_*` | 项目、任务、工时 |
| 知识库 | `kb_*` | 搜索、文档、分类 |

### 集成新服务

#### 1. 定义服务配置

```typescript
// src/config/index.ts

export const ConfigSchema = z.object({
  services: z.object({
    myservice: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
      timeout: z.number().default(30000),
    }).optional(),
  }),
});
```

#### 2. 实现服务工具

```typescript
// src/tools/services/myservice.ts

export function createMyServiceTools(config: Config["services"]["myservice"]): Tool[] {
  if (!config?.enabled) return [];

  return [
    {
      name: "myservice_action",
      description: "自定义服务操作",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", description: "操作类型" },
          data: { type: "object", description: "请求数据" },
        },
        required: ["action"],
      },
      async execute(params, context) {
        // 实现逻辑
        return { success: true, output: {} };
      },
    },
  ];
}
```

#### 3. 配置示例

```yaml
# localclaw.yaml

services:
  myservice:
    enabled: true
    baseUrl: http://myservice.internal.company.com:8080/api
    apiKey: your-api-key
    timeout: 30000
```

---

## CLI 设计

### 命令结构

```
localclaw [全局选项] <命令> [参数] [选项]
```

### 可用命令

#### 交互模式

```bash
# 启动交互式对话
localclaw interactive
localclaw i

# 示例
$ localclaw i
🤖 你: 帮我写一个 Python 函数
Agent: 我来帮您编写...
```

#### 运行任务

```bash
# 执行单次任务
localclaw run "提示词" [选项]

# 选项
--session, -s    会话 ID
--timeout, -t    超时时间（毫秒）
--think          开启思考模式

# 示例
localclaw run "帮我查询今天的待审批" --session sess-1
localclaw run "分析代码性能问题" --think
```

#### Gateway 服务

```bash
# 启动 Gateway
localclaw gateway [选项]

# 选项
--port, -p   端口号 (默认: 3000)
--host, -h  主机地址 (默认: localhost)

# 示例
localclaw gateway --port 8080 --host 0.0.0.0
```

#### 会话管理

```bash
# 列出所有会话
localclaw session list

# 查看会话历史
localclaw session history <sessionKey>

# 清空会话
localclaw session clear [sessionKey]

# 查看会话状态
localclaw session status <sessionKey>
```

#### 工具管理

```bash
# 列出所有工具
localclaw tool list

# 查看工具详情
localclaw tool info <toolName>
```

#### 配置管理

```bash
# 显示当前配置
localclaw config show

# 编辑配置
localclaw config edit

# 重置配置
localclaw config reset

# 验证配置
localclaw config validate
```

### 开发新命令

```typescript
// src/cli/newcommand.ts
import { Command } from "commander";

export const newCommand = new Command("newcommand")
  .description("新命令描述")
  .argument("<arg>", "必需参数")
  .option("-o, --option <value>", "选项")
  .action((arg, options) => {
    // 实现逻辑
    console.log("执行命令:", arg, options);
  });

// 在主入口注册
program.addCommand(newCommand);
```

---

## Gateway 开发

### 启动 Gateway

```bash
# 基础启动
npm run gateway

# 指定端口
npm run gateway -- --port 8080

# 指定主机
npm run gateway -- --host 0.0.0.0
```

### HTTP API

#### 执行 Agent

```http
POST /api/v1/run
Content-Type: application/json

{
  "prompt": "帮我查询员工信息",
  "sessionId": "session-1",
  "sessionKey": "api:session-1",
  "thinkLevel": "off"
}
```

**响应：**
```json
{
  "success": true,
  "content": "员工信息查询结果...",
  "sessionId": "session-1",
  "sessionKey": "api:session-1",
  "metadata": {
    "tokensUsed": 1500,
    "duration": 5000
  }
}
```

#### 获取会话历史

```http
GET /api/v1/session?key=<sessionKey>
```

**响应：**
```json
{
  "sessionKey": "session-1",
  "messages": [...]
}
```

#### 获取工具列表

```http
GET /api/v1/tools
```

**响应：**
```json
{
  "tools": [
    {
      "name": "read",
      "description": "读取文件内容",
      "inputSchema": {...}
    }
  ]
}
```

### 健康检查

```http
GET /health
```

**响应：**
```json
{
  "status": "ok",
  "timestamp": 1704067200000
}
```

### WebSocket API (待实现)

```javascript
const ws = new WebSocket("ws://localhost:3000/ws");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};

// 发送消息
ws.send(JSON.stringify({
  type: "prompt",
  prompt: "帮我查询"
}));
```

---

## 扩展开发

### 扩展点

LocalClaw 提供以下扩展点：

| 扩展点 | 描述 | 位置 |
|--------|------|------|
| 工具 | 添加新工具 | `src/tools/services/` |
| Provider | 添加新模型 | `src/agent/providers/` |
| CLI 命令 | 添加新命令 | `src/cli/` |
| Gateway 端点 | 添加 API | `src/gateway/` |
| Hooks | 生命周期钩子 | (待实现) |

### 最佳实践

```
┌─────────────────────────────────────────────────────────────┐
│                     扩展开发规范                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 遵循项目结构                                             │
│     - 工具放在 src/tools/services/                           │
│     - 命令放在 src/cli/                                      │
│                                                             │
│  2. 类型安全                                                 │
│     - 使用 TypeScript                                        │
│     - 定义完整类型                                           │
│                                                             │
│  3. 错误处理                                                 │
│     - 返回标准错误格式                                       │
│     - 不抛出未捕获异常                                       │
│                                                             │
│  4. 配置化                                                   │
│     - 支持配置文件控制                                       │
│     - 提供合理默认值                                         │
│                                                             │
│  5. 文档                                                     │
│     - 添加 JSDoc 注释                                        │
│     - 更新 README 和文档                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 示例：完整扩展

```typescript
// 1. 定义类型
interface MyExtensionConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
}

// 2. 实现工具
export function createMyExtensionTool(config: MyExtensionConfig): Tool {
  return {
    name: "my_extension_action",
    description: "我的扩展功能",
    inputSchema: {
      type: "object",
      properties: {
        param1: { type: "string", description: "参数1" },
        param2: { type: "number", description: "参数2" },
      },
      required: ["param1"],
    },
    async execute(params, context) {
      // 实现逻辑
      return { success: true, output: { result: "success" } };
    },
  };
}

// 3. 注册到 Agent
function registerExtension(agent: LocalAgent, config: MyExtensionConfig) {
  if (config.enabled) {
    const tool = createMyExtensionTool(config);
    agent.registerTool(tool);
  }
}

// 4. 在 CLI 中使用
export const myExtensionCommand = new Command("myext")
  .description("我的扩展命令")
  .action(async () => {
    const config = loadMyExtensionConfig();
    const agent = createAgent(config);
    registerExtension(agent, config);
    // 执行逻辑
  });
```

---

## 配置参考

### 完整配置

```yaml
# localclaw.yaml

# Ollama 配置
ollama:
  host: http://localhost:11434         # Ollama 服务地址
  model: qwen2.5:7b-instruct          # 模型名称
  contextWindow: 131072               # 上下文窗口
  timeout: 120000                     # 请求超时

# 服务配置
services:
  hr:
    enabled: false
    baseUrl: http://hr.internal.com:8080/api
    apiKey: your-api-key

  oa:
    enabled: false
    baseUrl: http://oa.internal.com:3000/api
    apiKey: your-api-key

  fileServer:
    enabled: false
    baseUrl: http://files.internal.com:9000
    token: your-token

  mail:
    enabled: false
    smtpHost: mail.internal.com
    smtpPort: 587
    user: agent@company.com
    password: your-password

  projectManagement:
    enabled: false
    baseUrl: http://pm.internal.com:8088/api
    apiKey: your-api-key

  knowledgeBase:
    enabled: false
    baseUrl: http://kb.internal.com:5000/api
    apiKey: your-api-key

# Agent 配置
agent:
  defaultTimeout: 600000              # 默认超时 (10分钟)
  maxHistoryTurns: 50                 # 最大对话轮次
  enableSandbox: false                # 启用沙箱
  sandboxMemory: 512M                 # 沙箱内存限制
  sandboxCpu: 1.0                     # CPU 限制

# 安全配置
security:
  allowedDomains:                     # 允许的域名
    - "*.internal.company.com"
  allowedIps:                         # 允许的 IP 段
    - "10.0.0.0/8"
    - "172.16.0.0/12"
    - "192.168.0.0/16"
  deniedPatterns:                     # 禁止的命令
    - "rm -rf /"
    - "rm -rf /*"
    - "chmod 777"
    - "mkfs"

# 日志配置
logging:
  level: info                         # 日志级别
  format: text                        # 格式
  file: ./logs/localclaw.log          # 日志文件
```

### 环境变量

| 环境变量 | 说明 | 默认值 |
|---------|------|-------|
| `OLLAMA_HOST` | Ollama 地址 | http://localhost:11434 |
| `OLLAMA_MODEL` | 模型名称 | qwen2.5:7b-instruct |
| `HR_API_BASE` | HR 系统地址 | - |
| `HR_API_KEY` | HR API 密钥 | - |
| `OA_API_BASE` | OA 系统地址 | - |
| `OA_API_KEY` | OA API 密钥 | - |

---

## 常见问题

### 如何调试？

```bash
# 启用详细日志
DEBUG=localclaw:* npm run dev

# 使用交互模式逐步调试
npm run dev -- i
```

### 如何添加日志？

```typescript
import { log } from "./logger.js";

log.debug("调试信息");
log.info("普通信息");
log.warn("警告");
log.error("错误");
```

### 如何测试？

```bash
# 运行测试
npm test

# 运行特定测试
npm test -- test-name

# 生成覆盖率
npm run test:coverage
```

---

## 相关资源

- 📖 [快速上手](/quickstart) - 5 分钟入门
- 🔧 [API 参考](/api) - 完整 API 文档
- 💬 [社区支持](https://github.com/your-org/localclaw/discussions)
- 🐛 [报告问题](https://github.com/your-org/localclaw/issues)

---

> LocalClaw 让企业内网 Agent 开发变得简单！
