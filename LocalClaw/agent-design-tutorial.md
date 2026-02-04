---
title: OpenClaw Agent 设计教程
description: 深入理解 OpenClaw Agent 系统的核心设计理念和实现细节
icon: Bot
---

# OpenClaw Agent 设计教程

> 本教程旨在帮助开发者深入理解 OpenClaw Agent 系统的核心设计理念和实现细节。通过阅读本教程，你将掌握上下文工程、信息流设计、工具系统和 Agent 循环机制的设计原理。

## 前言：什么是 OpenClaw Agent？

在深入技术细节之前，让我们用一个生活中的比喻来理解 OpenClaw 的核心概念。

想象你雇佣了一个**全能助理**。这个助理具备以下能力：

| 能力 | 生活比喻 | OpenClaw 对应 |
|------|----------|---------------|
| 记忆系统 | 记住之前的对话内容 | Context Engineering |
| 工具箱 | 电脑、打印机、电话等工具 | Tool System |
| 工作流程 | 按步骤完成任务的流程 | Information Flow |
| 决策机制 | 自主判断下一步该做什么 | Agent Loop |

OpenClaw 的设计就是围绕这四个核心概念展开的。接下来，我们将逐一深入探讨。

---

## 第一章：上下文工程设计

### 1.1 为什么需要上下文工程？

大语言模型（如 Claude、GPT）有**上下文窗口限制**——这是模型单次能处理的 Token 数量上限。

```
┌─────────────────────────────────────────────────────────────────┐
│                      常见模型的上下文窗口                        │
├─────────────────────────────────────────────────────────────────┤
│  Claude 3.5 (Sonnet)    │  200K Tokens                         │
│  Claude 3.7 (Sonnet)    │  200K Tokens                         │
│  GPT-4o                  │  128K Tokens                         │
│  Gemini 2.0 Flash        │  1M Tokens                           │
└─────────────────────────────────────────────────────────────────┘
```

**为什么会有这个限制？**
- 计算成本：注意力机制的复杂度是 O(n²)
- 内存限制：GPU 显存有限
- 延迟考虑：处理长上下文会增加响应时间

当对话变长、处理大文件或进行复杂推理时，就会遇到这个限制。OpenClaw 实现了智能的上下文管理系统来解决这个问题。

### 1.2 上下文窗口保护机制

OpenClaw 采用**多级回退策略**来管理上下文窗口。

#### 1.2.1 优先级机制

```typescript
// 优先级从高到低

// 1. 模型自身属性 (最高优先级)
const fromModel = model.contextWindow;

// 2. 配置文件 (models.json)
const fromModelsConfig = config.models.providers[provider].models[id].contextWindow;

// 3. Agent 配置
const fromAgentConfig = config.agents.defaults.contextTokens;

// 4. 默认值 (最低优先级)
const fromDefault = 128000;
```

**设计思想**：越具体的配置优先级越高，给予用户最大的灵活性。

#### 1.2.2 硬性保护

当上下文窗口不足时，OpenClaw 会阻止 Agent 运行：

```typescript
// 硬性最小值：16K Tokens
const CONTEXT_WINDOW_HARD_MIN_TOKENS = 16_000;

// 警告阈值：32K Tokens
const CONTEXT_WINDOW_WARN_BELOW_TOKENS = 32_000;

function evaluateContextWindowGuard(tokens, hardMin, warnBelow) {
  if (tokens < hardMin) {
    return { shouldBlock: true, reason: "below_hard_min" };
  }
  if (tokens < warnBelow) {
    return { shouldWarn: true, reason: "below_warn_threshold" };
  }
  return { shouldBlock: false, shouldWarn: false };
}
```

**教学要点**：
- **硬性最小值**：确保 Agent 有足够的空间处理输入和生成输出
- **警告阈值**：提前预警，让用户有机会优化输入

### 1.3 消息历史管理

OpenClaw 不是简单地截断对话，而是实现了**智能历史限制**。

#### 1.3.1 按对话轮次计算

```typescript
function limitHistoryTurns(messages, limit) {
  if (!limit || limit <= 0 || messages.length === 0) {
    return messages;
  }

  let userCount = 0;
  let lastUserIndex = messages.length;

  // 从后往前遍历，找到最早的超限位置
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount > limit) {
        // 保留最近的对话
        return messages.slice(lastUserIndex);
      }
      lastUserIndex = i;
    }
  }
  return messages;
}
```

**为什么要按轮次计算？**

```
用户: 问题1
助手: 回答1
用户: 问题2
助手: 回答2
用户: 问题3
助手: 回答3
```

如果按消息数限制（如 10 条），可能只保留一半的对话。但按轮次限制（如 3 轮），可以保留完整的对话上下文。

#### 1.3.2 渠道差异化配置

不同渠道需要不同的历史限制：

```typescript
// Telegram DM: 可以配置更长的历史（如 50 轮）
const dmConfig = {
  historyLimit: 50,
  provider: "telegram"
};

// Discord Group: 配置较短的历史（如 10 轮）
const groupConfig = {
  historyLimit: 10,
  provider: "discord"
};

// 快速查询（如 Slack）：配置极短的历史（如 3 轮）
const slackConfig = {
  historyLimit: 3,
  provider: "slack"
};
```

### 1.4 上下文压缩机制

当上下文即将溢出时，OpenClaw 会自动进行**摘要压缩**。

