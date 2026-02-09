# 智能对话工作流系统 - 简化版

基于Gradio的智能对话Web应用，代码简洁，易于二次开发。

## ✨ 特性

- ✅ **简洁代码**: 核心代码仅485行，易于理解和修改
- ✅ **异步处理**: 不阻塞UI的长时间工作流处理
- ✅ **会话管理**: 完整的对话历史和会话管理
- ✅ **状态管理**: 支持工作流中断/重启/完成/失败
- ✅ **易于集成**: 清晰的接口，方便替换实际工作流服务

## 📁 项目结构

```
chat_gr_service/
├── app.py                  # 主应用 (228行)
├── workflow_mock.py        # 工作流服务 (70行) - 需替换
├── session_manager.py      # 会话管理 (84行)
├── async_processor.py      # 异步处理 (103行)
├── test_app.py            # 测试脚本
└── requirements.txt       # 依赖
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 测试运行

```bash
python test_app.py
```

### 3. 启动应用

```bash
python app.py
```

访问: `http://localhost:7860`

## 💻 核心代码结构

### app.py - 业务逻辑（独立函数）

```python
# 核心业务函数
async def workflow_callback(session_id, result):
    """工作流状态回调"""
    pass

def process_user_input(user_message, history):
    """处理用户输入"""
    pass

def format_history(messages):
    """格式化消息历史"""
    pass

def refresh_ui():
    """刷新UI"""
    pass

# UI构建
def build_ui():
    """构建Gradio界面"""
    pass

# 启动
def main():
    app = build_ui()
    app.launch(server_name="0.0.0.0", server_port=7860)
```

**优势**:
- 业务逻辑与UI分离
- 函数独立，易于测试
- 清晰的代码结构

### workflow_mock.py - 工作流服务接口

```python
class WorkflowService:
    def start_workflow(self, user_input: str) -> str:
        """启动工作流，返回runID"""
        pass

    def get_workflow_info(self, run_id: str) -> Dict:
        """查询工作流状态
        返回: {
            "status": "interrupt" | "success" | "fail",
            "message": str,
            "visualization_url": str | None
        }
        """
        pass

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        """重启中断的工作流，返回新runID"""
        pass
```

**集成实际服务**: 替换这三个方法即可

### session_manager.py - 会话管理

```python
@dataclass
class Session:
    session_id: str
    messages: List[Message]
    current_run_id: Optional[str]
    waiting_for_input: bool

class SessionManager:
    def create_session(self) -> Session
    def get_session(self, session_id) -> Session
    def get_all_sessions(self) -> List[Session]
```

### async_processor.py - 异步处理

```python
class AsyncProcessor:
    def submit_task(self, session_id, run_id, callback) -> str:
        """提交异步任务"""
        pass

    def get_task_status(self, task_id) -> Dict:
        """查询任务状态"""
        pass
```

## 🔄 工作流程

```
用户输入 → process_user_input()
    ↓
启动工作流 → 获取runID
    ↓
提交异步任务 → async_processor.submit_task()
    ↓
[异步处理中...] (2秒模拟延迟)
    ↓
workflow_callback() 回调
    ↓
更新会话消息
    ↓
用户点击"刷新" → refresh_ui() → 显示最新结果
```

## 📝 替换实际工作流服务

### 步骤1: 修改 workflow_mock.py

```python
import requests

class WorkflowService:
    BASE_URL = "https://your-api.com/workflow"

    def start_workflow(self, user_input: str) -> str:
        response = requests.post(
            f"{self.BASE_URL}/start",
            json={"input": user_input}
        )
        return response.json()["run_id"]

    def get_workflow_info(self, run_id: str) -> Dict:
        response = requests.get(f"{self.BASE_URL}/status/{run_id}")
        data = response.json()

        # 状态映射
        status_map = {
            "WAITING": "interrupt",
            "COMPLETED": "success",
            "FAILED": "fail"
        }

        return {
            "run_id": run_id,
            "status": status_map.get(data["status"], "fail"),
            "message": data.get("message"),
            "visualization_url": data.get("chart_url")
        }

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        response = requests.post(
            f"{self.BASE_URL}/restart",
            json={"run_id": run_id, "input": user_input}
        )
        return response.json()["new_run_id"]
```

