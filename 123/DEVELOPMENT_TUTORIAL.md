# 工作流对话机器人 - 完整开发教程

> 从零开始构建智能对话工作流系统

---

## 📚 目录

1. [系统概述](#1-系统概述)
2. [基础概念](#2-基础概念)
3. [系统架构](#3-系统架构)
4. [开发环境准备](#4-开发环境准备)
5. [快速开始](#5-快速开始)
6. [核心组件详解](#6-核心组件详解)
7. [API 参考](#7-api-参考)
8. [实战教程](#8-实战教程)
9. [高级功能](#9-高级功能)
10. [部署指南](#10-部署指南)
11. [最佳实践](#11-最佳实践)
12. [故障排查](#12-故障排查)

---

## 1. 系统概述

### 1.1 什么是工作流对话机器人？

工作流对话机器人是一个**智能对话系统**，它能够：

- 🗣️ **理解自然语言**：接收用户的自然语言输入
- 🔄 **执行工作流**：将用户需求转换为可执行的工作流任务
- ⏸️ **处理中断**：在需要更多信息时暂停并询问用户
- 📊 **数据分析**：调用各种分析工具处理数据
- 📈 **结果展示**：以可视化的方式展示结果

### 1.2 应用场景

```
用户："帮我对比分析一下销售数据Q1和Q4的差异"
  ↓
机器人：启动工作流 → 识别需要对比分析
  ↓
机器人："请问您希望使用哪种对比方法？"
  ↓
用户："使用t检验，并生成可视化图表"
  ↓
机器人：恢复工作流 → 执行t检验 → 生成图表 → 返回结果
```

### 1.3 技术栈

| 技术 | 用途 | 说明 |
|-----|------|-----|
| **Gradio** | Web界面 | 快速构建机器学习应用的UI框架 |
| **Python** | 开发语言 | 核心逻辑实现 |
| **PIL/Pillow** | 图像处理 | 处理和展示可视化结果 |
| **异步编程** | 工作流管理 | 处理长时间运行的任务 |

---

## 2. 基础概念

### 2.1 工作流（Workflow）

#### 什么是工作流？

**工作流**是一系列有序的任务步骤，用于完成复杂的业务逻辑。

```
工作流示例：数据分析流程

步骤1: 数据收集
   ↓
步骤2: 数据清洗
   ↓
步骤3: 统计分析
   ↓
步骤4: 结果可视化
   ↓
步骤5: 生成报告
```

#### 工作流状态

一个工作流在其生命周期中有多种状态：

```python
# 状态转换图
[未启动] → [运行中] → [中断] → [恢复] → [完成]
                      ↓
                   [失败]
```

**常见状态：**

| 状态 | 说明 | 示例 |
|-----|------|-----|
| `initialized` | 已初始化 | 工作流刚创建 |
| `running` | 运行中 | 正在执行任务 |
| `interrupted` | 中断等待 | 需要用户补充信息 |
| `completed` | 已完成 | 所有步骤执行完毕 |
| `failed` | 失败 | 出现错误 |

### 2.2 RunID（运行标识符）

#### 定义

**RunID** 是工作流的唯一标识符，用于跟踪和管理特定的工作流实例。

```python
# RunID 示例
run_20240126_143052_abc123
│   │        │      │
│   │        │      └─ 唯一标识符
│   │        └─ 时间戳
│   └─ 日期
└─ 前缀
```

#### 用途

```python
# 1. 启动工作流，获取 RunID
run_id = start_workflow("分析销售数据")
# 输出: run_20240126_143052

# 2. 使用 RunID 查询状态
info = get_workflow_info(run_id)
# 输出: {"status": "running", "progress": 50}

# 3. 使用 RunID 恢复中断的工作流
resume_workflow("使用t检验", run_id)
```

### 2.3 状态机（State Machine）

#### 概念

**状态机**是一种数学模型，用于描述系统在不同状态之间的转换。

```python
# 简化的状态机实现

class WorkflowStateMachine:
    def __init__(self):
        self.state = "initialized"
        self.transitions = {
            "initialized": ["running"],
            "running": ["completed", "interrupted", "failed"],
            "interrupted": ["running", "failed"],
            "failed": ["initialized"],
            "completed": []
        }

    def transition(self, new_state):
        if new_state in self.transitions[self.state]:
            self.state = new_state
            return True
        return False
```

#### 在我们系统中的应用

```python
# 工作流状态转换
workflow_state = {
    "current_state": "interrupted",
    "history": ["initialized", "running", "interrupted"],
    "can_resume": True,
    "requires_input": True
}
```

### 2.4 对话历史（Conversation History）

#### 定义

**对话历史**是用户与系统之间所有交互的记录，用于：

- 🧠 **上下文理解**：理解当前对话的背景
- 🔄 **状态恢复**：从中断点恢复对话
- 📊 **数据分析**：分析用户需求模式

#### 数据结构

```python
conversation_history = [
    {
        "role": "user",           # 角色：user 或 assistant
        "content": "分析销售数据", # 消息内容
        "timestamp": "2024-01-26T14:30:52",  # 时间戳
        "metadata": {             # 元数据
            "run_id": "run_123",
            "intent": "analysis"
        }
    },
    {
        "role": "assistant",
        "content": "好的，请问需要分析哪些指标？",
        "timestamp": "2024-01-26T14:30:53",
        "metadata": {
            "run_id": "run_123",
            "state": "interrupted"
        }
    }
]
```

### 2.5 工具函数（Tool Functions）

#### 定义

**工具函数**是执行特定任务的独立函数模块，可以被工作流调用。

```python
# 工具函数的标准结构

def tool_function(parameters: dict) -> dict:
    """
    工具函数模板

    Args:
        parameters: 从工作流传递的参数字典

    Returns:
        {
            "message": "执行结果消息",
            "result": {
                "files": ["文件路径列表"],
                "images": [PIL.Image对象列表]
            }
        }
    """
    # 1. 参数验证
    # 2. 执行任务
    # 3. 生成文件和图片
    # 4. 返回结果
    pass
```

#### 示例

```python
def statistical_analysis(parameters: dict) -> dict:
    """统计分析工具"""

    # 提取参数
    data_path = parameters.get("data_path")
    method = parameters.get("method", "t-test")

    # 执行分析
    result = perform_statistical_test(data_path, method)

    # 生成可视化
    chart = create_visualization(result)

    # 返回结果
    return {
        "message": f"统计分析完成，使用方法: {method}",
        "result": {
            "files": [result.csv_path],
            "images": [chart]
        }
    }
```

### 2.6 异步处理（Asynchronous Processing）

#### 概念

**异步处理**允许系统在等待长时间任务完成时，不阻塞其他操作。

```python
# 同步 vs 异步

# 同步方式（阻塞）
def start_workflow_sync(user_input):
    result = workflow.run()  # 等待完成
    return result  # 只有完成后才返回

# 异步方式（非阻塞）
async def start_workflow_async(user_input):
    run_id = workflow.start()  # 立即返回ID
    return run_id  # 立即返回，不等待完成

# 后续可以查询状态
result = await workflow.check_status(run_id)
```

#### 在我们的应用中

```python
# 工作流不需要立即完成
def handle_user_input(user_input):
    # 1. 立即启动工作流，获取 runID
    run_id = start_workflow(user_input)

    # 2. 立即返回响应给用户
    return f"工作流已启动，ID: {run_id}"

# 用户可以稍后查看结果
def check_results(run_id):
    return get_workflow_info(run_id)
```

### 2.7 回调机制（Callback）

#### 定义

**回调**是一种函数，作为参数传递给另一个函数，在特定事件发生时被调用。

```python
# 回调示例

def process_data(data, callback):
    """处理数据，完成后调用回调"""
    result = analyze(data)
    callback(result)  # 调用回调函数

# 定义回调函数
def on_complete(result):
    print(f"处理完成: {result}")

# 使用回调
process_data(my_data, on_complete)
```

---

## 3. 系统架构

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     用户界面层                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ 聊天对话框  │  │ 结果画廊   │  │ 文件下载   │        │
│  └────────────┘  └────────────┘  └────────────┘        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                    业务逻辑层                            │
│  ┌──────────────────────────────────────────────┐      │
│  │         对话处理器 (ChatHandler)              │      │
│  │  - 处理用户输入                               │      │
│  │  - 管理对话历史                               │      │
│  │  - 协调工作流和工具                           │      │
│  └──────────────────────────────────────────────┘      │
│                           │                              │
│  ┌────────────────────────▼──────────────────────┐     │
│  │       工作流管理器 (WorkflowManager)           │     │
│  │  - 启动/恢复工作流                             │     │
│  │  - 状态跟踪                                   │     │
│  │  - 参数解析                                   │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────┴──────────────────────────────┐
│                    工具执行层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │统计分析  │  │趋势分析  │  │相关性   │  │ 对比   │ │
│  │   工具   │  │  工具    │  │ 分析工具│  │ 分析   │ │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 3.2 数据流图

```
用户输入
   │
   ├─→ 检查是否有活跃工作流
   │       │
   │       ├─ 有: 恢复工作流
   │       │       │
   │       │       ├─→ resume_workflow(input, run_id)
   │       │       │       │
   │       │       │       └─→ get_workflow_info(run_id)
   │       │       │
   │       └─ 无: 启动新工作流
   │               │
   │               ├─→ start_workflow(input)
   │               │       │
   │               │       └─→ get_workflow_info(run_id)
   │
   ├─→ 判断工作流状态
   │       │
   │       ├─ interrupted (中断)
   │       │       │
   │       │       └─→ 询问用户更多信息
   │       │
   │       └─ completed (完成)
   │               │
   │               ├─→ 提取参数
   │               │
   │               ├─→ 调用工具函数
   │               │       │
   │               │       ├─→ 处理数据
   │               │       │
   │               │       └─→ 生成文件和图片
   │               │
   │               └─→ 格式化结果
   │
   └─→ 更新界面
           │
           ├─→ 更新对话历史
           ├─→ 展示图片
           └─→ 提供文件下载
```

### 3.3 模块关系图

```
WorkflowStateManager
    │
    ├─ 管理工作流状态
    │   └─ active_workflows: Dict[str, Dict]
    │
    └─ 管理对话历史
        └─ conversation_history: Dict[str, List[Dict]]

Tool Functions
    │
    ├─ inline_compare
    ├─ statistical_analysis
    ├─ trend_analysis
    └─ correlation_analysis

Gradio Interface
    │
    ├─ Chatbot (对话界面)
    ├─ Gallery (图片展示)
    └─ File (文件下载)
```

---

## 4. 开发环境准备

### 4.1 系统要求

| 组件 | 最低要求 | 推荐配置 |
|-----|---------|---------|
| 操作系统 | Windows/Linux/macOS | 任意 |
| Python | 3.8+ | 3.10+ |
| 内存 | 2GB | 4GB+ |
| 磁盘 | 500MB | 1GB+ |

### 4.2 安装步骤

#### 步骤 1：创建虚拟环境（推荐）

```bash
# 使用 venv
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows

# 使用 conda
conda create -n workflow-chatbot python=3.10
conda activate workflow-chatbot
```

#### 步骤 2：安装依赖

```bash
# 从 requirements.txt 安装
pip install -r requirements.txt

# 或手动安装
pip install gradio>=4.0.0
pip install Pillow>=10.0.0
```

#### 步骤 3：验证安装

```bash
# 检查 Python 版本
python3 --version

# 检查已安装的包
pip list | grep -E "gradio|Pillow"

# 运行测试
python3 workflow_chatbot.py
```

### 4.3 IDE 推荐配置

#### VS Code 配置

创建 `.vscode/settings.json`:

```json
{
    "python.defaultInterpreterPath": "./venv/bin/python",
    "python.linting.enabled": true,
    "python.linting.pylintEnabled": true,
    "python.formatting.provider": "black",
    "editor.formatOnSave": true,
    "python.testing.pytestEnabled": true
}
```

#### PyCharm 配置

1. 打开项目设置
2. 设置 Project Interpreter 为虚拟环境
3. 启用 Black 代码格式化
4. 配置 Pylint 代码检查

---

## 5. 快速开始

### 5.1 Hello World 示例

创建第一个简单的对话机器人：

```python
from gradio import Interface
import gradio as gr

def simple_chatbot(message):
    """最简单的聊天机器人"""
    responses = {
        "你好": "你好！有什么可以帮助你的吗？",
        "帮助": "我可以帮你进行数据分析和可视化",
        "再见": "再见！期待下次见面"
    }
    return responses.get(message, "我不理解，请重新输入")

# 创建界面
demo = gr.Interface(
    fn=simple_chatbot,
    inputs=gr.Textbox(label="输入消息"),
    outputs=gr.Textbox(label="回复"),
    title="简单聊天机器人"
)

demo.launch()
```

### 5.2 运行第一个工作流

```python
from workflow_chatbot import (
    start_workflow,
    get_workflow_info
)

# 1. 启动工作流
user_input = "帮我分析销售数据"
run_id = start_workflow(user_input)
print(f"工作流已启动: {run_id}")

# 2. 查询状态
info = get_workflow_info(run_id)
print(f"工作流状态: {info['status']}")
print(f"消息: {info['message']}")

# 3. 如果完成，获取结果
if info['status'] == 'completed':
    data = info['data']
    print(f"解析的参数: {data.get('parameters')}")
```

### 5.3 创建自定义工具

```python
from PIL import Image, ImageDraw, ImageFont
import os

def my_custom_tool(parameters: dict) -> dict:
    """
    自定义工具：生成简单的数据报告图表

    参数:
        parameters: {
            "title": "图表标题",
            "values": [10, 20, 30],
            "labels": ["A", "B", "C"]
        }
    """
    title = parameters.get("title", "数据报告")
    values = parameters.get("values", [])
    labels = parameters.get("labels", [])

    # 创建图片
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)

    # 绘制简单的柱状图
    max_val = max(values) if values else 1
    bar_width = 600 // len(values) if values else 100

    for i, (val, label) in enumerate(zip(values, labels)):
        x = 100 + i * bar_width
        height = (val / max_val) * 400
        y = 500 - height
        draw.rectangle([x, y, x + bar_width - 10, 500], fill='blue')

    # 保存文件
    output_path = "outputs/custom_chart.png"
    os.makedirs("outputs", exist_ok=True)
    img.save(output_path)

    # 返回结果
    return {
        "message": f"自定义工具执行完成: {title}",
        "result": {
            "files": [output_path],
            "images": [img]
        }
    }

# 注册工具
from workflow_chatbot import TOOL_FUNCTIONS
TOOL_FUNCTIONS["my_custom_tool"] = my_custom_tool
```

---

## 6. 核心组件详解

### 6.1 WorkflowStateManager（状态管理器）

#### 类定义

```python
class WorkflowStateManager:
    """管理工作流状态和对话历史"""

    def __init__(self):
        self.active_workflows: Dict[str, Dict] = {}
        self.conversation_history: Dict[str, List[Dict]] = {}
```

#### 核心方法

##### save_workflow_state()

```python
def save_workflow_state(self, run_id: str, state: dict):
    """
    保存工作流状态

    参数:
        run_id: 工作流ID
        state: {
            "status": "interrupted" | "completed",
            "message": "状态消息",
            "data": {...}
        }
    """
    self.active_workflows[run_id] = state
```

**使用示例：**

```python
manager = WorkflowStateManager()

# 保存状态
manager.save_workflow_state("run_123", {
    "status": "interrupted",
    "message": "需要更多数据",
    "data": {"required": ["dataset1"]}
})

# 获取状态
state = manager.get_workflow_state("run_123")
print(state['status'])  # 输出: interrupted
```

##### add_to_history()

```python
def add_to_history(self, run_id: str, role: str, content: str, metadata: dict = None):
    """
    添加对话历史

    参数:
        run_id: 工作流ID
        role: "user" 或 "assistant"
        content: 消息内容
        metadata: 附加元数据
    """
    if run_id not in self.conversation_history:
        self.conversation_history[run_id] = []

    self.conversation_history[run_id].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "metadata": metadata or {}
    })
```

**使用示例：**

```python
# 添加用户消息
manager.add_to_history(
    run_id="run_123",
    role="user",
    content="分析销售数据",
    metadata={"intent": "analysis"}
)

# 添加助手回复
manager.add_to_history(
    run_id="run_123",
    role="assistant",
    content="好的，正在启动分析流程"
)

# 获取历史
history = manager.get_history("run_123")
for msg in history:
    print(f"{msg['role']}: {msg['content']}")
```

### 6.2 工作流函数

#### start_workflow()

```python
def start_workflow(user_input: str) -> str:
    """
    启动工作流

    参数:
        user_input: 用户自然语言输入

    返回:
        run_id: 工作流运行ID

    实现要点:
        1. 解析用户意图
        2. 创建工作流实例
        3. 执行初始化步骤
        4. 返回唯一ID
    """
    # 实际实现示例
    intent = parse_intent(user_input)
    workflow = create_workflow(intent)
    run_id = workflow.initialize()
    return run_id
```

#### get_workflow_info()

```python
def get_workflow_info(run_id: str) -> Dict:
    """
    获取工作流信息

    参数:
        run_id: 工作流ID

    返回:
        {
            "run_id": "run_123",
            "status": "interrupted" | "completed" | "running",
            "message": "状态描述",
            "data": {
                "parameters": {...},
                "tools": [...]
            },
            "progress": 0-100  # 可选
        }
    """
    # 实际实现示例
    workflow = load_workflow(run_id)
    return {
        "run_id": run_id,
        "status": workflow.get_status(),
        "message": workflow.get_status_message(),
        "data": workflow.get_results()
    }
```

#### resume_workflow()

```python
def resume_workflow(user_input: str, run_id: str) -> str:
    """
    恢复中断的工作流

    参数:
        user_input: 用户补充的信息
        run_id: 工作流ID

    返回:
        run_id: 更新后的工作流ID

    实现要点:
        1. 加载中断的工作流
        2. 解析用户输入
        3. 更新工作流参数
        4. 继续执行
    """
    # 实际实现示例
    workflow = load_workflow(run_id)
    workflow.update_parameters(user_input)
    workflow.resume()
    return run_id
```

### 6.3 结果处理

#### process_tool_results()

```python
def process_tool_results(tool_output: Dict, run_id: str) -> Tuple[str, List]:
    """
    处理工具输出结果

    参数:
        tool_output: {
            "message": "处理消息",
            "result": {
                "files": [...],
                "images": [...]
            }
        }
        run_id: 工作流ID

    返回:
        (summary_text, display_items)
        - summary_text: 格式化的摘要文本
        - display_items: Gradio 组件列表
    """
    # 实现细节见源码
```

**处理流程：**

```
工具输出
   ↓
┌─────────────────┐
│ 提取消息        │ → 添加到摘要
└─────────────────┘
   ↓
┌─────────────────┐
│ 处理图片        │ → 转换为 Gradio.Image
└─────────────────┘
   ↓
┌─────────────────┐
│ 处理文件        │ → 添加文件信息
└─────────────────┘
   ↓
┌─────────────────┐
│ 添加历史信息    │ → 统计对话轮次
└─────────────────┘
   ↓
返回格式化结果
```

---

## 7. API 参考

### 7.1 核心函数 API

#### start_workflow()

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| user_input | str | ✅ | 用户自然语言输入 |

**返回值：** `str` - 工作流运行ID

**示例：**
```python
run_id = start_workflow("分析销售数据的趋势")
# 返回: "run_20240126_143052"
```

#### get_workflow_info()

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| run_id | str | ✅ | 工作流ID |

**返回值：** `Dict` - 工作流信息字典

**字段说明：**

| 字段 | 类型 | 说明 |
|-----|------|------|
| run_id | str | 工作流ID |
| status | str | 状态：interrupted/completed/running |
| message | str | 状态描述消息 |
| data | dict | 包含 parameters 和 tools |
| progress | int | 进度百分比 (0-100) |

**示例：**
```python
info = get_workflow_info("run_20240126_143052")
# {
#     "run_id": "run_20240126_143052",
#     "status": "completed",
#     "message": "分析完成",
#     "data": {
#         "parameters": {"method": "linear_regression"},
#         "tools": ["trend_analysis"]
#     }
# }
```

#### resume_workflow()

| 参数 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| user_input | str | ✅ | 用户补充信息 |
| run_id | str | ✅ | 工作流ID |

**返回值：** `str` - 更新后的工作流ID

**示例：**
```python
new_run_id = resume_workflow("使用移动平均法", "run_20240126_143052")
# 返回: "run_20240126_143052"
```

### 7.2 工具函数 API 规范

#### 标准签名

```python
def tool_function(parameters: dict) -> dict
```

#### 参数格式

```python
{
    "param1": "value1",
    "param2": "value2",
    ...
}
```

#### 返回值格式

```python
{
    "message": str,           # 执行结果消息
    "result": {
        "files": List[str],    # 文件路径列表
        "images": List[Image] # PIL.Image 对象列表
    }
}
```

#### 示例工具函数

```python
def example_tool(parameters: dict) -> dict:
    """
    示例工具函数

    参数:
        parameters: {
            "input_file": str,      # 输入文件路径
            "output_dir": str,      # 输出目录
            "option": str           # 选项
        }

    返回:
        {
            "message": "处理完成",
            "result": {
                "files": ["path/to/output1.csv", "path/to/output2.png"],
                "images": [PIL.Image, PIL.Image]
            }
        }
    """
    # 实现逻辑...
    pass
```

### 7.3 Gradio 组件 API

#### Chatbot

```python
gr.Chatbot(
    label="对话历史",
    height=500,
    bubble_full_width=False,
    avatar_images=(user_avatar, bot_avatar)
)
```

#### Gallery

```python
gr.Gallery(
    label="生成的图表",
    columns=2,
    rows=3,
    height="auto",
    object_fit="contain"
)
```

#### File

```python
gr.File(
    label="下载文件",
    file_count="multiple",
    interactive=False
)
```

---

## 8. 实战教程

### 8.1 教程 1：创建简单的分析工具

#### 目标

创建一个工具，读取CSV文件并生成基本的统计报告。

#### 步骤

**步骤 1：创建工具函数**

```python
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image
import io

def basic_statistics_tool(parameters: dict) -> dict:
    """
    基本统计分析工具

    参数:
        parameters: {
            "csv_path": str,      # CSV文件路径
            "columns": List[str]  # 要分析的列
        }
    """
    csv_path = parameters.get("csv_path")
    columns = parameters.get("columns", [])

    # 1. 读取数据
    df = pd.read_csv(csv_path)

    # 2. 生成统计报告
    if not columns:
        columns = df.select_dtypes(include=['number']).columns.tolist()

    stats = df[columns].describe()

    # 3. 保存统计报告
    output_dir = "outputs"
    import os
    os.makedirs(output_dir, exist_ok=True)

    stats_path = f"{output_dir}/statistics_report.csv"
    stats.to_csv(stats_path)

    # 4. 生成可视化
    plt.figure(figsize=(12, 6))

    for i, col in enumerate(columns[:4], 1):
        plt.subplot(2, 2, i)
        df[col].hist(bins=20)
        plt.title(f'{col} 分布')

    plt.tight_layout()

    # 保存为图片对象
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    buf.seek(0)
    img = Image.open(buf)

    chart_path = f"{output_dir}/distribution_charts.png"
    img.save(chart_path)

    # 5. 返回结果
    return {
        "message": f"统计分析完成！分析了 {len(columns)} 个数值列",
        "result": {
            "files": [stats_path, chart_path],
            "images": [img]
        }
    }
```

**步骤 2：注册工具**

```python
from workflow_chatbot import TOOL_FUNCTIONS

TOOL_FUNCTIONS["basic_statistics"] = basic_statistics_tool
```

**步骤 3：测试工具**

```python
# 创建测试数据
import pandas as pd
import os

os.makedirs("outputs", exist_ok=True)

# 生成测试CSV
test_data = pd.DataFrame({
    'A': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'B': [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    'C': [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
})
test_data.to_csv('outputs/test_data.csv', index=False)

# 测试工具
result = basic_statistics_tool({
    "csv_path": "outputs/test_data.csv",
    "columns": ["A", "B", "C"]
})

print(result['message'])
print(f"生成文件: {result['result']['files']}")
```

### 8.2 教程 2：实现多步骤工作流

#### 目标

创建一个需要多个步骤才能完成的复杂工作流。

#### 场景

用户请求进行数据对比分析，工作流需要：
1. 询问用户对比的方法
2. 询问用户需要可视化哪些维度
3. 执行分析并生成结果

#### 实现

**步骤 1：定义工作流状态**

```python
class ComparisonWorkflow:
    """对比分析工作流"""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.state = "step1_ask_method"
        self.data = {
            "method": None,
            "dimensions": None,
            "datasets": None
        }

    def process(self, user_input: str) -> dict:
        """处理用户输入"""

        if self.state == "step1_ask_method":
            return self._handle_step1(user_input)
        elif self.state == "step2_ask_dimensions":
            return self._handle_step2(user_input)
        elif self.state == "step3_complete":
            return self._handle_step3()
        else:
            return {"status": "error", "message": "未知状态"}

    def _handle_step1(self, user_input: str) -> dict:
        """处理第一步：询问对比方法"""
        # 保存用户输入
        self.data["method"] = user_input

        # 转到下一步
        self.state = "step2_ask_dimensions"

        return {
            "status": "interrupted",
            "message": f"好的，将使用 {user_input} 进行对比。请问需要对比哪些维度？\n"
                      "例如：销售额、利润率、客户数量等",
            "data": {}
        }

    def _handle_step2(self, user_input: str) -> dict:
        """处理第二步：询问可视化维度"""
        # 保存维度信息
        self.data["dimensions"] = user_input

        # 转到完成状态
        self.state = "step3_complete"

        return {
            "status": "interrupted",
            "message": f"明白！将对比 {self.data['dimensions']} 维度。\n"
                      "工作流即将完成分析...",
            "data": {}
        }

    def _handle_step3(self) -> dict:
        """处理第三步：完成分析"""
        # 执行实际的分析逻辑
        self.state = "completed"

        return {
            "status": "completed",
            "message": "对比分析完成！",
            "data": {
                "parameters": self.data,
                "tools": ["inline_compare"]
            }
        }
```

**步骤 2：集成到系统**

```python
# 修改 start_workflow
workflows = {}  # 全局工作流存储

def start_workflow(user_input: str) -> str:
    """启动对比分析工作流"""
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    workflow = ComparisonWorkflow(run_id)
    workflows[run_id] = workflow

    # 获取初始响应
    response = workflow.process(user_input)

    return run_id

# 修改 get_workflow_info
def get_workflow_info(run_id: str) -> dict:
    """获取工作流信息"""
    workflow = workflows.get(run_id)
    if not workflow:
        return {"status": "error", "message": "工作流不存在"}

    return {
        "run_id": run_id,
        "status": workflow.state if workflow.state != "step3_complete" else "completed",
        "message": "工作流运行中",
        "data": workflow.data
    }

# 修改 resume_workflow
def resume_workflow(user_input: str, run_id: str) -> str:
    """恢复工作流"""
    workflow = workflows.get(run_id)
    if not workflow:
        raise ValueError("工作流不存在")

    response = workflow.process(user_input)
    return run_id
```

**步骤 3：测试工作流**

```python
# 模拟完整对话
print("=== 对话开始 ===")

# 第一轮
user_input1 = "帮我对比Q1和Q4的销售数据"
run_id = start_workflow(user_input1)
info1 = get_workflow_info(run_id)
print(f"\n用户: {user_input1}")
print(f"助手: {info1['message']}")

# 第二轮
user_input2 = "使用t检验方法"
resume_workflow(user_input2, run_id)
info2 = get_workflow_info(run_id)
print(f"\n用户: {user_input2}")
print(f"助手: {info2['message']}")

# 第三轮
user_input3 = "对比销售额和客户数"
resume_workflow(user_input3, run_id)
info3 = get_workflow_info(run_id)
print(f"\n用户: {user_input3}")
print(f"助手: {info3['message']}")
```

### 8.3 教程 3：添加数据持久化

#### 目标

将工作流状态和对话历史保存到数据库，实现跨会话持久化。

#### 实现方案：使用 SQLite

**步骤 1：创建数据库模型**

```python
import sqlite3
from datetime import datetime
import json

class WorkflowDatabase:
    """工作流数据库管理"""

    def __init__(self, db_path="workflow.db"):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """初始化数据库表"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # 创建工作流表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workflows (
                run_id TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                state_data TEXT,
                created_at TEXT,
                updated_at TEXT
            )
        """)

        # 创建对话历史表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversation_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                timestamp TEXT,
                FOREIGN KEY (run_id) REFERENCES workflows (run_id)
            )
        """)

        conn.commit()
        conn.close()

    def save_workflow(self, run_id: str, status: str, state_data: dict):
        """保存工作流状态"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        now = datetime.now().isoformat()

        cursor.execute("""
            INSERT OR REPLACE INTO workflows
            (run_id, status, state_data, created_at, updated_at)
            VALUES (?, ?, ?, COALESCE((SELECT created_at FROM workflows WHERE run_id=?), ?), ?)
        """, (run_id, status, json.dumps(state_data), run_id, now, now))

        conn.commit()
        conn.close()

    def get_workflow(self, run_id: str) -> dict:
        """获取工作流"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT status, state_data FROM workflows WHERE run_id=?
        """, (run_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return {
                "status": row[0],
                "state_data": json.loads(row[1])
            }
        return None

    def save_message(self, run_id: str, role: str, content: str, metadata: dict = None):
        """保存对话消息"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO conversation_history
            (run_id, role, content, metadata, timestamp)
            VALUES (?, ?, ?, ?, ?)
        """, (run_id, role, content, json.dumps(metadata or {}), datetime.now().isoformat()))

        conn.commit()
        conn.close()

    def get_history(self, run_id: str) -> list:
        """获取对话历史"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT role, content, metadata, timestamp
            FROM conversation_history
            WHERE run_id=?
            ORDER BY timestamp ASC
        """, (run_id,))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "role": row[0],
                "content": row[1],
                "metadata": json.loads(row[2]),
                "timestamp": row[3]
            }
            for row in rows
        ]
```

**步骤 2：集成到状态管理器**

```python
class PersistentWorkflowManager:
    """支持持久化的工作流管理器"""

    def __init__(self):
        self.db = WorkflowDatabase()
        self.active_workflows = {}

    def save_workflow_state(self, run_id: str, state: dict):
        """保存工作流状态（同时保存到内存和数据库）"""
        self.active_workflows[run_id] = state
        self.db.save_workflow(run_id, state['status'], state)

    def get_workflow_state(self, run_id: str) -> dict:
        """获取工作流状态（优先从内存，否则从数据库）"""
        if run_id in self.active_workflows:
            return self.active_workflows[run_id]

        # 从数据库加载
        data = self.db.get_workflow(run_id)
        if data:
            state = data['state_data']
            self.active_workflows[run_id] = state
            return state

        return None

    def add_to_history(self, run_id: str, role: str, content: str, metadata: dict = None):
        """添加对话历史"""
        self.db.save_message(run_id, role, content, metadata)

    def get_history(self, run_id: str) -> list:
        """获取对话历史"""
        return self.db.get_history(run_id)

    def load_interrupted_workflows(self):
        """加载所有中断的工作流"""
        conn = self.db.db
        import sqlite3
        conn = sqlite3.connect(self.db.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT run_id, state_data FROM workflows WHERE status='interrupted'
        """)

        rows = cursor.fetchall()
        conn.close()

        for run_id, state_data_json in rows:
            state = json.loads(state_data_json)
            self.active_workflows[run_id] = state

        return len(rows)
```

**步骤 3：使用持久化管理器**

```python
# 替换原有的管理器
workflow_manager = PersistentWorkflowManager()

# 启动时加载中断的工作流
count = workflow_manager.load_interrupted_workflows()
print(f"加载了 {count} 个中断的工作流")

# 正常使用
run_id = start_workflow("分析销售数据")
# ... 系统重启 ...
# run_id 仍然可以从数据库中恢复
state = workflow_manager.get_workflow_state(run_id)
```

---

## 9. 高级功能

### 9.1 并发工作流处理

#### 问题

当多个用户同时使用系统时，如何避免工作流冲突？

#### 解决方案：使用线程锁

```python
import threading

class ThreadSafeWorkflowManager:
    """线程安全的工作流管理器"""

    def __init__(self):
        self.active_workflows = {}
        self.conversation_history = {}
        self.lock = threading.Lock()

    def save_workflow_state(self, run_id: str, state: dict):
        """线程安全的状态保存"""
        with self.lock:
            self.active_workflows[run_id] = state

    def get_workflow_state(self, run_id: str) -> dict:
        """线程安全的状态获取"""
        with self.lock:
            return self.active_workflows.get(run_id)

    def add_to_history(self, run_id: str, role: str, content: str, metadata: dict = None):
        """线程安全的历史添加"""
        with self.lock:
            if run_id not in self.conversation_history:
                self.conversation_history[run_id] = []

            self.conversation_history[run_id].append({
                "role": role,
                "content": content,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {}
            })
```

### 9.2 工作流超时处理

#### 需求

自动清理长时间未活动的工作流。

#### 实现

```python
import time
from datetime import datetime, timedelta

class WorkflowManagerWithTimeout:
    """支持超时的工作流管理器"""

    def __init__(self, timeout_minutes=30):
        self.active_workflows = {}
        self.conversation_history = {}
        self.timeout = timedelta(minutes=timeout_minutes)

    def save_workflow_state(self, run_id: str, state: dict):
        """保存状态时记录时间戳"""
        state['last_activity'] = datetime.now().isoformat()
        self.active_workflows[run_id] = state

    def cleanup_expired_workflows(self):
        """清理过期的工作流"""
        now = datetime.now()
        expired = []

        for run_id, state in self.active_workflows.items():
            last_activity = datetime.fromisoformat(state['last_activity'])
            if now - last_activity > self.timeout:
                expired.append(run_id)

        for run_id in expired:
            del self.active_workflows[run_id]
            if run_id in self.conversation_history:
                del self.conversation_history[run_id]

        return len(expired)

    # 定时清理
    def start_cleanup_scheduler(self, interval_seconds=300):
        """启动定时清理任务"""
        import threading

        def cleanup_loop():
            while True:
                count = self.cleanup_expired_workflows()
                if count > 0:
                    print(f"清理了 {count} 个过期工作流")
                time.sleep(interval_seconds)

        thread = threading.Thread(target=cleanup_loop, daemon=True)
        thread.start()
```

### 9.3 流式输出支持

#### 需求

对于长时间运行的任务，实时显示进度和中间结果。

#### 实现

```python
import queue
import threading

class StreamingWorkflow:
    """支持流式输出的工作流"""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.output_queue = queue.Queue()

    def run_with_streaming(self, parameters: dict):
        """运行工作流并流式输出"""
        def worker():
            # 步骤 1
            self.output_queue.put({"progress": 10, "message": "正在加载数据..."})
            time.sleep(1)

            # 步骤 2
            self.output_queue.put({"progress": 30, "message": "正在处理数据..."})
            time.sleep(2)

            # 步骤 3
            self.output_queue.put({"progress": 60, "message": "正在生成图表..."})
            time.sleep(1)

            # 完成
            self.output_queue.put({"progress": 100, "message": "完成！", "complete": True})

        thread = threading.Thread(target=worker)
        thread.start()

        return thread

    def get_streaming_output(self):
        """获取流式输出"""
        while True:
            try:
                output = self.output_queue.get(timeout=0.1)
                yield output
                if output.get('complete'):
                    break
            except queue.Empty:
                continue

# 在 Gradio 中使用
def create_streaming_interface():
    """创建支持流式输出的界面"""
    def process_with_streaming(user_input, history):
        run_id = start_workflow(user_input)
        workflow = StreamingWorkflow(run_id)

        workflow.run_with_streaming({})

        # 收集所有输出
        outputs = []
        for output in workflow.get_streaming_output():
            outputs.append(f"{output['message']} ({output['progress']}%)")
            # 实时更新界面
            yield history + [[user_input, "\n".join(outputs)]], []

        # 完成后获取最终结果
        final_info = get_workflow_info(run_id)
        # ...

    demo = gr.Interface(
        fn=process_with_streaming,
        inputs=[gr.Textbox(), gr.Chatbot()],
        outputs=[gr.Chatbot(), gr.Gallery()]
    )
    return demo
```

### 9.4 工作流版本控制

#### 需求

跟踪工作流的版本变化，支持回滚。

#### 实现

```python
class VersionedWorkflowManager:
    """支持版本控制的工作流管理器"""

    def __init__(self):
        self.workflows = {}
        self.versions = {}

    def save_workflow_version(self, run_id: str, state: dict, version_tag: str = None):
        """保存工作流版本"""
        if run_id not in self.versions:
            self.versions[run_id] = []

        version = {
            "version": len(self.versions[run_id]) + 1,
            "tag": version_tag,
            "state": state.copy(),
            "timestamp": datetime.now().isoformat()
        }

        self.versions[run_id].append(version)
        self.workflows[run_id] = state

        return version['version']

    def rollback_to_version(self, run_id: str, version_number: int):
        """回滚到指定版本"""
        if run_id not in self.versions:
            raise ValueError("工作流不存在")

        for version in self.versions[run_id]:
            if version['version'] == version_number:
                self.workflows[run_id] = version['state'].copy()
                return version

        raise ValueError("版本不存在")

    def get_version_history(self, run_id: str) -> list:
        """获取版本历史"""
        return self.versions.get(run_id, [])

# 使用示例
manager = VersionedWorkflowManager()

# 保存不同版本
manager.save_workflow_version("run_123", {"step": 1}, "初始版本")
manager.save_workflow_version("run_123", {"step": 2}, "处理中")
manager.save_workflow_version("run_123", {"step": 3}, "完成")

# 查看历史
history = manager.get_version_history("run_123")
for v in history:
    print(f"版本 {v['version']}: {v['tag']} - {v['timestamp']}")

# 回滚
manager.rollback_to_version("run_123", 2)
```

---

## 10. 部署指南

### 10.1 本地部署

#### 开发环境

```bash
# 1. 克隆或创建项目目录
mkdir workflow-chatbot
cd workflow-chatbot

# 2. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 运行应用
python workflow_chatbot.py
```

访问：`http://localhost:7860`

### 10.2 Docker 部署

#### 创建 Dockerfile

```dockerfile
# Dockerfile
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY workflow_chatbot.py .
COPY outputs/ ./outputs/

# 暴露端口
EXPOSE 7860

# 设置环境变量
ENV PYTHONUNBUFFERED=1

# 启动应用
CMD ["python", "workflow_chatbot.py"]
```

#### 创建 .dockerignore

```
.git
venv
__pycache__
*.pyc
*.pyo
*.pyd
outputs/*
!outputs/.gitkeep
```

#### 构建和运行

```bash
# 构建镜像
docker build -t workflow-chatbot:latest .

# 运行容器
docker run -d \
  --name chatbot \
  -p 7860:7860 \
  -v $(pwd)/outputs:/app/outputs \
  workflow-chatbot:latest

# 查看日志
docker logs -f chatbot
```

### 10.3 云服务部署

#### Hugging Face Spaces

1. **创建空间**
   - 访问 https://huggingface.co/spaces
   - 点击 "Create new Space"
   - 选择 "Gradio" SDK

2. **上传文件**
   ```bash
   git clone https://huggingface.co/spaces/your-username/workflow-chatbot
   cd workflow-chatbot

   # 复制文件
   cp workflow_chatbot.py .
   cp requirements.txt .

   git add .
   git commit -m "Initial commit"
   git push
   ```

3. **requirements.txt**
   ```txt
   gradio>=4.0.0
   Pillow>=10.0.0
   pandas
   matplotlib
   ```

#### AWS EC2

```bash
# 1. 启动 EC2 实例（选择 Ubuntu）

# 2. 连接到实例
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. 安装依赖
sudo apt update
sudo apt install -y python3-pip python3-venv

# 4. 设置应用
git clone your-repo
cd workflow-chatbot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. 使用 systemd 服务
sudo nano /etc/systemd/system/chatbot.service
```

**服务配置文件：**

```ini
[Unit]
Description=Workflow Chatbot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/workflow-chatbot
Environment="PATH=/home/ubuntu/workflow-chatbot/venv/bin"
ExecStart=/home/ubuntu/workflow-chatbot/venv/bin/python workflow_chatbot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl start chatbot
sudo systemctl enable chatbot
sudo systemctl status chatbot
```

### 10.4 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/chatbot

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:7860;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. 最佳实践

### 11.1 代码组织

#### 推荐的项目结构

```
workflow-chatbot/
├── README.md
├── requirements.txt
├── .env.example
├── .gitignore
│
├── config/
│   ├── __init__.py
│   ├── settings.py         # 配置文件
│   └── constants.py        # 常量定义
│
├── core/
│   ├── __init__.py
│   ├── workflow.py         # 工作流核心
│   ├── state_manager.py    # 状态管理
│   └── exceptions.py       # 自定义异常
│
├── tools/
│   ├── __init__.py
│   ├── base.py             # 工具基类
│   ├── statistical.py      # 统计分析工具
│   ├── visualization.py    # 可视化工具
│   └── comparison.py       # 对比分析工具
│
├── api/
│   ├── __init__.py
│   ├── workflow_api.py     # 工作流API
│   └── tool_api.py         # 工具API
│
├── ui/
│   ├── __init__.py
│   ├── app.py              # Gradio应用
│   └── components.py       # UI组件
│
├── utils/
│   ├── __init__.py
│   ├── logger.py           # 日志工具
│   ├── validators.py       # 数据验证
│   └── helpers.py          # 辅助函数
│
├── tests/
│   ├── __init__.py
│   ├── test_workflow.py
│   ├── test_tools.py
│   └── test_integration.py
│
├── outputs/                # 输出目录
├── logs/                   # 日志目录
└── data/                   # 测试数据
```

### 11.2 错误处理

#### 定义自定义异常

```python
# core/exceptions.py

class WorkflowError(Exception):
    """工作流基础异常"""
    pass

class WorkflowNotFoundError(WorkflowError):
    """工作流不存在"""
    pass

class WorkflowInterruptedError(WorkflowError):
    """工作流被中断"""
    pass

class ToolExecutionError(WorkflowError):
    """工具执行失败"""
    pass

class InvalidParameterError(WorkflowError):
    """无效参数"""
    pass
```

#### 使用异常处理

```python
def process_user_message(user_input: str, history: list):
    """处理用户消息，带完整错误处理"""

    try:
        # 验证输入
        if not user_input or not user_input.strip():
            raise InvalidParameterError("用户输入不能为空")

        # 启动或恢复工作流
        try:
            run_id = get_or_create_run_id()
        except Exception as e:
            raise WorkflowError(f"工作流初始化失败: {str(e)}")

        # 处理工作流
        workflow_info = get_workflow_info(run_id)

        if workflow_info['status'] == 'interrupted':
            response = handle_interrupted(workflow_info, user_input)
        elif workflow_info['status'] == 'completed':
            response = handle_completed(workflow_info)
        else:
            raise WorkflowError(f"未知状态: {workflow_info['status']}")

        return response

    except InvalidParameterError as e:
        return f"❌ 输入错误: {str(e)}"
    except WorkflowNotFoundError as e:
        return f"⚠️ 工作流不存在，请重新开始"
    except WorkflowInterruptedError as e:
        return f"⏸️ 工作流已暂停: {str(e)}"
    except ToolExecutionError as e:
        return f"🔧 工具执行失败: {str(e)}"
    except Exception as e:
        # 记录未预期的错误
        logger.error(f"未预期的错误: {str(e)}", exc_info=True)
        return "❌ 系统错误，请稍后重试"
```

### 11.3 日志记录

#### 配置日志系统

```python
# utils/logger.py

import logging
import sys
from pathlib import Path

def setup_logger(name: str, log_file: str = None, level=logging.INFO):
    """配置日志系统"""

    logger = logging.getLogger(name)
    logger.setLevel(level)

    # 创建格式化器
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 文件处理器
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

# 使用示例
logger = setup_logger('workflow', 'logs/workflow.log')
```

#### 在代码中使用日志

```python
from utils.logger import logger

def start_workflow(user_input: str) -> str:
    """启动工作流"""

    logger.info(f"启动工作流 - 用户输入: {user_input}")

    try:
        run_id = create_workflow(user_input)
        logger.info(f"工作流创建成功 - runID: {run_id}")
        return run_id

    except Exception as e:
        logger.error(f"工作流创建失败: {str(e)}", exc_info=True)
        raise
```

### 11.4 单元测试

#### 测试工作流函数

```python
# tests/test_workflow.py

import pytest
from core.workflow import start_workflow, get_workflow_info

class TestWorkflow:
    """工作流测试套件"""

    def test_start_workflow(self):
        """测试启动工作流"""
        user_input = "分析销售数据"
        run_id = start_workflow(user_input)

        assert run_id is not None
        assert run_id.startswith("run_")

    def test_get_workflow_info(self):
        """测试获取工作流信息"""
        run_id = start_workflow("测试")
        info = get_workflow_info(run_id)

        assert "run_id" in info
        assert "status" in info
        assert info["run_id"] == run_id

    def test_invalid_run_id(self):
        """测试无效的 runID"""
        with pytest.raises(WorkflowNotFoundError):
            get_workflow_info("invalid_run_id")
```

#### 测试工具函数

```python
# tests/test_tools.py

import pytest
from tools.statistical import statistical_analysis
from PIL import Image

class TestTools:
    """工具函数测试套件"""

    def test_statistical_analysis(self):
        """测试统计分析工具"""
        parameters = {
            "data_path": "tests/data/test.csv",
            "method": "t-test"
        }

        result = statistical_analysis(parameters)

        assert "message" in result
        assert "result" in result
        assert "files" in result["result"]
        assert "images" in result["result"]
        assert isinstance(result["result"]["images"][0], Image.Image)

    def test_missing_parameters(self):
        """测试缺失参数"""
        with pytest.raises(InvalidParameterError):
            statistical_analysis({})

    def test_invalid_data_path(self):
        """测试无效数据路径"""
        with pytest.raises(FileNotFoundError):
            statistical_analysis({"data_path": "nonexistent.csv"})
```

### 11.5 性能优化

#### 使用缓存

```python
from functools import lru_cache
import hashlib
import pickle

def cache_result(cache_file: str):
    """结果缓存装饰器"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # 生成缓存键
            key = hashlib.md5(pickle.dumps((args, kwargs))).hexdigest()
            cache_path = Path(cache_file) / f"{key}.pkl"

            # 检查缓存
            if cache_path.exists():
                with open(cache_path, 'rb') as f:
                    return pickle.load(f)

            # 执行函数
            result = func(*args, **kwargs)

            # 保存结果
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            with open(cache_path, 'wb') as f:
                pickle.dump(result, f)

            return result
        return wrapper
    return decorator

# 使用示例
@cache_result("cache/tool_results")
def expensive_computation(parameters: dict) -> dict:
    """耗时的计算"""
    # ... 复杂计算 ...
    pass
```

#### 批量处理

```python
def batch_process_tool_calls(tools: list, parameters: dict) -> list:
    """批量调用工具"""

    from concurrent.futures import ThreadPoolExecutor

    def call_tool(tool_name, params):
        tool_func = TOOL_FUNCTIONS.get(tool_name)
        if tool_func:
            return tool_name, tool_func(params)
        return tool_name, None

    results = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(call_tool, tool_name, parameters): tool_name
            for tool_name in tools
        }

        for future in futures:
            tool_name, result = future.result()
            results[tool_name] = result

    return results
```

---

## 12. 故障排查

### 12.1 常见问题及解决方案

#### 问题 1：模块导入错误

**错误信息：**
```
ModuleNotFoundError: No module named 'gradio'
```

**解决方案：**
```bash
# 确认虚拟环境已激活
source venv/bin/activate

# 重新安装依赖
pip install -r requirements.txt

# 验证安装
python -c "import gradio; print(gradio.__version__)"
```

#### 问题 2：工作流状态丢失

**症状：** 系统重启后，之前的工作流无法恢复

**解决方案：**
```python
# 使用持久化管理器
from core.state_manager import PersistentWorkflowManager

workflow_manager = PersistentWorkflowManager()

# 启动时恢复中断的工作流
count = workflow_manager.load_interrupted_workflows()
print(f"恢复了 {count} 个中断的工作流")
```

#### 问题 3：图片无法显示

**症状：** Gallery 组件显示空白或错误

**可能原因：**
1. PIL.Image 对象格式错误
2. 图片尺寸过大
3. 颜色模式不支持

**解决方案：**
```python
def normalize_image(img: Image.Image) -> Image.Image:
    """标准化图片对象"""

    # 转换颜色模式
    if img.mode not in ['RGB', 'RGBA']:
        img = img.convert('RGB')

    # 调整大小（如果太大）
    max_size = (2000, 2000)
    if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
        img.thumbnail(max_size, Image.Resampling.LANCZOS)

    return img

# 在工具函数中使用
def my_tool(parameters: dict) -> dict:
    # ...
    normalized_images = [normalize_image(img) for img in images]

    return {
        "message": "完成",
        "result": {
            "files": files,
            "images": normalized_images
        }
    }
```

#### 问题 4：内存占用过高

**症状：** 长时间运行后内存占用持续增长

**解决方案：**
```python
import gc

def cleanup_old_workflows(max_age_hours=24):
    """清理旧工作流"""
    from datetime import datetime, timedelta

    now = datetime.now()
    cutoff = now - timedelta(hours=max_age_hours)

    expired_runs = []
    for run_id, state in workflow_manager.active_workflows.items():
        created = datetime.fromisoformat(state.get('created_at', now.isoformat()))
        if created < cutoff:
            expired_runs.append(run_id)

    for run_id in expired_runs:
        # 清理对话历史
        if run_id in workflow_manager.conversation_history:
            del workflow_manager.conversation_history[run_id]

        # 清理工作流状态
        del workflow_manager.active_workflows[run_id]

    # 强制垃圾回收
    gc.collect()

    return len(expired_runs)

# 定时清理
import schedule
schedule.every(1).hours.do(cleanup_old_workflows)
```

#### 问题 5：Gradio 界面无响应

**症状：** 提交后长时间没有响应

**解决方案：**
```python
# 使用异步处理
import asyncio

async def async_process_user_message(user_input: str, history: list):
    """异步处理消息"""

    # 在后台线程中执行耗时操作
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,  # 使用默认执行器
        process_user_message,
        user_input,
        history
    )

    return result

# 在 Gradio 中使用
demo = gr.Interface(
    fn=async_process_user_message,
    inputs=[gr.Textbox(), gr.Chatbot()],
    outputs=[gr.Chatbot(), gr.Gallery()]
)
```

### 12.2 调试技巧

#### 启用详细日志

```python
import logging

# 启用调试日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('debug.log'),
        logging.StreamHandler()
    ]
)

# 在代码中添加调试信息
logger.debug(f"处理用户输入: {user_input}")
logger.debug(f"工作流状态: {workflow_info}")
logger.debug(f"工具输出: {tool_output}")
```

#### 使用断点调试

```python
# 在代码中插入断点
def start_workflow(user_input: str) -> str:
    run_id = create_workflow(user_input)

    # 在这里暂停执行，进入调试模式
    breakpoint()

    # 检查变量
    print(f"run_id = {run_id}")
    print(f"locals() = {locals()}")

    return run_id
```

#### 性能分析

```python
import cProfile
import pstats

def profile_workflow():
    """性能分析"""

    profiler = cProfile.Profile()
    profiler.enable()

    # 执行工作流
    run_id = start_workflow("分析销售数据")
    info = get_workflow_info(run_id)

    profiler.disable()

    # 打印统计信息
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(10)  # 显示前10个最耗时的函数

# 运行分析
profile_workflow()
```

### 12.3 健康检查

```python
def health_check() -> dict:
    """系统健康检查"""

    status = {
        "status": "healthy",
        "checks": {}
    }

    # 检查磁盘空间
    import shutil
    disk_usage = shutil.disk_usage("/")
    free_percent = (disk_usage.free / disk_usage.total) * 100
    status["checks"]["disk"] = {
        "status": "ok" if free_percent > 10 else "warning",
        "free_percent": free_percent
    }

    # 检查内存使用
    import psutil
    memory = psutil.virtual_memory()
    status["checks"]["memory"] = {
        "status": "ok" if memory.percent < 80 else "warning",
        "used_percent": memory.percent
    }

    # 检查活跃工作流数
    active_count = len(workflow_manager.active_workflows)
    status["checks"]["workflows"] = {
        "status": "ok" if active_count < 100 else "warning",
        "active_count": active_count
    }

    # 总体状态
    if any(check["status"] == "warning" for check in status["checks"].values()):
        status["status"] = "warning"

    return status

# 创建健康检查端点
def create_health_endpoint():
    """创建健康检查界面"""
    return gr.Interface(
        fn=lambda: gr.JSON(value=health_check()),
        inputs=[],
        outputs=[gr.JSON(label="系统状态")],
        title="系统健康检查"
    )
```

---

## 📝 总结

本教程涵盖了工作流对话机器人的完整开发流程：

✅ **基础概念**：工作流、状态机、RunID、对话历史等
✅ **系统架构**：分层设计、数据流、模块关系
✅ **核心组件**：状态管理器、工作流函数、工具函数
✅ **实战教程**：从简单工具到复杂工作流的实现
✅ **高级功能**：并发处理、超时管理、流式输出
✅ **部署指南**：本地、Docker、云服务部署
✅ **最佳实践**：代码组织、错误处理、测试、优化
✅ **故障排查**：常见问题和解决方案

### 下一步

1. 🚀 实现你的实际工作流函数
2. 🔧 添加自定义分析工具
3. 📊 集成真实的数据分析库
4. 🎨 定制界面样式和交互
5. 📈 监控和优化性能

祝你开发顺利！🎉