#### 1.4.1 压缩策略流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    摘要压缩决策流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  开始压缩                                                       │
│      │                                                         │
│      ▼                                                         │
│  消息量小？ ─── 是 ──▶ 直接摘要整段对话                          │
│      │                                                         │
│      否                                                        │
│      │                                                         │
│      ▼                                                         │
│  分阶段摘要                                                     │
│      │                                                         │
│      ├── 分成多个 chunk                                        │
│      ├── 分别摘要每个 chunk                                    │
│      └── 合并多个摘要                                          │
│      │                                                         │
│      ▼                                                         │
│  仍然失败？ ─── 是                                              │
│      │                                                         │
│      ├── 只摘要小消息                                          │
│      ├── 标记 oversized 消息                                    │
│      └── 返回统计摘要                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 1.4.2 分阶段摘要实现

```typescript
async function summarizeInStages(params) {
  const { messages, parts = 2 } = params;
  const totalTokens = estimateMessagesTokens(messages);

  // 如果消息量小，直接摘要
  if (parts <= 1 || totalTokens <= params.maxChunkTokens) {
    return summarizeWithFallback(params);
  }

  // 分阶段摘要
  const splits = splitMessagesByTokenShare(messages, parts);
  const partialSummaries = [];

  for (const chunk of splits) {
    partialSummaries.push(await summarizeWithFallback({
      ...params,
      messages: chunk
    }));
  }

  // 合并摘要
  return summarizeWithFallback({
    ...params,
    messages: partialSummaries.map(s => ({
      role: "user",
      content: s
    })),
    customInstructions: "Merge these partial summaries into a single cohesive summary."
  });
}
```

### 1.5 上下文压缩实战案例

让我们通过一个具体案例理解上下文压缩的工作原理。

#### 原始对话历史

```
[对话 1 - 10轮前]
用户：帮我写一个 Python 函数计算斐波那契数列
助手：[迭代版本代码]
用户：现在用递归方式重写
助手：[递归版本代码]

[对话 2 - 5轮前]
用户：可以添加缓存优化吗？
助手：[添加 LRU cache]

[对话 3 - 2轮前]
用户：测试一下性能
助手：[运行基准测试]

[对话 4 - 当前]
用户：总结一下我们做了什么
```

#### 压缩过程

**第一步：检测上下文接近上限**

```typescript
const currentTokens = 180000;
const maxTokens = 200000;
const safetyMargin = 0.9; // 90% 时触发压缩

if (currentTokens / maxTokens > safetyMargin) {
  triggerCompaction();
}
```

**第二步：选择压缩目标**

```typescript
// 早期对话（对话 1-2）已不太相关
const compressTarget = messages.slice(0, 20); // 前20轮

// 近期对话（对话 3-4）保留完整
const retainTarget = messages.slice(20);
```

**第三步：摘要早期对话**

```
原始内容（约 8000 tokens）：
- 迭代版斐波那契实现
- 递归版斐波那契实现
- LRU cache 优化
- 基准测试结果

摘要后（约 500 tokens）：
"讨论了斐波那契数列的三种实现方式：
1. 基础迭代法
2. 递归实现
3. 添加 LRU cache 的优化版本
基准测试显示优化版本性能提升 40%"
```

**第四步：合并结果**

```
最终上下文：
[摘要] 斐波那契数列实现讨论（优化版本性能提升 40%）
[完整] 测试结果：性能提升 40%
[完整] 用户：总结一下我们做了什么
```

### 1.6 本章小结

| 主题 | 核心概念 | 关键实现 |
|------|---------|----------|
| 窗口保护 | 多级回退策略 | 模型 → 配置 → Agent → 默认值 |
| 历史管理 | 按轮次计算 | limitHistoryTurns |
| 压缩机制 | 分阶段摘要 | summarizeInStages |
| 差异化配置 | 渠道相关 | DM vs Group vs Channel |

---

## 第二章：信息流设计方案

### 2.1 信息流概述

OpenClaw 的信息流设计就像一个**高效的物流系统**，确保：

- 消息从各个渠道正确路由
- 事件准确传递
- 流式响应实时输出

### 2.2 事件流架构

OpenClaw 定义了四种核心事件流：

```
┌─────────────────────────────────────────────────────────────────┐
│                      四种事件流类型                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  lifecycle ──▶ Agent 生命周期事件                               │
│              ├── agent:started                                  │
│              ├── agent:completed                                │
│              └── agent:error                                    │
│                                                                 │
│  tool ───────▶ 工具调用事件                                      │
│              ├── tool:started                                   │
│              ├── tool:completed                                 │
│              └── tool:error                                     │
│                                                                 │
│  assistant ──▶ 助手响应事件                                      │
│              ├── message:delta                                  │
│              ├── message:completed                              │
│              └── reasoning:chunk                               │
│                                                                 │
│  error ──────▶ 错误事件                                          │
│              ├── error:auth                                     │
│              ├── error:rate_limit                               │
│              └── error:context_overflow                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.2.1 事件系统核心实现

```typescript
const seqByRun = new Map<string, number>();
const listeners = new Set<(evt: AgentEventPayload) => void>();

