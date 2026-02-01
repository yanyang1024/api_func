# 企业内网Agent - 开发指南

本文档旨在帮助开发者深入理解项目架构，掌握核心设计理念，并能够顺利进行二次开发和功能扩展。

## 一、项目概述

### 1.1 项目定位

企业内网Agent是一个完全离线部署的AI助手系统，基于本地Ollama大模型和私有服务构建。它继承了OpenClaw项目的核心设计思想，但进行了大幅简化，专注于企业内网场景的典型需求。

### 1.2 核心特性

| 特性 | 说明 |
|------|------|
| **完全离线** | 不依赖任何外部云服务，所有组件均可内网部署 |
| **本地LLM** | 基于Ollama，支持多种开源模型，无需API密钥 |
| **服务集成** | 内置数据库、搜索、任务管理等企业常用服务 |
| **工具扩展** | 插件式工具系统，易于扩展新功能 |
| **多渠道支持** | 支持CLI、Webhook等多种交互方式 |
| **会话管理** | 完整的多会话支持，包括历史记录和上下文压缩 |

### 1.3 技术栈

- **运行时**: Node.js 20+ (ES Modules)
- **语言**: TypeScript 5.6
- **LLM框架**: Ollama (本地部署)
- **配置**: YAML + 环境变量
- **测试**: Vitest
- **包管理**: pnpm

## 二、系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Enterprise Agent                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   CLI入口     │    │  Webhook入口  │    │  其他渠道    │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                           │                                   │
│                    ┌──────▼───────┐                           │
│                    │  Agent核心    │                           │
│                    │  (agent.ts)   │                           │
│                    └──────┬───────┘                           │
│                           │                                   │
│         ┌─────────────────┼─────────────────┐                 │
│         │                 │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │   工具管理器  │  │ 会话管理器   │  │ 上下文管理器 │          │
│  │ tool-manager│  │session-manag│  │context-manag│          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                   │
│         └────────────────┼────────────────┘                   │
│                          │                                    │
│  ┌──────────────────────▼──────────────────────┐             │
│  │              服务注册表 (ServiceRegistry)      │             │
│  └─────────────────────────────────────────────┘             │
│         │                 │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │  数据库服务   │  │  搜索服务    │  │  任务服务   │          │
│  │ database.ts │  │ search.ts   │  │ task.ts    │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│         │                 │                 │                 │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │  通知服务    │  │  文件服务    │  │  ...更多   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                         数据层                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ SQLite   │  │ 本地文件  │  │ 会话JSON │  │ 索引文件  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                         模型层                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      Ollama                              │   │
│  │                    (本地大模型)                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块职责

```
src/
├── core/           # 核心组件，系统运行的基础
│   ├── types.ts        - 类型定义
│   ├── ollama-client.ts - 与LLM通信
│   ├── context-manager.ts - 消息历史管理
│   ├── session-manager.ts - 会话状态管理
│   └── embedding.ts     - 向量嵌入服务
│
├── services/       # 业务服务，提供具体功能
│   ├── database.ts    - 数据库操作
│   ├── search.ts      - 文档搜索
│   ├── task.ts        - 任务管理
│   ├── notification.ts - 通知发送
│   ├── file.ts        - 文件操作
│   └── registry.ts    - 服务注册中心
│
├── tools/          # 工具系统，Agent的能力边界
│   └── tool-manager.ts - 工具注册与执行
│
├── agents/         # Agent实现
│   └── agent.ts      - Agent核心逻辑
│
├── channels/       # 渠道适配器
│   └── webhook.ts    - Webhook接收
│
├── config/         # 配置管理
│   ├── schemas.ts    - 配置Schema
│   └── loader.ts     - 配置加载
│
└── cli/            # 命令行入口
    ├── main.ts       - 入口文件
    └── commands.ts   - 命令定义
```

## 三、核心组件详解

### 3.1 Ollama客户端 (ollama-client.ts)

Ollama客户端是Agent与本地大模型通信的桥梁。

#### 核心功能

