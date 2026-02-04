---
title: 快速上手
description: LocalClaw 企业内网离线 Agent 框架快速上手指南
icon: 🚀
---

# LocalClaw 快速上手指南

> 5 分钟开始使用 LocalClaw

## 前置要求

| 依赖 | 要求 | 说明 |
|------|------|------|
| Node.js | >= 18 | 推荐 Node.js 20+ |
| Ollama | >= 0.1 | 本地大模型服务 |
| 内存 | >= 8GB | 根据模型大小调整 |

## 安装步骤

### 1. 安装依赖

```bash
# 克隆项目
git clone https://github.com/your-org/localclaw.git
cd localclaw

# 安装 Node.js 依赖
npm install
```

### 2. 安装并启动 Ollama

```bash
# 安装 Ollama (macOS/Linux)
curl -fsSL https://ollama.ai/install.sh | sh

# 启动 Ollama
ollama serve

# 下载模型 (选择其一)
ollama pull qwen2.5:7b-instruct    # 推荐：7B 参数
ollama pull llama3.2:3b-instruct  # 3B 参数（资源要求低）
ollama pull deepseek-r1:7b        # 推理能力强
```

### 3. 初始化配置

```bash
# 生成配置文件
npm run dev -- init

# 编辑配置
npm run dev -- config edit
```

### 4. 编辑配置文件

创建 `localclaw.yaml`：

```yaml
ollama:
  host: http://localhost:11434
  model: qwen2.5:7b-instruct
  contextWindow: 131072

services:
  hr:
    enabled: false
    baseUrl: http://hr.internal.company.com:8080/api
  oa:
    enabled: false
    baseUrl: http://oa.internal.company.com:3000/api

agent:
  defaultTimeout: 600000
  maxHistoryTurns: 50
```

## 快速开始

### 方式一：交互模式

```bash
# 启动交互式对话
npm run dev -- interactive

# 或使用简称
npm run dev -- i
```

交互示例：
```
🤖 你: 帮我查询一下今天有哪些待审批的流程
🤖 Agent: 我来帮您查询...

🤖 你: 帮我把代码提交到 git
🤖 Agent: 执行 git commit 命令...
```

### 方式二：单次执行

```bash
# 执行单次任务
npm run dev -- run "帮我写一个 Python 函数"

# 带思考模式
npm run dev -- run "分析这段代码的性能问题" --think
```

### 方式三：Gateway API

```bash
# 启动 Gateway 服务
npm run gateway -- --port 3000 --host localhost

# 调用 API
curl -X POST http://localhost:3000/api/v1/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "帮我查询员工张三的信息",
    "sessionKey": "test-session-1"
  }'
```

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `npm run dev -- i` | 启动交互模式 |
| `npm run dev -- r "提示词"` | 执行单次任务 |
| `npm run gateway` | 启动 Gateway API |
| `npm run dev -- session list` | 查看会话列表 |
| `npm run dev -- session history <key>` | 查看会话历史 |
| `npm run dev -- tool list` | 列出可用工具 |
| `npm run dev -- config show` | 显示当前配置 |
| `npm run dev -- health` | 检查服务状态 |

## 验证安装

```bash
# 检查 Ollama 连接
npm run dev -- health

# 应该看到：
# ✅ Ollama 连接正常
# ✅ HR 服务异常（如果未配置）
```

## 第一个示例

```bash
# 1. 启动交互模式
npm run dev -- i

# 2. 输入提示词
🤖 你: 用 Python 写一个快速排序算法

# 3. Agent 会生成代码并保存到文件
```

## 下一步

- 📖 [完整文档](/development) - 详细开发指南
- 🔧 [工具开发](/tools) - 开发自定义工具
- 🔌 [服务集成](/services) - 集成企业服务
- ⚙️ [配置参考](/configuration) - 完整配置说明

## 常见问题

### Q: 连接 Ollama 失败？

```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 如果 Ollama 未运行
ollama serve
```

### Q: 内存不足？

- 使用更小的模型：`ollama pull llama3.2:3b-instruct`
- 减小上下文窗口：`contextWindow: 65536`

### Q: 工具调用失败？

- 检查配置文件中的服务地址是否正确
- 确认内网服务是否可达

---

**有问题？** 查看 [完整文档](/development) 或提交 [Issue](https://github.com/your-org/localclaw/issues)