function emitAgentEvent(event) {
  // 自动递增序列号
  const nextSeq = (seqByRun.get(event.runId) ?? 0) + 1;
  seqByRun.set(event.runId, nextSeq);

  // 丰富事件数据
  const enriched = {
    ...event,
    seq: nextSeq,
    ts: Date.now(),
  };

  // 广播给所有监听器
  for (const listener of listeners) {
    try {
      listener(enriched);
    } catch (error) {
      // 避免单个监听器错误影响其他监听器
      console.error('Event listener error:', error);
    }
  }
}
```

**设计要点**：
- **序列号**：确保事件按顺序处理
- **时间戳**：支持时间分析和调试
- **错误隔离**：单个监听器错误不影响整体

### 2.3 流式响应处理

OpenClaw 支持实时流式输出，并能智能处理特殊标签。

#### 2.3.1 特殊标签处理

```
┌─────────────────────────────────────────────────────────────────┐
│                    特殊标签处理流程                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  <thinking>    思考过程（内部处理，不显示给用户）                │
│       │                                                         │
│       ▼                                                         │
│  [内部缓冲区]                                                   │
│       │                                                         │
│       ▼                                                         │
│  用户可见内容 ──▶ 实时显示                                       │
│       │                                                         │
│       ▼                                                         │
│  <final>      最终响应内容（确定性的）                           │
│       │                                                         │
│       ▼                                                         │
│  返回结果 ──▶ 结构化输出                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3.2 流式处理实现

```typescript
function subscribeEmbeddedPiSession(params) {
  const state = {
    assistantTexts: [],
    toolMetas: [],
    reasoningMode: params.reasoningMode ?? "off",
    deltaBuffer: "",
    blockBuffer: "",
    blockState: {
      thinking: false,
      final: false
    },
  };

  const stripBlockTags = (text, state) => {
    let result = "";
    let inThinking = state.thinking;
    let inFinal = state.final;

    // 处理 <thinking> 标签
    for (const match of text.matchAll(THINKING_TAG_SCAN_RE)) {
      if (!inThinking) {
        result += text.slice(lastIndex, match.index);
      }
      inThinking = !match[1]; // match[1] 是 "/" 表示关闭标签
    }

    // 处理 <final> 标签
    for (const match of text.matchAll(FINAL_TAG_SCAN_RE)) {
      if (!inFinal && !match[1]) {
        inFinal = true;
        lastFinalIndex = match.index + match[0].length;
      } else if (inFinal && match[1]) {
        result += text.slice(lastFinalIndex, match.index);
        inFinal = false;
      }
    }

    state.thinking = inThinking;
    state.final = inFinal;

    return result;
  };

  return {
    assistantTexts,
    toolMetas,
    unsubscribe: () => subscription.unsubscribe(),
  };
}
```

### 2.4 Lane 机制：并发控制

OpenClaw 使用 **Lane 机制**来控制并发，防止竞态条件。

#### 2.4.1 为什么需要 Lane？

```
场景：用户在 Telegram 连续发送两条消息

没有 Lane 的情况：
  消息1: "帮我写代码" ───────────────▶ 执行中 [需要 30 秒]
  消息2: "测试一下"  ───────────────▶ 执行中 [同时开始]

  结果：两条消息同时执行，可能导致：
  - 文件状态不一致
  - 变量冲突
  - 输出混乱

有 Lane 的情况：
  消息1: "帮我写代码" ───────────────▶ 执行中 [30 秒]
  消息2: "测试一下"  ───────────────▶ 排队等待 [1 秒]
                                   ──▶ 执行中 [消息1完成后]

  结果：串行执行，状态一致
```

#### 2.4.2 Lane 实现

```typescript
function enqueueCommandInLane(lane, task, opts) {
  const queue = getOrCreateLaneQueue(lane);

  return new Promise((resolve, reject) => {
    queue.push({
      task,
      priority: opts?.priority ?? 0,
      resolve,
      reject,
      timeout: opts?.timeout,
    });

    processLaneQueue(lane);
  });
}

function resolveSessionLane(sessionKey) {
  // 从会话键解析 Lane
  // 例如：agent:telegram:dm:123 -> session:telegram-dm-123
  const parts = sessionKey.split(":").filter(Boolean);
  return `session:${parts[1]}-${parts[2]}-${parts[3]}`;
}
```

#### 2.4.3 Lane 优先级

```typescript
// Lane 优先级配置
const LANE_PRIORITIES = {
  "session:*": 0,        // 普通会话：默认优先级
  "session:urgent:*": 10, // 紧急会话：高优先级
  "global": -10,          // 全局操作：低优先级
};

// 优先级调度示例
async function processLaneQueue(lane) {
  const queue = getLaneQueue(lane);
  if (queue.length === 0) return;

  // 按优先级排序
  queue.sort((a, b) => b.priority - a.priority);

  // 执行最高优先级任务
  const task = queue.shift();
  await executeTask(task);
}
```

### 2.5 数据流管道完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 执行数据流管道                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  输入参数                                                       │
│      │                                                         │
│      ▼                                                         │
│  ┌─────────────────────┐                                        │
│  │ 1. Lane 解析        │ 解析会话 Lane + 全局 Lane              │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 2. 沙箱环境解析     │ 检查是否需要沙箱隔离                    │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 3. 技能加载         │ 加载工作区技能                         │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 4. 引导文件处理     │ 加载上下文引导                         │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 5. 工具创建         │ 按策略创建可用工具                     │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 6. 系统提示词构建    │ 构建 Agent 系统提示                   │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 7. 会话管理器初始化 │ 初始化 SessionManager                 │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 8. Agent 会话创建   │ 创建底层 Agent 会话                   │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 9. 主循环          │ while(true) 循环处理                    │
│  │    ├── 历史清理     │                                        │
│  │    ├── 消息验证     │                                        │
│  │    ├── 图像注入     │                                        │
│  │    ├── Prompt 发送  │                                        │
│  │    ├── 流式响应     │                                        │
│  │    └── 错误处理     │                                        │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 10. 会话清理        │ 资源释放和清理                         │
│  └──────────┬──────────┘                                        │
│             │                                                   │
│             ▼                                                   │
│  ┌─────────────────────┐                                        │
│  │ 输出结果            │ 返回 EmbeddedPiRunResult               │
│  └─────────────────────┘                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.6 本章小结

