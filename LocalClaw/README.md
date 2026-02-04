# LocalClaw

> 企业内网离线 Agent 框架 - 基于 OpenClaw 设计思想

## 简介

LocalClaw 是一个专为企业内网环境设计的离线 Agent 框架。它借鉴了 OpenClaw 的优秀设计，简化了架构，专为内网环境优化。

## 核心特性

- 🔒 **离线运行** - 基于本地 Ollama，无需外网
- 🏢 **企业集成** - 支持 HR、OA、文件服务器等企业服务
- 🔧 **工具丰富** - 开箱即用的企业工具集
- 📡 **Gateway API** - HTTP/WebSocket API 支持二次开发
- 🛡️ **安全可控** - 完整的权限控制和沙箱机制

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Ollama

```bash
# 安装 Ollama
curl -fsSL https://ollama.ai/install.sh | sh
ollama serve
ollama pull qwen2.5:7b-instruct
```

### 3. 初始化配置

```bash
npm run dev -- init
npm run dev -- config edit
```

### 4. 运行

```bash
# 交互模式
npm run dev -- i

# 单次执行
npm run dev -- run "帮我写一个 Python 函数"

# Gateway API
npm run gateway -- --port 3000
```

## 文档

- [快速上手](/docs/quickstart.md) - 5 分钟入门
- [开发指南](/docs/development.md) - 完整开发文档

## 项目结构

```
localclaw/
├── src/
│   ├── agent/          # Agent 核心
│   ├── tools/          # 工具系统
│   ├── context/        # 上下文管理
│   ├── cli/            # CLI
│   ├── gateway/        # Gateway 服务
│   └── config/         # 配置
├── docs/               # 文档
└── package.json
```

## 可用工具

| 类别 | 工具 | 描述 |
|------|------|------|
| 文件 | read/write/edit | 文件操作 |
| 系统 | exec | 执行命令 |
| HR | hr_get_employee | 员工查询 |
| OA | oa_approval_list | 审批列表 |
| 文件 | file_upload | 上传文件 |
| 邮件 | mail_send | 发送邮件 |
| 项目 | pm_tasks | 任务管理 |
| 知识 | kb_search | 搜索文档 |

## License

MIT
