# 企业内网离线Agent系统

基于本地Ollama部署的私有大模型和私有服务构建的企业级AI助手系统。

## 核心特性

- **离线部署**: 完全运行在内网环境，不依赖外部云服务
- **本地LLM**: 基于Ollama，支持多种开源模型
- **私有服务集成**: 内置数据库、搜索、任务管理、通知等服务接口
- **工具系统**: 丰富的工具集，支持文件操作、数据库查询、任务管理等
- **会话管理**: 支持多会话、历史记录、上下文压缩
- **插件扩展**: 支持通过插件扩展功能

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 安装Ollama

```bash
# Linux/Mac
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# 下载安装包: https://ollama.ai/download
```

### 3. 拉取模型

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text:latest
```

### 4. 配置系统

复制配置模板并修改:

```bash
cp config.example.yaml config.yaml
# 编辑config.yaml
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 使用方法

### 交互式对话

```bash
# 启动对话
ent-agent chat

# 指定会话
ent-agent chat session_id

# 指定模型
ent-agent chat --model llama3.2
```

### 单次请求

```bash
ent-agent ask "你好，请帮我查询今天的数据"
```

### 会话管理

```bash
# 查看会话列表
ent-agent sessions

# 查看会话详情
ent-agent session <id>

# 清除会话
ent-agent clear <id>
ent-agent clear  # 清除所有会话
```

## 工具列表

### 文件操作

| 工具 | 描述 | 示例 |
|------|------|------|
| `file_read` | 读取文件 | `{"path": "README.md"}` |
| `file_write` | 写入文件 | `{"path": "note.txt", "content": "内容"}` |
| `file_list` | 列出目录 | `{"path": "/docs", "recursive": true}` |
| `file_search` | 搜索文件 | `{"query": "*.ts"}` |

### 数据库

| 工具 | 描述 | 示例 |
|------|------|------|
| `db_query` | 执行SQL查询 | `{"sql": "SELECT * FROM users"}` |

### 搜索

| 工具 | 描述 | 示例 |
|------|------|------|
| `search` | 搜索文档 | `{"query": "项目文档", "limit": 10}` |
| `search_index` | 索引文档 | `{"id": "doc1", "title": "标题", "content": "内容"}` |

### 任务管理

| 工具 | 描述 | 示例 |
|------|------|------|
| `task_create` | 创建任务 | `{"title": "完成任务", "description": "描述"}` |
| `task_list` | 列出任务 | `{"status": "pending"}` |
| `task_complete` | 完成任务 | `{"taskId": "xxx"}` |

### 通知

| 工具 | 描述 | 示例 |
|------|------|------|
| `notify` | 发送通知 | `{"type": "log", "recipients": [], "subject": "主题", "content": "内容"}` |

### 系统

| 工具 | 描述 | 示例 |
|------|------|------|
| `exec` | 执行命令 | `{"command": "ls -la"}` |

## 系统架构

```
enterprise-agent/
├── src/
│   ├── core/           # 核心组件
│   │   ├── types.ts    # 类型定义
│   │   ├── ollama-client.ts    # Ollama客户端
│   │   ├── context-manager.ts  # 上下文管理
│   │   ├── session-manager.ts  # 会话管理
│   │   └── embedding.ts        # 向量嵌入
│   │
│   ├── services/       # 服务接口
│   │   ├── database.ts     # 数据库服务
│   │   ├── search.ts       # 搜索服务
│   │   ├── task.ts         # 任务服务
│   │   ├── notification.ts # 通知服务
│   │   ├── file.ts         # 文件服务
│   │   └── registry.ts     # 服务注册表
│   │
│   ├── tools/          # 工具系统
│   │   └── tool-manager.ts # 工具管理器
│   │
│   ├── agents/         # Agent实现
│   │   └── agent.ts     # Agent核心
│   │
│   ├── channels/       # 渠道适配器
│   ├── plugins/        # 插件系统
│   ├── config/         # 配置管理
│   └── cli/            # CLI命令
│
├── skills/             # 技能包
├── plugins/            # 插件目录
├── tests/              # 测试文件
├── docs/               # 文档
└── config.yaml         # 配置文件
```

## 配置说明

### Ollama配置

```yaml
ollama:
  host: http://localhost:11434  # Ollama服务地址
  model: qwen2.5:7b             # 主模型
  embedModel: nomic-embed-text:latest  # 嵌入模型
  timeout: 120000               # 超时时间(毫秒)
```

### 数据库配置

```yaml
services:
  database:
    type: sqlite  # sqlite | mysql | postgresql
    database: ./data/enterprise.db
    # MySQL/PostgreSQL额外配置:
    # host: localhost
    # port: 3306
    # username: user
    # password: pass
```

### 安全配置

```yaml
security:
  safeBins:              # 允许执行的命令目录
    - /usr/bin
    - /bin
  execTimeout: 30000     # 命令执行超时
  allowDownload: false   # 是否允许下载
  maxFileSize: 10485760  # 最大文件大小(字节)
```

## 开发指南

### 添加新工具

1. 在 `src/tools/tool-manager.ts` 中注册工具处理器
2. 定义工具的参数Schema
3. 实现工具逻辑

### 添加新服务

1. 在 `src/services/` 目录创建服务文件
2. 实现服务接口
3. 在 `src/services/registry.ts` 中注册服务

### 添加新渠道

1. 在 `src/channels/` 目录创建渠道适配器
2. 实现消息收发接口
3. 在配置文件中启用渠道

## 故障排除

### Ollama不可用

```bash
# 检查Ollama服务
curl http://localhost:11434/api/tags

# 重启Ollama
systemctl restart ollama
```

### 模型加载失败

```bash
# 检查模型是否存在
ollama list

# 重新拉取模型
ollama pull <model_name>
```

### 数据库连接失败

```bash
# 检查数据库文件
ls -la data/

# 初始化数据库
sqlite3 data/enterprise.db ".tables"
```

## 许可证

MIT