| 主题 | 核心概念 | 关键实现 |
|------|---------|----------|
| 事件流 | 四种事件类型 | lifecycle/tool/assistant/error |
| 流式处理 | 特殊标签解析 | stripBlockTags |
| 并发控制 | Lane 机制 | enqueueCommandInLane |
| 数据管道 | 阶段化处理 | 10 步执行流程 |

---

## 第三章：工具系统设计

### 3.1 工具系统概述

OpenClaw 的工具系统就像一个**工具箱**，Agent 根据需要选择合适的工具来完成任务。

### 3.2 工具分类

```
┌─────────────────────────────────────────────────────────────────┐
│                      工具分类全景图                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 文件操作    │   │ 命令执行    │   │ 网络请求    │            │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤            │
│  │ read        │   │ exec        │   │ web_search  │            │
│  │ write       │   │ bash        │   │ web_fetch   │            │
│  │ edit        │   │ process     │   │             │            │
│  │ apply_patch │   │             │   │             │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 会话管理    │   │ 消息发送    │   │ 内存管理    │            │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤            │
│  │ sessions_*  │   │ message     │   │ memory_*    │            │
│  │ session_*   │   │             │   │             │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │
│  │ 浏览器控制  │   │ 自动化      │   │ 节点管理    │            │
│  ├─────────────┤   ├─────────────┤   ├─────────────┤            │
│  │ browser     │   │ cron        │   │ nodes       │            │
│  │ canvas      │   │ gateway     │   │             │            │
│  └─────────────┘   └─────────────┘   └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 工具策略体系

OpenClaw 实现了**多层次的工具权限控制**，确保安全性和灵活性。

#### 3.3.1 工具分组

```typescript
const TOOL_GROUPS = {
  "group:memory": ["memory_search", "memory_get"],
  "group:web": ["web_search", "web_fetch"],
  "group:fs": ["read", "write", "edit", "apply_patch"],
  "group:runtime": ["exec", "process"],
  "group:sessions": [
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "sessions_spawn",
    "session_status"
  ],
  "group:ui": ["browser", "canvas"],
  "group:automation": ["cron", "gateway"],
  "group:messaging": ["message"],
  "group:nodes": ["nodes"],
};
```

#### 3.3.2 工具配置模板

```typescript
const TOOL_PROFILES = {
  // 最小权限：只允许查看状态
  minimal: {
    allow: ["session_status"]
  },

  // 编程权限：允许文件操作和执行
  coding: {
    allow: [
      "group:fs",       // 文件操作
      "group:runtime",  // 命令执行
      "group:sessions", // 会话管理
      "group:memory",   // 内存管理
      "image"           // 图片处理
    ]
  },

  // 消息权限：只允许发送消息
  messaging: {
    allow: [
      "group:messaging",
      "sessions_list",
      "sessions_history",
      "sessions_send"
    ]
  },

  // 完全开放：允许所有工具
  full: {}
};
```

#### 3.3.3 策略优先级

```typescript
// 优先级从低到高
const POLICY_SOURCES = [
  "default",           // 默认策略
  "global",             // 全局配置 (config.tools)
  "provider",           // Provider 配置
  "agent",              // Agent 配置
  "profile",            // Profile 策略
  "sandbox",            // 沙箱配置
  "subagent",           // 子 Agent 配置
];