### 步骤2: 测试

```bash
python test_app.py
```

### 步骤3: 启动应用

```bash
python app.py
```

## 🎯 二次开发要点

### 1. 修改UI布局

编辑 `app.py` 中的 `build_ui()` 函数:

```python
def build_ui():
    with gr.Blocks() as app:
        # 修改UI组件
        chatbot = gr.Chatbot(label="对话历史", height=500)
        # ... 添加更多组件
    return app
```

### 2. 添加新功能

在 `app.py` 中添加新函数:

```python
def my_new_feature(input_data):
    """新功能"""
    # 处理逻辑
    return result

# 在build_ui()中绑定
new_btn.click(fn=my_new_feature, inputs=[...], outputs=[...])
```

### 3. 修改会话逻辑

编辑 `session_manager.py` 中的 `Session` 类:

```python
@dataclass
class Session:
    # 添加新字段
    custom_field: str = ""

    # 添加新方法
    def custom_method(self):
        pass
```

### 4. 调整异步处理

编辑 `async_processor.py` 中的 `_run_task()` 方法:

```python
async def _run_task(self, task_id, session_id, run_id, callback):
    # 修改处理逻辑
    await asyncio.sleep(5)  # 调整等待时间
    # ... 自定义逻辑
```

## 📊 测试覆盖

```bash
$ python test_app.py

✅ 工作流服务测试通过
✅ 会话管理器测试通过
✅ 异步处理器测试通过
✅ 集成测试通过

🎉 所有测试通过！
```

## ⚙️ 配置

在 `app.py` 的 `main()` 函数中修改:

```python
def main():
    app = build_ui()
    app.launch(
        server_name="0.0.0.0",  # 服务器地址
        server_port=7860,        # 端口
        share=False,             # 是否创建公网链接
        show_error=True          # 显示错误信息
    )
```

## 🔍 代码对比

### 简化前 vs 简化后

| 文件 | 原始行数 | 简化后 | 减少 |
|------|---------|--------|------|
| app.py | ~430行 | 228行 | 47% |
| async_processor.py | ~180行 | 103行 | 43% |
| session_manager.py | ~130行 | 84行 | 35% |
| workflow_mock.py | ~110行 | 70行 | 36% |
| **总计** | ~850行 | **485行** | **43%** |

### 简化优化

1. **移除冗余**: 删除不必要的类和方法
2. **函数化**: 将类方法改为独立函数，更清晰
3. **合并逻辑**: 简化条件判断和状态处理
4. **减少注释**: 保留关键注释，删除冗余说明
5. **统一风格**: 统一代码风格和命名

## 🐛 常见问题

### Q: Gradio load报错
**A**: 已修复，`app.load()` 现在在 `gr.Blocks` 上下文内

### Q: 如何调整工作流超时时间？
**A**: 编辑 `async_processor.py` 第37行:
```python
await asyncio.sleep(5)  # 修改为实际轮询逻辑
```

### Q: 如何添加数据库存储？
**A**: 在 `session_manager.py` 中添加持久化方法:
```python
def save_to_db(self, session):
    # 保存到数据库
    pass
```

### Q: 如何支持多用户？
**A**: 添加用户认证字段:
```python
@dataclass
class Session:
    user_id: str  # 添加用户ID
    # ...
```

## 📚 相关文档

- `QUICKSTART.md` - 快速开始
- `INTEGRATION_GUIDE.md` - 集成实际服务
- `PROJECT_OVERVIEW.md` - 架构说明

## 🎉 优势总结

1. **代码简洁**: 从850行减少到485行（-43%）
2. **结构清晰**: 业务逻辑与UI分离
3. **易于修改**: 函数化设计，便于二次开发
4. **完整测试**: 包含完整的测试套件
5. **开箱即用**: 包含模拟服务，可直接运行
6. **文档完善**: 详细的集成指南和示例

## License

MIT License
