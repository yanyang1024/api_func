# Local Agent - 使用文档

> 📖 这份文档教你如何安装、配置和使用 Local Agent

---

## 目录

1. [快速开始](#1-快速开始)
2. [安装指南](#2-安装指南)
3. [配置说明](#3-配置说明)
4. [命令参考](#4-命令参考)
5. [使用示例](#5-使用示例)
6. [故障排除](#6-故障排除)
7. [FAQ](#7-faq)

---

## 1. 快速开始

### 1.1 前置要求

- **Node.js**: 18.0.0 或更高版本
- **Ollama**: 已安装并运行
- **操作系统**: Linux, macOS, 或 Windows (WSL)

### 1.2 5 分钟快速体验

```bash
# 1. 克隆或下载项目
cd /path/to/local-agent

# 2. 安装依赖
npm install

# 3. 确保 Ollama 正在运行
ollama serve

# 4. 运行基础测试
node examples/basic-test.js

# 5. 启动交互式 CLI
node cli.js
```

---

## 2. 安装指南

### 2.1 安装 Node.js

#### Linux (Ubuntu/Debian)

```bash
# 使用 NodeSource 仓库
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应该显示 v20.x.x
npm --version
```

#### macOS

```bash
# 使用 Homebrew
brew install node

# 验证安装
node --version
npm --version
```

#### Windows

下载并安装：https://nodejs.org/

### 2.2 安装 Ollama

#### Linux

```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

#### macOS

下载并安装：https://ollama.ai/download

#### Windows

下载并安装：https://ollama.ai/download/windows

### 2.3 安装项目依赖

```bash
cd /path/to/local-agent
npm install
```

依赖说明：

| 依赖 | 用途 |
|------|------|
| `js-yaml` | 解析 YAML 配置文件 |
| `express` | HTTP 服务器（本地服务） |
| `cors` | 跨域支持 |
| `chalk` | 终端彩色输出 |
| `ora` | 加载动画 |
| `inquirer` | 交互式命令行 |

---

## 3. 配置说明

### 3.1 配置文件位置

主配置文件：`config/agent.yaml`

### 3.2 核心配置项

#### 模型配置

```yaml
agent:
  model:
    provider: "ollama"
    name: "llama3.1:8b"        # 模型名称
    baseUrl: "http://localhost:11434"
    contextWindow: 128000      # 上下文窗口大小
    temperature: 0.7           # 生成温度 (0-2)
```

**常用模型推荐**：

| 模型 | 参数量 | 特点 | 适用场景 |
|------|--------|------|---------|
| `llama3.1:8b` | 8B | 平衡性能和质量 | 通用 |
| `llama3.1:70b` | 70B | 高质量 | 复杂任务 |
| `qwen2.5:7b` | 7B | 中文支持好 | 中文任务 |
| `mistral:7b` | 7B | 轻量高效 | 资源受限 |

#### 工具策略

```yaml
agent:
  tools:
    allow:                      # 允许的工具列表
      - read
      - write
      - edit
      - exec
      - local_service
    security: "allowlist"       # 安全级别
    ask: "on-miss"              # 询问模式
```

**安全级别说明**：

- `deny`: 拒绝所有工具
- `allowlist`: 仅允许列表中的工具（推荐）
- `full`: 允许所有工具（谨慎使用）

**询问模式说明**：

- `off`: 不询问，直接执行
- `on-miss`: 仅当工具不在允许列表时询问
- `always`: 每次都询问用户

#### 本地服务配置

```yaml
agent:
  localServices:
    - name: "file_system"
      endpoint: "http://localhost:3001/api"
      description: "File system operations"
```

#### 记忆配置

```yaml
agent:
  memory:
    enabled: true
    storePath: "./workspace/memory"
    vectorDbPath: "./memory/vectors.db"
    chunkSize: 1000
    overlap: 200
```

### 3.3 创建自定义配置

你可以创建多个配置文件：

```bash
config/
├── agent.yaml           # 默认配置
├── agent-dev.yaml       # 开发环境配置
└── agent-prod.yaml      # 生产环境配置
```

使用时指定配置：

```javascript
const agent = new LocalAgent();
await agent.initialize({
  configPath: './config/agent-dev.yaml'
});
```

---

## 4. 命令参考

### 4.1 CLI 命令

#### 启动 CLI

```bash
node cli.js
```

#### 交互模式

```bash
# 进入交互式聊天
node cli.js
> chat

# 单次提问
node cli.js ask "帮我写一个 Python 函数"

# 查看会话
node cli.js sessions

# 查看状态
node cli.js status

# 清空会话
node cli.js clear cli-chat-session
```

#### 启动本地服务

```bash
node cli.js services
```

这将启动：
- 文件系统服务 (http://localhost:3001)
- 笔记服务 (http://localhost:3004)

### 4.2 交互式命令

在 CLI 中，你可以使用以下命令：

| 命令 | 说明 | 示例 |
|------|------|------|
| `chat` | 进入交互式聊天模式 | `chat` |
| `ask <msg>` | 单次提问 | `ask 什么是 AI？` |
| `services` | 启动本地服务 | `services` |
| `sessions` | 列出所有会话 | `sessions` |
| `clear <id>` | 清空指定会话 | `clear cli-chat-session` |
| `status` | 显示 Agent 状态 | `status` |
| `help` | 显示帮助信息 | `help` |
| `exit` | 退出程序 | `exit` |

---

## 5. 使用示例

### 5.1 基础对话

```bash
$ node cli.js
╔══════════════════════════════════════════╗
║  Local Agent - AI Assistant CLI          ║
║  Powered by Ollama (Open Source)         ║
╚══════════════════════════════════════════╝

agent> chat

💬 Chat Mode
Type "exit" to return to main menu

You> 你好，请介绍一下自己
Agent> 你好！我是一个运行在 Ollama 上的本地 AI 助手...

You> 帮我创建一个 TODO 列表
Agent> 好的，我来帮你创建一个 TODO 列表...
```

### 5.2 文件操作

```bash
You> 创建一个名为 project-plan.md 的文件，包含项目计划
Agent> 我来帮你创建项目计划文件...

[调用工具 write]
文件已创建：project-plan.md
```

### 5.3 执行命令

```bash
You> 列出当前目录的文件
Agent> 我来执行 ls 命令...

[调用工具 exec]
当前目录包含：
- config/
- src/
- workspace/
...
```

### 5.4 使用本地服务

首先启动服务：

```bash
# 终端 1
node cli.js services
```

然后在另一个终端：

```bash
# 终端 2
node cli.js

agent> chat
You> 使用文件系统服务列出 workspace/files 目录
Agent> 我来调用文件系统服务...

[调用工具 local_file_system]
action: list
params: { dir: '.' }

返回结果：
- file1.txt
- file2.md
- subdir/
```

### 5.5 编程任务

```bash
You> 帮我写一个 Python 函数，计算斐波那契数列
Agent> 我来帮你写一个斐波那契函数...

[创建文件 fibonacci.py]
```python
def fibonacci(n):
    """
    计算斐波那契数列的第 n 项

    Args:
        n: 要计算的项数

    Returns:
        第 n 项的值
    """
    if n <= 0:
        return 0
    elif n == 1:
        return 1
    else:
        return fibonacci(n-1) + fibonacci(n-2)

# 优化版本（使用动态规划）
def fibonacci_optimized(n):
    if n <= 0:
        return 0
    elif n == 1:
        return 1

    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b

    return b
```

文件已创建：fibonacci.py

You> 测试这个函数
Agent> 我来运行测试...

[调用工具 exec]
运行：python3 -c "print(fibonacci(10))"
输出：55
```

### 5.6 代码审查

```bash
You> 审查 src/core/agent.js 文件
Agent> 我来读取并审查这个文件...

[调用工具 read]
[分析代码...]

代码审查结果：

**优点**：
1. 结构清晰，模块化设计
2. 错误处理完善
3. 注释详细

**改进建议**：
1. runInferenceLoop 可以添加最大执行时间限制
2. 可以增加更详细的日志
3. 考虑添加性能监控
```

---

## 6. 故障排除

### 6.1 常见问题

#### 问题 1: 无法连接到 Ollama

**错误信息**：
```
❌ Initialization failed: Cannot connect to Ollama at http://localhost:11434
```

**解决方案**：

```bash
# 1. 检查 Ollama 是否运行
ps aux | grep ollama

# 2. 启动 Ollama
ollama serve

# 3. 验证连接
curl http://localhost:11434/api/tags

# 4. 检查端口是否被占用
lsof -i :11434  # Linux/macOS
netstat -ano | findstr :11434  # Windows
```

#### 问题 2: 模型未安装

**错误信息**：
```
Error: model 'llama3.1:8b' not found
```

**解决方案**：

```bash
# 1. 列出已安装的模型
ollama list

# 2. 安装模型
ollama pull llama3.1:8b

# 3. 验证模型
ollama run llama3.1:8b "Hello"
```

#### 问题 3: 端口冲突

**错误信息**：
```
Port 3001 is already in use
```

**解决方案**：

```bash
# 1. 查找占用端口的进程
lsof -i :3001  # Linux/macOS
netstat -ano | findstr :3001  # Windows

# 2. 终止进程或更改端口
# 编辑配置文件，修改端口：
# agent:
#   localServices:
#     - endpoint: "http://localhost:3002/api"
```

#### 问题 4: Token 超限

**错误信息**：
```
Context window exceeded: 150000 / 128000
```

**解决方案**：

```bash
# 1. 清空当前会话
agent> clear my-session

# 2. 使用更大的上下文窗口模型
# 修改配置：
# agent:
#   model:
#     name: "llama3.1:70b"  # 70B 模型支持更大上下文
#     contextWindow: 128000

# 3. 手动压缩会话
#（Agent 会自动压缩，但你可以清空会话重新开始）
```

#### 问题 5: 权限错误

**错误信息**：
```
EACCES: permission denied, mkdir './workspace'
```

**解决方案**：

```bash
# 1. 检查目录权限
ls -la workspace/

# 2. 修改权限
chmod 755 workspace/

# 3. 如果是 npm 安装问题
sudo npm install  # 不推荐，最好修复权限问题
```

### 6.2 日志调试

#### 启用详细日志

```javascript
// 修改配置文件
logging:
  level: "debug"    # debug, info, warn, error
  console: true
  file: "./logs/agent.log"
```

#### 查看日志

```bash
# 实时查看日志
tail -f logs/agent.log

# 查看最近 100 行
tail -n 100 logs/agent.log

# 搜索错误
grep "ERROR" logs/agent.log
```

---

## 7. FAQ

### Q1: Local Agent 和 ChatGPT 有什么区别？

**A**:
- **隐私**: Local Agent 完全本地运行，数据不离开你的机器
- **成本**: Local Agent 免费（无 API 调用成本）
- **性能**: 取决于你的硬件和选择的模型
- **功能**: Local Agent 可以调用本地工具和服务

### Q2: 需要什么样的硬件配置？

**A**:
- **最低配置**:
  - CPU: 4 核
  - RAM: 8GB
  - 存储: 20GB
  - 模型: llama3.1:8b, qwen2.5:7b

- **推荐配置**:
  - CPU: 8 核
  - RAM: 16GB+
  - 存储: 50GB+
  - GPU: NVIDIA (可选，加速推理)
  - 模型: llama3.1:70b

### Q3: 如何选择合适的模型？

**A**:
- **资源受限**: mistral:7b, qwen2.5:3b
- **通用用途**: llama3.1:8b
- **高质量输出**: llama3.1:70b
- **中文任务**: qwen2.5:7b, qwen2.5:14b

### Q4: 可以同时运行多个 Agent 吗？

**A**: 可以！每个 Agent 实例是独立的：

```javascript
const agent1 = new LocalAgent();
const agent2 = new LocalAgent();

await Promise.all([
  agent1.initialize(),
  agent2.initialize(),
]);

// 并发运行
const [result1, result2] = await Promise.all([
  agent1.run({ sessionId: 'agent-1', message: 'Task 1' }),
  agent2.run({ sessionId: 'agent-2', message: 'Task 2' }),
]);
```

### Q5: 如何集成到现有项目？

**A**: 有三种方式：

1. **作为 CLI 工具**：
   ```bash
   node cli.js ask "your question"
   ```

2. **作为 Node.js 模块**：
   ```javascript
   import { LocalAgent } from './src/core/agent.js';
   const agent = new LocalAgent();
   await agent.initialize();
   const response = await agent.run({...});
   ```

3. **作为本地服务**：
   创建 HTTP API 包装 Agent，通过 REST 调用使用

### Q6: 支持哪些类型的工具？

**A**: 任何可以通过 JavaScript 实现的功能：
- 文件操作
- Shell 命令
- HTTP 请求
- 数据库查询
- 自定义逻辑
- ...

### Q7: 如何自定义系统提示词？

**A**: 三种方式：

1. **修改代码** (`src/prompts/context.js`)
2. **使用引导文件** (`workspace/CLAUDE.md`)
3. **运行时注入** (`agent.run({ extraSystemPrompt: '...' })`)

### Q8: 可以用于生产环境吗？

**A**: 当前版本是教学性质的，不建议直接用于生产。如需生产使用，建议：
- 添加完整的错误处理
- 实现认证和授权
- 添加监控和日志
- 进行安全审计
- 性能优化

---

## 8. 进阶使用

### 8.1 创建自定义技能

```
workspace/skills/
└── code-review/
    └── SKILL.md
```

```markdown
# Skill: 代码审查

## 何时使用
当用户请求审查代码、优化代码或检查代码质量时。

## 如何使用
1. 使用 read 工具读取代码文件
2. 分析代码的：
   - 结构和可读性
   - 性能问题
   - 安全隐患
   - 最佳实践
3. 提供具体的改进建议

## 示例
用户: "审查 src/core/agent.js"
1. 读取文件
2. 分析代码
3. 输出审查报告
```

### 8.2 集成外部 API

```javascript
// src/tools/weather-tool.js
export class WeatherTool extends Tool {
  name = 'weather';
  description = 'Get weather information for a location';

  getSchema() {
    return {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'City name or coordinates',
        },
      },
      required: ['location'],
    };
  }

  async execute(args) {
    const { location } = args;
    const response = await fetch(
      `https://api.weather.com/current?location=${location}`
    );
    const data = await response.json();
    return JSON.stringify(data);
  }
}
```

### 8.3 批量处理

```javascript
// 批量处理多个任务
const tasks = [
  '创建文件 A',
  '创建文件 B',
  '创建文件 C',
];

for (const task of tasks) {
  await agent.run({
    sessionId: 'batch-session',
    message: task,
  });
}
```

---

## 9. 资源链接

- **项目文档**: [LEARNING.md](./LEARNING.md)
- **Ollama 官网**: https://ollama.ai
- **Ollama 模型库**: https://ollama.ai/library
- **Node.js 文档**: https://nodejs.org/docs
- **Express 文档**: https://expressjs.com/

---

## 结语

希望这份使用文档能帮助你快速上手 Local Agent！

如果你遇到问题或有建议，欢迎反馈。

🎉 享受你的本地 AI 之旅！