```typescript
// src/core/ollama-client.ts

export interface OllamaClientConfig {
  host: string;           // Ollama服务地址
  model: string;          // 主模型名称
  embedModel: string;     // 嵌入模型名称
  timeout: number;        // 超时时间(ms)
}

export class OllamaClient {
  // 1. 检查服务可用性
  async isAvailable(): boolean {
    const response = await fetch(`${host}/api/tags`);
    return response.ok;
  }

  // 2. 发送对话请求
  async chat(messages: Message[], options: ChatOptions): Promise<AgentResult> {
    const response = await ollama.chat({
      model: this.config.model,
      messages: this.convertMessages(messages),
      options: {
        temperature: options.temperature,
        num_predict: options.maxTokens,
      },
      stream: false,
    });
    return this.parseResponse(response);
  }

  // 3. 流式对话
  async chatStream(
    messages: Message[],
    options: ChatOptions,
    onChunk: (chunk: string) => void
  ): Promise<AgentResult>

  // 4. 生成向量嵌入
  async getEmbedding(text: string): Promise<number[]> {
    const response = await ollama.embed({
      model: this.config.embedModel,
      input: text,
    });
    return response.embeddings[0];
  }
}
```

#### 使用示例

```typescript
import { createOllamaClient } from "./core/ollama-client.js";

const ollama = createOllamaClient({
  host: "http://localhost:11434",
  model: "qwen2.5:7b",
  embedModel: "nomic-embed-text:latest",
  timeout: 120000,
});

// 检查服务状态
const isReady = await ollama.isAvailable();
if (!isReady) {
  throw new Error("Ollama服务不可用");
}

// 发送对话
const result = await ollama.chat([
  { role: "user", content: "你好", timestamp: Date.now() }
], {
  temperature: 0.7,
  maxTokens: 4096,
});

console.log(result.content);
```

### 3.2 上下文管理器 (context-manager.ts)

上下文管理器负责管理对话历史，实现智能的上下文压缩。

#### 核心机制

```typescript
// src/core/context-manager.ts

export interface ContextConfig {
  maxTokens: number;           // 最大Token数
  maxHistory: number;          // 最大历史轮数
  compressionThreshold: number; // 触发压缩的阈值
  reserveTokens: number;       // 保留Token数
}

export class ContextManager {
  constructor(private config: ContextConfig, private sessionDir: string) {}

  // 1. 初始化会话
  async initializeSession(sessionId: string, systemPrompt: string): Promise<Message[]> {
    return [
      { role: "system", content: systemPrompt, timestamp: Date.now() }
    ];
  }

  // 2. 添加消息并检查是否需要压缩
  async addMessage(sessionId: string, message: Message, messages: Message[]): Promise<Message[]> {
    const updatedMessages = [...messages, message];
    const tokenCount = this.estimateTokenCount(updatedMessages);

    // 超过阈值时触发压缩
    if (tokenCount > this.config.maxTokens - this.config.reserveTokens) {
      const compressedMessages = await this.compressContext(updatedMessages);
      await this.saveContext(sessionId, compressedMessages);
      return compressedMessages;
    }

    // 限制历史消息数量
    return this.limitHistory(updatedMessages);
  }

  // 3. 压缩历史上下文
  private async compressContext(messages: Message[], maxTokens: number): Promise<Message[]> {
    // 保留系统提示
    const systemMessages = messages.filter(m => m.role === "system");
    const conversationMessages = messages.filter(m => m.role !== "system");

    // 从后向前保留最近的对话
    // 压缩早期的消息为摘要
    const summary = await this.generateSummary(conversationMessages.slice(0, -10));
    
    return [
      ...systemMessages,
      { role: "user", content: `[历史摘要] ${summary}`, timestamp: Date.now() },
      ...conversationMessages.slice(-10)
    ];
  }

  // 4. Token估算
  estimateTokenCount(messages: Message[]): number {
    // 中文约1字符/token，英文约4字符/token
    let total = 0;
    for (const msg of messages) {
      const chinese = (msg.content.match(/[\u4e00-\u9fa5]/g) || []).length;
      const other = msg.content.length - chinese;
      total += Math.ceil(chinese + other / 4);
    }
    return total;
  }
}
```

