# 工作流对话机器人使用说明

## 📋 概述

这是一个基于 Gradio 的对话界面，用于与工作流智能体进行多轮交互。系统支持：
- 启动工作流并跟踪状态
- 处理工作流中断和恢复
- 执行数据分析工具
- 展示可视化和结果文件

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行程序

```bash
python workflow_chatbot.py
```

启动后访问：`http://localhost:7860`

## 🔧 替换为你的实际实现

代码中有以下模拟函数需要替换为你的实际实现：

### 核心工作流函数

```python
def start_workflow(user_input: str) -> str:
    """
    启动工作流
    参数: user_input - 用户自然语言字符串
    返回: run_id - 工作流运行ID
    """
    # TODO: 替换为你的实现
    pass
```

```python
def get_workflow_info(run_id: str) -> Dict:
    """
    通过runID访问工作流信息
    参数: run_id - 工作流运行ID
    返回: {
        "status": "interrupted" | "completed",
        "message": "状态消息",
        "data": {
            "parameters": {...},  # 解析出的参数
            "tools": [...]       # 需要调用的工具列表
        }
    }
    """
    # TODO: 替换为你的实现
    pass
```

```python
def resume_workflow(user_input: str, run_id: str) -> str:
    """
    重启中断的工作流
    参数:
        user_input - 用户自然语言字符串
        run_id - 工作流运行ID
    返回: run_id (可能相同或更新)
    """
    # TODO: 替换为你的实现
    pass
```

### 分析工具函数

你的工具函数应该返回以下格式：

```python
def your_tool_function(parameters: dict) -> Dict:
    """
    参数: parameters - 从工作流解析的参数字典
    返回: {
        "message": "处理完成消息",
        "result": {
            "files": ["path/to/file1", "path/to/file2", ...],
            "images": [PIL_Image1, PIL_Image2, ...]
        }
    }
    """
    # 你的实现逻辑
    pass
```

### 添加新的工具函数

在 `TOOL_FUNCTIONS` 字典中注册你的工具：

```python
TOOL_FUNCTIONS = {
    "inline_compare": tool_inline_compare,
    "statistical_analysis": tool_statistical_analysis,
    "trend_analysis": tool_trend_analysis,
    "correlation_analysis": tool_correlation_analysis,
    "your_tool_name": your_tool_function,  # 添加你的工具
}
```

## 📊 工作流程

### 完整的对话流程

1. **用户输入** → 启动工作流
   - 调用 `start_workflow(user_input)` 获取 `run_id`
   - 调用 `get_workflow_info(run_id)` 获取状态

2. **状态：中断 (interrupted)**
   - 显示需要更多信息
   - 等待用户第二轮输入
   - 调用 `resume_workflow(user_input, run_id)` 恢复

3. **状态：完成 (completed)**
   - 提取解析的参数
   - 调用相应的工具函数
   - 格式化结果并展示

### 结果展示

完成状态下，系统会：
- ✅ 显示工具执行消息
- 📊 在 Gallery 中展示生成的图片（PIL.Image 对象）
- 📁 在 File 组件中提供生成的文件下载
- 💬 显示对话历史和轮次统计

## 🎨 界面功能

### 主界面组件

- **对话区域**：显示用户与工作流的历史对话
- **消息输入**：支持多行输入的自然语言文本框
- **结果画廊**：展示所有生成的可视化图表
- **文件下载**：提供生成的数据文件下载
- **状态信息**：显示活跃工作流和对话统计

### 示例问题

点击示例问题可快速开始：
- 数据集对比分析
- 统计分析
- 趋势分析
- 相关性分析

## 📝 数据结构

### 工作流状态信息

```python
{
    "run_id": "run_20240126_143000",
    "status": "completed",  # 或 "interrupted"
    "message": "工作流执行成功",
    "data": {
        "parameters": {
            "dataset1": "A",
            "dataset2": "B",
            "method": "t-test"
        },
        "tools": ["inline_compare", "statistical_analysis"]
    }
}
```

### 工具输出格式

```python
{
    "message": "Inline compare Processing completed!",
    "result": {
        "files": [
            "outputs/compare_result.pptx",
            "outputs/test_results.csv",
            "outputs/raw_data.csv"
        ],
        "images": [
            <PIL.PngImagePlugin.PngImageFile image mode=RGBA size=2000x1000>,
            <PIL.PngImagePlugin.PngImageFile image mode=RGBA size=1500x800>
        ]
    }
}
```

## 🔍 自定义配置

### 修改服务器配置

在 `workflow_chatbot.py` 底部修改：

```python
app.launch(
    server_name="0.0.0.0",  # 监听地址
    server_port=7860,        # 端口号
    share=False,             # 是否创建公共链接
    show_error=True,
    quiet=False
)
```

### 调整界面样式

修改 `custom_css` 变量来自定义样式。

## 🐛 调试技巧

1. **查看日志**：所有函数调用都会在控制台输出日志
2. **状态面板**：点击"状态信息"折叠面板查看活跃工作流
3. **模拟数据**：在开发阶段可以使用模拟函数测试界面

## 📚 扩展功能建议

- 添加对话导出功能（导出为 Markdown 或 PDF）
- 支持工作流状态持久化（保存到数据库）
- 添加更多数据分析工具
- 支持批量文件上传
- 添加工作流执行进度条

## ❓ 常见问题

**Q: 如何添加新的分析工具？**
A: 在 `TOOL_FUNCTIONS` 字典中注册你的函数，确保返回正确的格式。

**Q: 工作流状态如何保持？**
A: 使用 `WorkflowStateManager` 类管理，所有状态保存在内存中。重启后状态会清空。

**Q: 支持并发用户吗？**
A: 当前版本使用全局状态管理，不支持多用户隔离。如需支持，需要添加用户会话管理。

**Q: 图片无法显示怎么办？**
A: 确保返回的是 PIL.Image 对象，并且图片格式正确（RGBA/RGB）。

## 📞 技术支持

如有问题，请检查：
1. 模拟函数是否已替换为实际实现
2. 工作流返回的数据格式是否正确
3. 控制台日志中的错误信息
