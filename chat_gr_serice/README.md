# 智能对话工作流系统

基于Gradio的智能对话Web应用，支持异步工作流处理和会话管理。

## 功能特性

- ✅ 完整的对话交互界面
- ✅ 会话管理（创建、删除、清理）
- ✅ 异步任务处理系统
- ✅ 工作流状态跟踪
- ✅ 中断/重启工作流机制
- ✅ 可视化链接展示
- ✅ 线程安全的并发处理

## 项目结构

```
chat_gr_service/
├── app.py                    # 主应用程序（Gradio界面）
├── workflow_mock.py          # 工作流服务模拟（替换为实际服务）
├── session_manager.py        # 会话管理器
├── async_processor.py        # 异步任务处理器
├── requirements.txt          # 依赖清单
└── README.md                 # 项目说明
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行应用

```bash
python app.py
```

应用将在 `http://0.0.0.0:7860` 启动

### 3. 使用说明

1. 打开浏览器访问应用地址
2. 在输入框中输入您的问题
3. 点击"发送"或按回车键提交
4. 等待工作流处理（2秒模拟延迟）
5. 查看助手的回复和参考信息
6. 如果需要补充信息，工作流会中断并等待您的输入
7. 点击"刷新状态"按钮可查看最新状态

## 工作流程

```
用户输入 → 启动工作流 → 获取runID → 异步处理工作流
                                    ↓
                            ┌────────┼────────┐
                            ↓        ↓        ↓
                        中断      成功      失败
                            ↓        ↓        ↓
                      需要补充    显示      显示
                      用户输入    结果      错误
                            ↓
                      用户补充输入
                            ↓
                      重启工作流
```

## 替换实际工作流服务

在 `workflow_mock.py` 中，将以下模拟函数替换为您的实际实现：

```python
# 1. 启动工作流
def start_workflow(self, user_input: str) -> str:
    # 替换为实际的启动逻辑
    pass

# 2. 查询工作流信息
def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
    # 替换为实际的查询逻辑
    pass

# 3. 重启工作流
def restart_workflow(self, user_input: str, run_id: str) -> str:
    # 替换为实际的重启逻辑
    pass
```

## 配置说明

### 修改端口

在 `app.py` 的 `main()` 函数中：

```python
app.launch(
    server_name="0.0.0.0",
    server_port=7860,  # 修改为其他端口
    share=False
)
```

### 调整并发数

在 `async_processor.py` 中：

```python
# 修改 max_workers 参数
async_processor = AsyncProcessor(max_workers=10)  # 默认10个并发
```

### 会话超时设置

在 `session_manager.py` 中：

```python
# 清理超过24小时的会话
session_manager.cleanup_old_sessions(max_age_hours=24)
```

## API说明

### 会话管理

```python
from session_manager import session_manager

# 创建会话
session = session_manager.create_session()

# 获取会话
session = session_manager.get_session(session_id)

# 删除会话
session_manager.delete_session(session_id)
```

### 异步任务

```python
from async_processor import async_processor

# 提交任务
task_id = async_processor.submit_task(
    session_id=session_id,
    run_id=run_id,
    status_callback=callback_function
)

# 查询任务状态
status = async_processor.get_task_status(task_id)
```

## 技术栈

- **前端框架**: Gradio 4.0+
- **异步处理**: asyncio + threading
- **状态管理**: 自定义会话管理器
- **并发控制**: ThreadPoolExecutor

## 注意事项

1. **线程安全**: 所有关键操作都使用锁保护
2. **内存管理**: 定期清理旧会话和已完成任务
3. **错误处理**: 完整的异常捕获和用户友好提示
4. **扩展性**: 模块化设计，易于扩展新功能

## 后续改进方向

- [ ] 添加用户认证
- [ ] 持久化会话到数据库
- [ ] 支持多用户并发
- [ ] 添加WebSocket实时推送
- [ ] 完善日志系统
- [ ] 添加监控和指标

## 故障排查

### 问题1: 端口被占用
```bash
# 查找占用端口的进程
lsof -i :7860
# 杀死进程
kill -9 <PID>
```

### 问题2: 依赖安装失败
```bash
# 使用国内镜像源
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 问题3: 工作流无响应
- 检查 `workflow_mock.py` 中的模拟函数
- 查看控制台日志输出
- 点击"刷新状态"按钮

## 许可证

MIT License
