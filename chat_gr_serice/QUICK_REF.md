# 快速参考卡

## 🚀 一分钟启动

```bash
pip install -r requirements.txt
python app.py
# 访问 http://localhost:7860
```

## 📝 代码结构速览

```
app.py (228行)
├── workflow_callback()      # 工作流回调
├── process_user_input()     # 处理用户输入 ⭐
├── format_history()         # 格式化历史
├── refresh_ui()            # 刷新UI
├── clear_chat()            # 清空对话
├── create_new_session()    # 创建会话
├── build_ui()              # 构建界面 ⭐
└── main()                  # 启动函数 ⭐
```

## 🔧 快速修改

### 修改端口 (app.py:220)

```python
app.launch(server_port=8080)  # 改为8080
```

### 添加新按钮 (app.py:158)

```python
my_btn = gr.Button("我的按钮")
my_btn.click(fn=my_function, inputs=[...], outputs=[...])
```

### 修改工作流服务 (workflow_mock.py:23-65)

```python
def start_workflow(self, user_input: str) -> str:
    # 调用实际API
    return actual_api.start(input=user_input)

def get_workflow_info(self, run_id: str) -> Dict:
    # 查询实际状态
    return actual_api.get_status(run_id)

def restart_workflow(self, user_input: str, run_id: str) -> str:
    # 重启实际工作流
    return actual_api.restart(run_id, user_input)
```

### 添加新字段到会话 (session_manager.py:19-31)

```python
@dataclass
class Session:
    my_custom_field: str = ""  # 添加字段
```

## 📊 数据流

```
用户输入
  → process_user_input()
    → workflow_service.start_workflow()
    → async_processor.submit_task()
      [异步处理]
      → workflow_callback()
        → session.add_message()
  → 用户点击"刷新"
  → refresh_ui()
  → 显示结果
```

## 🧪 测试

```bash
# 完整测试
python test_app.py

# 只测试工作流
python -c "from workflow_mock import workflow_service; print(workflow_service.start_workflow('test'))"

# 只测试UI构建
python -c "from app import build_ui; print('UI build OK')"
```

## 💡 常用命令

```bash
# 检查语法
python -m py_compile app.py

# 运行应用
python app.py

# 测试模式
python test_app.py

# 安装依赖
pip install -r requirements.txt
```

## 🎯 工作流状态

- `interrupt` - 中断，需用户输入
- `success` - 成功，返回结果
- `fail` - 失败，返回错误

## 📁 文件说明

| 文件 | 行数 | 作用 |
|------|------|------|
| app.py | 228 | 主应用，UI和业务逻辑 |
| workflow_mock.py | 70 | 工作流服务（需替换） |
| session_manager.py | 84 | 会话管理 |
| async_processor.py | 103 | 异步任务处理 |

## 🔗 调用示例

```python
# 启动工作流
run_id = workflow_service.start_workflow("分析数据")

# 提交异步任务
task_id = async_processor.submit_task(
    session_id="session_xxx",
    run_id=run_id,
    status_callback=callback_fn
)

# 创建会话
session = session_manager.create_session()

# 添加消息
session.add_message("user", "Hello")
session.add_message("assistant", "Hi", visualization_url="http://...")
```

## ⚙️ 配置项

```python
# 服务器
server_name="0.0.0.0"     # 监听地址
server_port=7860          # 端口
share=False               # 公网链接

# 异步处理
max_workers=10            # 并发数
sleep_time=2              # 模拟延迟(秒)

# 会话
自动清理：无限制
手动清理：session_manager.delete_session(id)
```

## 🐛 调试技巧

```python
# 打印日志
print(f"[Debug] session_id={session.session_id}")

# 查看会话
sessions = session_manager.get_all_sessions()
print(f"会话数: {len(sessions)}")

# 查看任务
task = async_processor.get_task_status(task_id)
print(f"任务状态: {task['completed']}")
```

## 📞 获取帮助

- 测试问题: `python test_app.py`
- 语法检查: `python -m py_compile app.py`
- 查看日志: 控制台输出 `[Workflow]`, `[AsyncProcessor]` 等

## ✅ 检查清单

启动前确认：
- [ ] 已安装依赖 `pip install -r requirements.txt`
- [ ] 所有文件语法正确 `python -m py_compile *.py`
- [ ] 测试通过 `python test_app.py`
- [ ] 端口未被占用 `lsof -i :7860`

## 🎨 UI定制

```python
# 修改高度
chatbot = gr.Chatbot(height=600)

# 修改主题
gr.Blocks(theme=gr.themes.Soft())
gr.Blocks(theme=gr.themes.Dark())
gr.Blocks(theme=gr.themes.Default())

# 修改颜色
gr.Button("发送", variant="primary")  # 蓝色
gr.Button("取消", variant="secondary")  # 灰色
gr.Button("停止", variant="stop")  # 红色
```

---

**提示**: 所有修改后请运行 `python test_app.py` 验证！