#### 压缩策略

| 场景 | 策略 |
|------|------|
| 消息数 < maxHistory | 直接保留 |
| 消息数 >= maxHistory | 从后向前保留最近N轮 |
| Token超限 | 压缩早期消息为摘要 |

### 3.3 会话管理器 (session-manager.ts)

会话管理器负责会话的创建、存储、查询和生命周期管理。

#### 核心数据结构

```typescript
// src/core/session-manager.ts

export interface SessionData {
  id: string;              // 会话ID
  agentId: string;         // Agent ID
  workspaceDir: string;    // 工作目录
  messages: Message[];     // 消息历史
  createdAt: number;       // 创建时间
  lastActiveAt: number;    // 最后活跃时间
}

export interface SessionMetadata {
  id: string;
  title?: string;          // 会话标题
  tags?: string[];         // 标签
  summary?: string;        // 摘要
  pinned?: boolean;        // 是否置顶
}

export class SessionManager {
  private storage: {
    sessions: Map<string, SessionData>;
    metadata: Map<string, SessionMetadata>;
  };

  // 1. 创建会话
  async createSession(agentId: string, workspaceDir: string): Promise<SessionData> {
    const session: SessionData = {
      id: uuidv4(),
      agentId,
      workspaceDir,
      messages: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.storage.sessions.set(session.id, session);
    await this.saveSession(session);

    return session;
  }

  // 2. 添加消息
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) throw new Error(`会话不存在: ${sessionId}`);

    session.messages.push(message);
    session.lastActiveAt = Date.now();
    await this.saveSession(session);
  }

  // 3. 获取消息历史
  async getMessages(sessionId: string): Promise<Message[]> {
    const session = this.storage.sessions.get(sessionId);
    return session?.messages || [];
  }

  // 4. 列出会话
  async listSessions(agentId?: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    for (const session of this.storage.sessions.values()) {
      if (!agentId || session.agentId === agentId) {
        sessions.push({
          id: session.id,
          agentId: session.agentId,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          messageCount: session.messages.length,
          workspaceDir: session.workspaceDir,
        });
      }
    }
    return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }
}
```

### 3.4 工具管理器 (tool-manager.ts)

工具管理器是Agent能力的核心扩展机制。

#### 工具定义

```typescript
// src/tools/tool-manager.ts

export interface ToolDefinition {
  name: string;                    // 工具名称
  description: string;             // 工具描述
  category: ToolCategory;          // 工具分类
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;               // 参数类型
      description: string;        // 参数描述
      required?: boolean;         // 是否必填
      enum?: string[];           // 可选值
    }>;
    required?: string[];          // 必填参数列表
  };
  handler: ToolHandler;            // 处理器
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: AgentContext
) => Promise<{ content: string }>;
```

#### 注册工具

```typescript
// 在ToolManager构造函数中注册内置工具
private registerBuiltInTools(): void {
  // 文件读取工具
  this.register({
    name: "file_read",
    description: "读取文件内容",
    category: "file",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径",
          required: true,
        },
        encoding: {
          type: "string",
          description: "文件编码",
        },
      },
      required: ["path"],
    },
    handler: this.createFileReadHandler(),
  });

  // 数据库查询工具
  this.register({
    name: "db_query",
    description: "执行SQL查询",
    category: "database",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SQL查询语句",
          required: true,
        },
      },
      required: ["sql"],
    },
    handler: this.createDbQueryHandler(),
  });
}
```

#### 工具处理器示例

```typescript
private createFileReadHandler(): ToolHandler {
  return async (args, context) => {
    const fileService = this.config.serviceRegistry.getFile();
    if (!fileService) {
      throw new Error("文件服务不可用");
    }

    const result = await fileService.read(args.path as string, {
      encoding: args.encoding as string,
    });

    if (!result.success) {
      throw new Error(result.error || "读取文件失败");
    }

    return { content: result.data || "" };
  };
}
```