function resolveEffectiveToolPolicy(params) {
  // 策略合并（高优先级覆盖低优先级）
  const merged = [
    params.defaultPolicy,
    params.globalPolicy,
    params.providerPolicy,
    params.agentPolicy,
    params.profilePolicy,
  ].reduce((acc, policy) => {
    if (!policy) return acc;
    return mergePolicies(acc, policy);
  }, {});

  return filterToolsByPolicy(allTools, merged);
}
```

### 3.4 核心工具详解

#### 3.4.1 文件操作工具

```typescript
function createOpenClawReadTool(tool) {
  return {
    name: "read",
    description: "Read the contents of a file",
    input: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The path to the file"
        },
        offset: {
          type: "number",
          description: "Line offset for pagination"
        },
        limit: {
          type: "number",
          description: "Maximum number of lines"
        },
      },
      required: ["path"],
    },
    async execute(params, context) {
      // 1. 安全检查：路径是否在允许范围内
      if (!isPathAllowed(params.path)) {
        return {
          success: false,
          error: "Path not allowed"
        };
      }

      // 2. 检查文件类型
      if (isBinaryFile(params.path)) {
        return {
          success: false,
          error: "Cannot read binary files"
        };
      }

      // 3. 执行读取
      const content = await readFile(params.path);

      // 4. 支持分块读取大文件
      if (params.offset || params.limit) {
        return chunkRead(content, params.offset, params.limit);
      }

      return {
        success: true,
        content
      };
    },
  };
}
```

#### 3.4.2 命令执行工具

```typescript
function createExecTool(options) {
  return {
    name: "exec",
    description: "Execute a shell command",
    input: {
      type: "object",
      properties: {
        cmd: {
          type: "string",
          description: "Command to execute"
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds"
        },
        workdir: {
          type: "string",
          description: "Working directory"
        },
        env: {
          type: "object",
          description: "Environment variables"
        },
      },
      required: ["cmd"],
    },
    async execute(params, context) {
      // 1. 安全检查：危险命令拦截
      if (isDangerousCommand(params.cmd)) {
        return {
          success: false,
          error: "Dangerous command blocked",
          blockedCommand: params.cmd
        };
      }

      // 2. 危险命令模式匹配
      const DANGEROUS_PATTERNS = [
        /rm\s+-rf\s+\//,           // 删除根目录
        /chmod\s+777\s+/,          // 危险权限
        /mkfs\s+/,                 // 格式化磁盘
        /dd\s+if\s*=/,             // 磁盘操作
      ];

      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(params.cmd)) {
          return {
            success: false,
            error: "Command matches dangerous pattern"
          };
        }
      }

      // 3. 执行命令（支持沙箱）
      if (options.sandbox) {
        return executeInSandbox(params, options.sandbox);
      }

      // 4. 正常执行
      const result = await executeCommand(params.cmd, {
        timeout: params.timeout,
        workdir: params.workdir,
        env: params.env,
      });

      return {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
  };
}
```

#### 3.4.3 Web 工具

```typescript
function createWebFetchTool() {
  return {
    name: "web_fetch",
    description: "Fetch content from a URL",
    input: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to fetch"
        },
        timeout: {
          type: "number",
          description: "Request timeout"
        },
      },
      required: ["url"],
    },
    async execute(params, context) {
      // 1. URL 验证
      const url = new URL(params.url);

      // 2. SSRF 防护：检查是否为私有 IP
      if (isPrivateIP(url.hostname)) {
        return {
          success: false,
          error: "Private IP addresses are not allowed"
        };
      }

      // 3. SSRF 防护：检查是否为内部域名
      if (isInternalDomain(url.hostname)) {
        return {
          success: false,
          error: "Internal domains are not allowed"
        };
      }

      // 4. 协议限制
      if (!["http:", "https:"].includes(url.protocol)) {
        return {
          success: false,
          error: "Only HTTP and HTTPS protocols are allowed"
        };
      }

      // 5. 发送请求
      const response = await fetch(params.url, {
        timeout: params.timeout,
        headers: {
          "User-Agent": "OpenClaw-Agent"
        },
      });

      // 6. 提取内容
      const content = await extractContent(response);

      return {
        success: true,
        content,
        metadata: {
          status: response.status,
          contentType: response.headers.get("content-type"),
          contentLength: response.headers.get("content-length"),
        },
      };
    },
  };
}
```

### 3.5 会话管理工具集

会话工具允许 Agent 创建和管理子会话：

```typescript
// 会话工具集
const sessionTools = {
  sessions_list: {
    description: "List all active sessions",
    execute: async (params) => {
      const sessions = await listSessions();
      return { sessions };
    }
  },

  sessions_history: {
    description: "Get session history",
    execute: async (params) => {
      const history = await getSessionHistory(params.sessionId);
      return { history };
    }
  },

  sessions_send: {
    description: "Send message to a session",
    execute: async (params) => {
      const result = await sendMessage(params.sessionId, params.message);
      return { success: result };
    }
  },

  sessions_spawn: {
    description: "Create a new sub-session",
    execute: async (params) => {
      // 创建新会话
      const newSession = await spawnSession({
        parentSessionId: params.sessionId,
        systemPrompt: params.systemPrompt,
        inheritContext: true,  // 继承父会话上下文
        inheritTools: true,    // 继承工具策略
      });

      return {
        sessionId: newSession.id,
        sessionKey: newSession.key,
        inheritMessage: "Context inherited from parent session"
      };
    }
  },

  session_status: {
    description: "Check session status",
    execute: async (params) => {
      const status = await getSessionStatus(params.sessionId);
      return status;
    }
  }
};
```

### 3.6 外部 CLI 集成

OpenClaw 通过技能系统（Skills）集成外部 CLI：

```yaml
# skill.yaml 示例
name: gateway-control
description: Control the OpenClaw gateway service
commands:
  - name: start
    cli: "openclaw gateway run"
    args: [--bind, { type: "string" }, --port, { type: "number" }]
  - name: stop
    cli: "pkill -f openclaw-gateway"
  - name: status
    cli: "openclaw channels status --probe"
