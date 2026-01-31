# Local Agent

> 🤖 一个简化的本地 AI Agent 框架，使用 Ollama 运行开源大模型

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

---

## ✨ 特性

- ✅ **完全本地运行** - 所有数据都在本地，无需联网
- ✅ **开源模型** - 使用 Ollama 运行 Llama、Qwen、Mistral 等开源模型
- ✅ **工具系统** - Agent 可以调用工具执行实际任务
- ✅ **会话管理** - 自动管理对话历史和上下文
- ✅ **本地服务** - 通过 HTTP API 集成自定义服务
- ✅ **教学导向** - 详细的注释和文档，易于学习

---

## 🚀 快速开始

### 1. 前置要求

- Node.js 18+
- Ollama (已安装并运行)

### 2. 安装

```bash
# 克隆项目
cd local-agent

# 安装依赖
npm install
```

### 3. 启动 Ollama

```bash
ollama serve

# 安装模型（如果还没有）
ollama pull llama3.1:8b
```

### 4. 运行

```bash
# 交互式模式
node cli.js

# 或运行测试
node examples/basic-test.js
```

---

## 📖 文档

- **[学习文档](docs/LEARNING.md)** - 深入了解架构和设计思想
- **[使用文档](docs/USAGE.md)** - 安装、配置和使用指南

---

## 💡 使用示例

### 基础对话

```bash
$ node cli.js
agent> chat
You> 你好，请介绍一下自己
Agent> 你好！我是一个运行在 Ollama 上的本地 AI 助手...
```

### 文件操作

```bash
You> 创建一个名为 hello.txt 的文件，内容是 "Hello World"
Agent> 我来帮你创建文件...
✓ 文件已创建：hello.txt
```

### 编程任务

```bash
You> 写一个 Python 函数计算斐波那契数列
Agent> 我来帮你写一个斐波那契函数...
[创建文件 fibonacci.py]
✓ 文件已创建
```

---

## 🏗️ 项目结构

```
local-agent/
├── cli.js                 # CLI 入口
├── package.json
├── config/
│   └── agent.yaml         # 配置文件
├── src/
│   ├── core/              # 核心模块
│   │   ├── agent.js       # Agent 主运行器
│   │   ├── session.js     # 会话管理
│   │   └── queue.js       # 命令队列
│   ├── providers/
│   │   └── ollama.js      # Ollama 适配器
│   ├── tools/
│   │   └── registry.js    # 工具注册表
│   ├── prompts/
│   │   └── context.js     # 上下文构建
│   └── services/          # 示例本地服务
│       ├── file-system.js
│       └── notes.js
├── workspace/             # 工作区
├── sessions/              # 会话存储
├── docs/                  # 文档
└── examples/              # 示例代码
```

---

## 🎯 核心概念

### Agent vs 传统聊天机器人

| 特性 | 传统聊天机器人 | AI Agent |
|------|--------------|----------|
| 能力 | 只能生成文本 | 可以执行动作 |
| 交互 | 单轮对话 | 多轮 + 工具调用 |
| 记忆 | 无上下文 | 完整会话历史 |
| 目标 | 回答问题 | 完成任务 |

### 工作流程

```
用户消息
  ↓
Agent 分析 → 决定调用工具
  ↓
执行工具 → read/write/exec/...
  ↓
获取结果 → 返回给 Agent
  ↓
生成最终回复 → 返回给用户
```

---

## 🔧 配置

主配置文件：`config/agent.yaml`

```yaml
agent:
  model:
    name: "llama3.1:8b"
    baseUrl: "http://localhost:11434"
    contextWindow: 128000
    temperature: 0.7

  tools:
    allow:
      - read
      - write
      - edit
      - exec
    security: "allowlist"

  localServices:
    - name: "file_system"
      endpoint: "http://localhost:3001/api"
```

详见：[配置说明](docs/USAGE.md#3-配置说明)

---

## 🛠️ 扩展

### 添加新工具

```javascript
import { Tool } from './tools/registry.js';

class MyTool extends Tool {
  name = 'my_tool';
  description = 'Does something';

  getSchema() {
    return {
      type: 'object',
      properties: {
        input: { type: 'string' }
      }
    };
  }

  async execute(args) {
    return `Result: ${args.input}`;
  }
}
```

### 添加本地服务

```javascript
// src/services/my-service.js
import express from 'express';

export async function startMyService() {
  const app = express();
  app.post('/api/action', (req, res) => {
    res.json({ success: true });
  });
  app.listen(3005);
}
```

详见：[扩展指南](docs/LEARNING.md#6-扩展指南)

---

## 📚 CLI 命令

| 命令 | 说明 |
|------|------|
| `chat` | 交互式聊天 |
| `ask <msg>` | 单次提问 |
| `services` | 启动本地服务 |
| `sessions` | 列出所有会话 |
| `status` | 显示 Agent 状态 |
| `help` | 显示帮助 |
| `exit` | 退出 |

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 🙏 致谢

本项目灵感来源于 [OpenClaw](https://github.com/openclaw/openclaw) 项目。

---

## 📞 支持

- 📖 [学习文档](docs/LEARNING.md)
- 📖 [使用文档](docs/USAGE.md)
- 🐛 [问题反馈](https://github.com/your-repo/issues)

---

Made with ❤️ by open source community