### 3.5 服务注册表 (registry.ts)

服务注册表是所有业务服务的统一管理入口。

```typescript
// src/services/registry.ts

export class ServiceRegistry {
  private services: Map<string, any> = new Map();

  // 注册服务
  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  // 获取服务
  get<T = any>(name: string): T | null {
    return this.services.get(name) || null;
  }

  // 获取所有服务状态
  async getServiceStats(): Promise<Record<string, { initialized: boolean; type: string }>> {
    const stats: Record<string, { initialized: boolean; type: string }> = {};
    for (const [name, service] of this.services) {
      stats[name] = {
        initialized: true,
        type: service.constructor?.name || "unknown",
      };
    }
    return stats;
  }
}
```

## 四、二次开发指南

### 4.1 添加自定义工具

步骤一：创建工具处理器

```typescript
// src/tools/custom-tools.ts

import { ToolHandler, AgentContext } from "../core/types.js";

export function createMyCustomToolHandler(serviceRegistry: any): ToolHandler {
  return async (args, context: AgentContext) => {
    // 1. 从参数中获取数据
    const param1 = args.param1 as string;
    const param2 = args.param2 as number;

    // 2. 获取所需服务
    const myService = serviceRegistry.getMyService();
    if (!myService) {
      throw new Error("自定义服务不可用");
    }

    // 3. 执行业务逻辑
    const result = await myService.doSomething(param1, param2);

    // 4. 返回结果
    return {
      content: `操作结果: ${JSON.stringify(result)}`
    };
  };
}
```

步骤二：在ToolManager中注册

```typescript
// src/tools/tool-manager.ts

import { createMyCustomToolHandler } from "./custom-tools.js";

export class ToolManager {
  private registerBuiltInTools(): void {
    // 注册自定义工具
    this.register({
      name: "my_custom_tool",
      description: "我的自定义工具，用于...",
      category: "custom",  // 或 "file", "database"等
      parameters: {
        type: "object",
        properties: {
          param1: {
            type: "string",
            description: "参数1说明",
            required: true,
          },
          param2: {
            type: "number",
            description: "参数2说明",
          },
        },
        required: ["param1"],
      },
      handler: createMyCustomToolHandler(this.config.serviceRegistry),
    });
  }
}
```

### 4.2 集成新服务

步骤一：创建服务类

```typescript
// src/services/my-service.ts

import { ApiResponse } from "../core/types.js";

export interface MyServiceConfig {
  host: string;
  port: number;
  apiKey?: string;
}

export class MyService {
  private config: MyServiceConfig;
  private client: any;

  constructor(config: MyServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // 初始化连接
    this.client = await this.createClient();
  }

  // 定义服务方法
  async doSomething(input: string): Promise<ApiResponse<any>> {
    try {
      const result = await this.client.request(input);
      return {
        success: true,
        data: result,
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

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }
}

export const createMyService = (config: MyServiceConfig): MyService => {
  return new MyService(config);
};
```

步骤二：在注册表中注册服务

```typescript
// src/services/registry.ts

import { createMyService } from "./my-service.js";

export class ServiceRegistry {
  async initializeAll(): Promise<void> {
    // 初始化自定义服务
    const myService = createMyService({
      host: "localhost",
      port: 8080,
    });
    await myService.initialize();
    this.services.set("myService", myService);
  }
}
```

### 4.3 添加新渠道

步骤一：创建渠道适配器