```

### 3.7 本章小结

| 主题 | 核心概念 | 关键实现 |
|------|---------|----------|
| 工具分类 | 按功能分组 | group:fs, group:runtime 等 |
| 策略体系 | 多层权限控制 | 7 级优先级 |
| 安全机制 | SSRF/危险命令 | 路径验证/IP 检查 |
| 会话管理 | 子会话创建 | inheritContext |

---

## 第四章：Agent 循环机制

### 4.1 Agent 循环概述

Agent 循环是 Agent 的**大脑**，它控制着 Agent 如何思考、决策和行动。

### 4.2 循环流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent 循环流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ 接收    │───▶│ 分析    │───▶│ 决策    │───▶│ 执行    │     │
│  │ 输入    │    │ 意图    │    │ 下一步  │    │ 工具    │     │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘     │
│       ▲                                              │          │
│       │                                              ▼          │
│       │               ┌─────────┐    ┌─────────┐              │
│       └───────────────│ 评估    │◀───│ 响应    │◀─────────────┘
│                       │ 结果    │    │ 用户    │
│                       └─────────┘    └─────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 主运行循环实现

```typescript
async function runEmbeddedPiAgent(params) {
  // 1. 解析配置
  const provider = params.provider ?? DEFAULT_PROVIDER;
  const modelId = params.model ?? DEFAULT_MODEL;
  const { model, error } = resolveModel(provider, modelId);

  // 2. 上下文窗口检查
  const ctxInfo = resolveContextWindowInfo({
    modelContextWindow: model?.contextWindow,
    cfg: params.config,
    defaultTokens: DEFAULT_CONTEXT_TOKENS
  });

  const ctxGuard = evaluateContextWindowGuard({
    tokens: ctxInfo.tokens,
    hardMin: CONTEXT_WINDOW_HARD_MIN_TOKENS,
    warnBelow: CONTEXT_WINDOW_WARN_BELOW_TOKENS
  });

  if (ctxGuard.shouldBlock) {
    throw new FailoverError(
      `Model context window too small (${ctxGuard.tokens} tokens)`,
      { reason: "unknown", provider, model: modelId }
    );
  }

  // 3. 认证 Profile 解析
  const authStore = ensureAuthProfileStore(agentDir);
  const profileOrder = resolveAuthProfileOrder({
    provider,
    model: modelId,
    config: params.config
  });

  let profileIndex = 0;
  let overflowCompactionAttempted = false;

  // 4. 主循环
  while (true) {
    const attempt = await runEmbeddedAttempt({
      ...params,
      thinkLevel,
    });

    if (attempt.promptError && !attempt.aborted) {
      const errorText = describeUnknownError(attempt.promptError);

      // 5. 错误处理分支
      if (isContextOverflowError(errorText)) {
        // 上下文溢出 → 尝试压缩
        if (!overflowCompactionAttempted) {
          overflowCompactionAttempted = true;
          const compactResult = await compactEmbeddedPiSessionDirect({
            sessionId: params.sessionId,
            authProfileId: profileOrder[profileIndex],
            provider,
            model: modelId,
            thinkLevel,
          });

          if (compactResult.compacted) {
            continue;  // 重试
          }
        }

        return {
          payloads: [{
            text: "Context overflow: prompt too large. Try again with less input.",
            isError: true,
          }],
          error: { kind: "context_overflow" }
        };
      }

      // 认证失败 → 切换 Profile
      if (isFailoverErrorMessage(errorText) && await advanceAuthProfile()) {
        continue;  // 重试
      }
    }

    // 6. 成功返回
    return {
      payloads: buildEmbeddedRunPayloads(attempt),
      meta: {
        agentMeta: attempt.agentMeta,
        aborted: attempt.aborted,
      },
    };
  }
}
```

### 4.4 认证故障转移

当 API 调用失败时，OpenClaw 会自动尝试其他认证方式：

```typescript
const profileCandidates = lockedProfileId
  ? [lockedProfileId]
  : profileOrder.length > 0 ? profileOrder : [undefined];

let profileIndex = 0;

const advanceAuthProfile = async (): Promise<boolean> => {
  // 尝试下一个认证 Profile
  let nextIndex = profileIndex + 1;

  while (nextIndex < profileCandidates.length) {
    const candidate = profileCandidates[nextIndex];

    // 跳过冷却中的 Profile
    if (candidate && isProfileInCooldown(authStore, candidate)) {
      nextIndex += 1;
      continue;
    }

    try {
      // 切换到新的 Profile
      await applyApiKeyInfo(candidate);
      profileIndex = nextIndex;
      thinkLevel = initialThinkLevel;
      attemptedThinking.clear();
      return true;  // 成功切换
    } catch {
      nextIndex += 1;
    }
  }

  return false;  // 无可用 Profile
};
```

### 4.5 错误处理策略

OpenClaw 实现了**智能错误分类和处理**：

```typescript
type FailoverReason =
  | "auth"              // 认证错误
  | "rate_limit"        // 速率限制
  | "context_overflow"  // 上下文溢出
  | "timeout"           // 超时
  | "compaction_failure" // 压缩失败
  | "unknown";

function classifyFailoverReason(message: string): FailoverReason {
  if (/invalid api key|authentication failed|unauthorized/i.test(message)) {
    return "auth";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "rate_limit";
  }
  if (/context length|token limit|too many tokens/i.test(message)) {
    return "context_overflow";
  }
  if (/timeout|timed out/i.test(message)) {
    return "timeout";
  }
  if (/compaction|summarization failed/i.test(message)) {
    return "compaction_failure";
  }
  return "unknown";
}

// 错误处理策略映射
const ERROR_STRATEGIES: Record<FailoverReason, FailoverStrategy> = {
  auth: {
    action: "switch_profile",
    maxAttempts: 3,
    cooldown: 60000  // 1 分钟冷却
  },
  rate_limit: {
    action: "wait_and_retry",
    maxAttempts: 2,
    backoff: "exponential"
  },
  context_overflow: {
    action: "compact_and_retry",
    maxAttempts: 1
  },
  timeout: {
    action: "retry",
    maxAttempts: 2,
    timeoutIncrease: 1.5
  },
  compaction_failure: {
    action: "return_error",
    maxAttempts: 0
  },
  unknown: {
    action: "retry",
    maxAttempts: 1
  }
};
```

### 4.6 Hook 扩展点

OpenClaw 提供了多个扩展点：

| Hook | 时机 | 用途 | 异步 |
|------|------|------|------|
| `before_agent_start` | Agent 运行前 | 初始化、日志记录 | 否 |
| `after_tool_use` | 工具使用后 | 记录、修改结果 | 否 |
| `before_prompt` | 发送 Prompt 前 | 修改提示词 | 否 |
| `agent_end` | Agent 完成后 | 清理、通知 | 是 |

```typescript
// 运行前 Hook
await hookRunner.runBeforeAgentStart({
  prompt: params.prompt,
  messages: activeSession.messages,
}, {
  agentId: params.sessionKey?.split(":")[0] ?? "main",
  sessionKey: params.sessionKey,
});