```typescript
// src/channels/my-channel.ts

import { IncomingMessage, ServerResponse } from "node:http";
import { Message } from "../core/types.js";

export interface MyChannelConfig {
  path: string;
  port: number;
}

export interface MyChannelHandler {
  onMessage: (message: Message) => Promise<void>;
}

export class MyChannel {
  private config: MyChannelConfig;
  private handler: MyChannelHandler | null = null;
  private server: any;

  constructor(config: MyChannelConfig) {
    this.config = config;
  }

  setHandler(handler: MyChannelHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const http = await import("node:http");
    
    this.server = http.createServer(async (req, IncomingMessage, res: ServerResponse) => {
      await this.handleRequest(req, res);
    });

    this.server.listen(this.config.port, () => {
      console.log(`MyChannel已启动，监听端口: ${this.config.port}`);
    });
  }

  async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 实现请求处理逻辑
    if (this.handler) {
      const message = await this.parseRequest(req);
      await this.handler.onMessage(message);
    }
    res.writeHead(200);
    res.end("OK");
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }
}

export const createMyChannel = (config: Partial<MyChannelConfig> = {}): MyChannel => {
  return new MyChannel({
    path: config.path || "/my-channel",
    port: config.port || 3000,
  });
};
```

步骤二：在Agent中使用渠道

```typescript
// src/agents/agent.ts

import { createMyChannel } from "../channels/my-channel.js";

export class Agent {
  async initializeChannel(): Promise<void> {
    const channel = createMyChannel({ port: 3001 });
    
    channel.setHandler({
      onMessage: async (message) => {
        const result = await this.run(message.content);
        await channel.sendResponse(result.content);
      },
    });

    await channel.start();
  }
}
```

### 4.4 修改系统提示

```typescript
// 自定义系统提示
const agent = factory.createAgent({
  id: "special-agent",
  name: "专业助手",
  systemPrompt: `你是一个专业的技术顾问，擅长解答技术问题。

你的工作流程：
1. 理解用户问题的核心需求
2. 提供清晰、准确的技术解答
3. 在必要时提供代码示例
4. 引用相关的最佳实践

请始终保持专业、耐心、友好的态度。`,
  model: "qwen2.5:7b",
  temperature: 0.5,  // 更稳定的输出
  maxTokens: 4096,
});
```

### 4.5 配置自定义Agent

在 `config.yaml` 中配置：

```yaml
agents:
  default:
    name: 默认助手
    systemPrompt: 你是一个乐于助人的助手
    model: qwen2.5:7b
    temperature: 0.7

  developer:
    name: 开发助手
    systemPrompt: 你是一个资深开发者，擅长代码和架构
    model: llama3.2
    temperature: 0.3

  analyst:
    name: 数据分析师
    systemPrompt: 你是一个数据分析师，擅长数据处理和可视化
    model: qwen2.5:7b
    temperature: 0.5
    tools:
      - db_query
      - search
```

## 五、配置详解

### 5.1 完整配置示例

```yaml
# Agent配置
agent:
  id: default
  name: 企业智能助手
  description: 企业内网AI助手

# Ollama配置
ollama:
  host: http://localhost:11434
  model: qwen2.5:7b
  embedModel: nomic-embed-text:latest
  timeout: 120000

# 存储配置
storage:
  dataDir: ./data
  sessionDir: ./data/sessions
  pluginDir: ./plugins
  skillDir: ./skills

# 安全配置
security:
  safeBins:
    - /usr/bin
    - /bin
  execTimeout: 30000
  allowDownload: false
  maxFileSize: 10485760

# 工具配置
tools:
  defaultProfile: full
  profiles:
    coding:
      allow:
        - file_*
        - db_*
        - exec
    minimal:
      allow:
        - file_read
        - search

# 服务配置
services:
  database:
    type: sqlite
    database: ./data/enterprise.db
  
  search:
    type: local
    index: documents
  
  task:
    storagePath: ./data/tasks
  
  notification:
    type: log
    smtp:
      host: smtp.company.com
      port: 587
      user: notify@company.com
      from: notify@company.com
  
  file:
    baseDir: ./data/files
    maxFileSize: 10485760
    allowedExtensions:
      - .txt
      - .md
      - .json
      - .py

# 渠道配置
channels:
  cli:
    enabled: true
  webhook:
    enabled: true
    config:
      path: /webhook
      method: POST
```

### 5.2 配置Schema

配置使用Zod进行类型验证：

```typescript
// src/config/schemas.ts

export const BaseConfigSchema = z.object({
  agent: z.object({
    id: z.string().default("default"),
    name: z.string().default("Enterprise Assistant"),
  }).default({}),
  
  ollama: z.object({
    host: z.string().url().default("http://localhost:11434"),
    model: z.string().default("qwen2.5:7b"),
    embedModel: z.string().default("nomic-embed-text:latest"),
    timeout: z.number().positive().default(120000),
  }).default({}),
  
  storage: z.object({
    dataDir: z.string().default("./data"),
    sessionDir: z.string().default("./data/sessions"),
  }).default({}),
  
  security: z.object({
    safeBins: z.array(z.string()).default(["/usr/bin", "/bin"]),
    execTimeout: z.number().positive().default(30000),
  }).default({}),
}).default({});
```

## 六、最佳实践

### 6.1 工具开发最佳实践

```typescript
// 1. 明确的错误处理
export function createMyToolHandler(): ToolHandler {
  return async (args, context) => {
    try {
      // 验证参数
      if (!args.requiredParam) {
        throw new Error("缺少必要参数: requiredParam");
      }

      // 获取服务
      const service = context.serviceRegistry.getMyService();
      if (!service) {
        throw new Error("服务不可用");
      }

      // 执行操作
      const result = await service.doSomething(args.requiredParam);

      // 返回格式化的结果
      return {
        content: formatResult(result),
      };
    } catch (error) {
      return {
        content: "",
        is_error: true,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  };
}

// 2. 结果格式化
function formatResult(data: any): string {
  return JSON.stringify(data, null, 2);
}
```

### 6.2 服务开发最佳实践

```typescript
export class MyService {
  private connection: any;
  private isConnected: boolean = false;

  async initialize(): Promise<void> {
    try {
      this.connection = await this.createConnection();
      this.isConnected = true;
      console.log("服务初始化成功");
    } catch (error) {
      this.isConnected = false;
      throw new Error(`服务初始化失败: ${error}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.isConnected = false;
    }
  }
}
```

### 6.3 性能优化

```typescript
// 1. 连接池
class DatabaseService {
  private pool: Map<string, any> = new Map();

  async getConnection(key: string): Promise<any> {
    let conn = this.pool.get(key);
    if (!conn || !this.isHealthy(conn)) {
      conn = await this.createConnection();
      this.pool.set(key, conn);
    }
    return conn;
  }

  // 2. 缓存
  private cache: Map<string, { data: any; expires: number }> = new Map();

  async getCached(key: string, ttl: number = 60000): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    return null;
  }
}
```

## 七、调试技巧

### 7.1 启用调试日志

```bash
# 使用NODE_DEBUG
DEBUG=enterprise-agent:* npm run dev

# 或设置环境变量
export LOG_LEVEL=debug
```

### 7.2 测试单个组件

```typescript
// tests/my-service.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { MyService } from "../src/services/my-service.js";

describe("MyService", () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService({ /* config */ });
  });

  it("should initialize", async () => {
    await service.initialize();
    expect(service.healthCheck()).toBe(true);
  });
});
```

### 7.3 检查状态

```typescript
// 在代码中添加健康检查端点
import express from "express";
const app = express();

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    services: serviceRegistry.getServiceStats(),
  });
});

app.listen(3000);
```

## 八、常见问题

### Q1: 如何添加新的数据库支持？

参考现有的 `DatabaseService` 实现，添加对应的数据库驱动和连接逻辑。

### Q2: 工具调用失败怎么办？

1. 检查服务是否初始化
2. 验证参数格式
3. 查看错误日志

### Q3: 如何自定义Agent行为？

修改系统提示词或创建新的Agent配置。

### Q4: 会话数据存储在哪里？

默认存储在 `data/sessions` 目录下的JSON文件中。

## 九、扩展阅读

- [Ollama文档](https://ollama.ai/docs)
- [TypeScript手册](https://www.typescriptlang.org/docs/)
- [Node.js文档](https://nodejs.org/docs/)

如需更多帮助，请提交Issue或查看源码注释。