// 运行后 Hook（异步）
if (hookRunner?.hasHooks("agent_end")) {
  hookRunner.runAgentEnd({
    messages: messagesSnapshot,
    success: !aborted && !promptError,
    error: promptError,
    durationMs: Date.now() - promptStartedAt,
  }).catch((err) => {
    console.warn(`agent_end hook failed: ${err}`);
  });
}
```

### 4.7 沙箱隔离系统

OpenClaw 支持**容器化沙箱**来安全执行代码：

```typescript
function resolveSandboxConfigForAgent(params) {
  const sessionId = params.sessionKey.replace(/[^a-zA-Z0-9-]/g, "-");

  return {
    enabled: params.config.sandbox?.enabled ?? false,
    image: params.config.sandbox?.image || "ubuntu:22.04",
    containerName: `openclaw-${sessionId}`,
    workspaceAccess: params.config.sandbox?.workspaceAccess || "rw",
    networkEnabled: params.config.sandbox?.networkEnabled ?? true,
    resources: {
      memory: params.config.sandbox?.memory || "512M",
      cpu: params.config.sandbox?.cpu || "1.0",
    },
    tools: {
      enabled: true,
      allow: [],  // 默认不允许任何工具
      deny: ["apply_patch", "write"],  // 只读模式
    },
  };
}

async function executeInSandbox(params, sandboxConfig) {
  const container = await startContainer({
    image: sandboxConfig.image,
    containerName: sandboxConfig.containerName,
    volumes: {
      workspace: { bind: sandboxConfig.workspaceMount, mode: sandboxConfig.workspaceAccess }
    },
    network: sandboxConfig.networkEnabled ? "bridge" : "none",
    resources: sandboxConfig.resources,
  });

  try {
    const result = await container.exec({
      cmd: params.cmd,
      timeout: params.timeout,
      workdir: params.workdir,
      env: params.env,
    });

    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } finally {
    await container.stop();
  }
}
```

### 4.8 完整执行流程追踪

让我们追踪一个完整的 Agent 执行流程：

**用户输入**："帮我创建一个新的 OpenClaw 会话"

```
Step 1: 接收输入
  └─ 解析会话 Lane: "agent:telegram:dm:123456"
  └─ 创建 runId: "run_abc123"
  └─ 触发 before_agent_start Hook

Step 2: 加载上下文
  ├─ 加载历史消息（limitHistoryTurns: 50 轮）
  ├─ 加载技能配置（loadWorkspaceSkillEntries）
  └─ 加载工具策略（resolveEffectiveToolPolicy）

Step 3: 构建 Prompt
  ├─ 系统提示词（buildEmbeddedSystemPrompt）
  ├─ 历史对话（sanitizeSessionHistory）
  └─ 当前输入（detectAndLoadPromptImages）

Step 4: 发送请求
  ├─ 认证 Profile: "default"
  ├─ 检查上下文窗口（< 128K tokens ✓）
  └─ 调用 LLM API（createAgentSession）

Step 5: 接收响应（流式）
  ├─ <thinking> 分析任务：创建新会话
  ├─ "我将创建一个新的会话..."
  ├─ <final> 工具调用: sessions_spawn
  └─ 触发 after_tool_use Hook

Step 6: 执行工具
  ├─ 验证工具权限
  ├─ 调用 sessions_spawn 工具
  └─ 返回新会话信息

Step 7: 工具结果反馈给 LLM
  └─ session_id="new_session_xyz"

Step 8: 生成最终响应
  └─ "新会话已创建！会话 ID: new_session_xyz"

Step 9: 清理
  ├─ 保存会话历史
  ├─ 触发 agent_end Hook
  └─ 释放资源（session.cleanup）
```

### 4.9 本章小结

| 主题 | 核心概念 | 关键实现 |
|------|---------|----------|
| 主循环 | while(true) 模式 | runEmbeddedPiAgent |
| 认证轮换 | Profile 故障转移 | advanceAuthProfile |
| 错误分类 | 6 种错误类型 | classifyFailoverReason |
| Hook 扩展 | 4 个扩展点 | before/after hooks |
| 沙箱隔离 | 容器化执行 | executeInSandbox |

---

## 第五章：系统架构总结

### 5.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OpenClaw 架构                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                        用户界面层                               │ │
│  │  CLI / Web UI / Mac App / Mobile App / API                     │ │
│  └─────────────────────────┬─────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                        渠道层                                   │ │
│  │  Telegram / Discord / Slack / Signal / WhatsApp / Web           │ │
│  └─────────────────────────┬─────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                       路由层                                    │ │
│  │  Router / Command Queue / Lane Manager                          │ │
│  └─────────────────────────┬─────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      Agent 核心层                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │ │
│  │  │ 上下文管理  │  │  工具策略   │  │   Agent 循环        │   │ │
│  │  │ - 窗口保护  │  │ - 权限控制  │  │   - 思考/决策      │   │ │
│  │  │ - 历史限制  │  │ - 沙箱隔离  │  │   - 执行/重试      │   │ │
│  │  │ - 压缩摘要  │  │ - 工具过滤  │  │   - 错误处理       │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │ │
│  └─────────────────────────┬─────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                     Provider 层                                │ │
│  │  Anthropic / OpenAI / Google / AWS Bedrock / ...               │ │
│  └─────────────────────────┬─────────────────────────────────────┘ │
│                            │                                        │
│                            ▼                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      LLM 模型层                                 │ │
│  │  Claude / GPT-4 / Gemini / ...                                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 核心设计原则

#### 5.2.1 分层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                       分层架构示例                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户界面层 ──▶ 渠道层 ──▶ 路由层 ──▶ Agent 核心 ──▶ Provider   │
│                                                                 │
│  每层职责单一，易于测试和维护                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2.2 松耦合设计

```typescript
// 通过依赖注入实现松耦合
function runEmbeddedPiAgent(params) {
  // 注入依赖（不关心具体实现）
  const sessionManager = params.sessionManager ?? createSessionManager();
  const modelResolver = params.modelResolver ?? createModelResolver();
  const toolFactory = params.toolFactory ?? createToolFactory();
  const hookRunner = params.hookRunner ?? createNoOpHookRunner();

  // 使用依赖
  const model = modelResolver.resolve(params.provider, params.model);
  const tools = toolFactory.create(params.sessionKey);

  // 业务逻辑
  return executeAgentLoop({ sessionManager, model, tools, hookRunner });
}
```

#### 5.2.3 安全优先

```typescript
// 多层安全防护
const securityLayers = [
  // 1. 输入验证
  { name: "input_validation", function: validateInput },

  // 2. 路径检查
  { name: "path_check", function: checkPathSafety },

  // 3. 命令过滤
  { name: "command_filter", function: filterDangerousCommands },

  // 4. 资源限制
  { name: "resource_limit", function: limitResources },

  // 5. 沙箱隔离
  { name: "sandbox_isolation", function: runInSandbox },
];
```

### 5.3 关键创新点

| 创新点 | 解决的问题 | 实现方式 |
|--------|------------|----------|
| Lane 机制 | 并发控制、竞态条件 | 会话级别的串行执行 |
| 上下文保护 | 上下文溢出 | 多级回退 + 自动压缩 |
| 工具策略 | 权限控制 | 多级别、可组合的策略 |
| 流式处理 | 实时响应 | 块级处理 + 重复检测 |
| 会话快照 | 历史持久化 | 完整的对话保存 |
| Profile 轮换 | 认证故障 | 自动切换 API Key |

### 5.4 扩展指南

#### 5.4.1 如何添加新的工具？

1. 在 `src/agents/tools/` 创建新工具文件
2. 实现 `Tool` 接口
3. 在 `createOpenClawCodingTools` 中注册
4. 添加工具策略配置

```typescript
// 示例：添加新的文件搜索工具
export function createFileSearchTool(options) {
  return {
    name: "file_search",
    description: "Search for files matching a pattern",
    input: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern" },
        path: { type: "string", description: "Search directory" },
      },
      required: ["pattern"],
    },
    async execute(params, context) {
      const results = await searchFiles(params.pattern, params.path);
      return { success: true, results };
    },
  };
}
```

#### 5.4.2 如何添加新的 Provider？

1. 实现 `Provider` 接口
2. 在 `src/agents/providers/` 添加实现
3. 更新 `models.json` 配置
4. 添加认证处理逻辑

```typescript
// 示例：添加新的 LLM Provider
export class NewProvider implements LLMProvider {
  async complete(params: CompletionParams): Promise<CompletionResult> {
    // 调用新 Provider 的 API
    const response = await callNewProviderAPI(params);
    return parseResponse(response);
  }

  async stream(params: CompletionParams): Promise<AsyncIterable<Chunk>> {
    // 支持流式响应
    return streamFromNewProvider(params);
  }
}
```

#### 5.4.3 如何添加新的 Hook？

1. 在 `hook-runner` 中定义新 Hook
2. 在 Agent 循环的合适位置调用
3. 编写 Hook 文档

```typescript
// 定义新的 Hook
const HOOKS = {
  before_agent_start: [],
  after_tool_use: [],
  before_prompt: [],
  agent_end: [],
  // 新增：tool_error
  tool_error: [],
};

// 在 Agent 循环中调用
try {
  await tool.execute(params);
} catch (error) {
  // 调用 tool_error Hook
  await hookRunner.runToolError({
    tool: tool.name,
    error,
    params,
  });
  throw error;
}
```

---

## 总结

OpenClaw 是一个设计精良的 Agent 框架，它通过：

1. **上下文工程** 解决了长对话的 Token 限制问题
2. **信息流设计** 确保了高效的消息路由和事件处理
3. **工具系统** 提供了强大而安全的能力扩展
4. **Agent 循环** 实现了智能的自主决策和错误恢复

这套设计使得 OpenClaw 能够：
- 处理复杂的多轮对话
- 安全地执行各种操作
- 灵活地适应不同场景
- 可靠地运行在生产环境中

### 进一步阅读

- [配置指南](/configuration)：了解如何配置 Agent
- [工具开发](/tools)：学习如何开发自定义工具
- [渠道集成](/channels)：了解如何添加新的消息渠道
- [API 参考](/api)：查看完整的 API 文档

---

> 本教程基于 OpenClaw v1.0+ 版本编写。如有更新，请以最新版本为准。
