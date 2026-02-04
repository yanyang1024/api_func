# 增强型转发服务 - 快速参考

## 一、快速启动

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
# 基本启动
python3 enhanced_proxy_server.py \
    --target-host 192.168.1.100 \
    --target-port 8000 \
    --listen-port 8080

# 使用启动脚本（推荐）
./start_enhanced_proxy.sh --target-host 192.168.1.100
```

### 3. 验证服务
```bash
curl http://localhost:8080/
```

## 二、API端点

### 1. 转发请求
```bash
curl -X POST http://localhost:8080/api/function1 \
  -H "Content-Type: application/json" \
  -d '{"param1": "value1", "param2": "value2", ...}'
```

**返回：**
```json
{
  "success": true,
  "task_id": "uuid",
  "status": "pending",
  "message": "任务已创建",
  "data": {"task_id": "uuid", "status_url": "/task/uuid"}
}
```

### 2. 查询任务状态
```bash
curl http://localhost:8080/task/{task_id}
```

**返回状态：**
- `pending` - 等待中
- `processing` - 处理中
- `completed` - 已完成
- `failed` - 失败

### 3. 服务统计
```bash
curl http://localhost:8080/stats
```

### 4. 列出所有任务
```bash
curl http://localhost:8080/tasks
curl http://localhost:8080/tasks?status=completed
```

### 5. 清理旧任务
```bash
curl -X DELETE http://localhost:8080/tasks/cleanup?max_age_hours=24
```

## 三、配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--target-host` | 必需 | 目标服务器IP |
| `--target-port` | 8000 | 目标服务器端口 |
| `--listen-port` | 8080 | 监听端口 |
| `--max-concurrent` | 10 | 最大并发数 |
| `--max-queue-size` | 100 | 队列大小 |
| `--num-workers` | 5 | 工作线程数 |

## 四、客户端使用

### Python客户端（同步）
```python
from enhanced_client_example import EnhancedProxyClient

client = EnhancedProxyClient("http://localhost:8080")

# 提交任务
task_id = client.submit_task("api/function1", {
    "param1": "value1",
    "param2": "value2",
    "param3": 100
})

# 等待完成
result = client.wait_for_task(task_id, poll_interval=5)

# 查看结果
print(result)
```

### 命令行客户端
```bash
# 运行演示
python3 enhanced_client_example.py --demo all

# 查看统计
python3 enhanced_client_example.py --stats

# 查询任务
python3 enhanced_client_example.py --task-id {uuid} --wait

# 列出任务
python3 enhanced_client_example.py --list-tasks
```

## 五、长任务处理

### 自动识别长任务
- 任务执行时间 > 5分钟自动标记为长任务
- 长任务不会被中断，会在后台继续执行
- 通过任务ID可随时查询状态

### 轮询策略
```python
# 短任务（< 1分钟）
client.wait_for_task(task_id, poll_interval=2)

# 中等任务（1-5分钟）
client.wait_for_task(task_id, poll_interval=5)

# 长任务（> 5分钟）
client.wait_for_task(task_id, poll_interval=10)
```

## 六、性能调优

### 高并发场景
```bash
./start_enhanced_proxy.sh \
    --target-host 192.168.1.100 \
    --max-concurrent 50 \
    --max-queue-size 500 \
    --num-workers 20
```

### 低配置服务器
```bash
./start_enhanced_proxy.sh \
    --target-host 192.168.1.100 \
    --max-concurrent 5 \
    --max-queue-size 50 \
    --num-workers 3
```

## 七、监控和维护

### 实时监控
```bash
# 每分钟查看统计
watch -n 60 'curl -s http://localhost:8080/stats | jq'
```

### 定期清理
```bash
# 每天凌晨3点清理
0 3 * * * curl -X DELETE "http://localhost:8080/tasks/cleanup?max_age_hours=24"
```

### 健康检查
```bash
curl http://localhost:8080/health
```

## 八、故障排查

### 问题：任务一直pending
**解决：** 增加工作线程数 `--num-workers`

### 问题：队列已满（503错误）
**解决：** 增加队列大小 `--max-queue-size`

### 问题：任务失败
**排查：**
1. 查询任务状态获取错误信息
2. 检查目标服务器是否正常
3. 查看服务日志

## 九、文件清单

| 文件 | 说明 |
|------|------|
| `enhanced_proxy_server.py` | 增强型转发服务主程序 |
| `enhanced_client_example.py` | Python客户端示例 |
| `start_enhanced_proxy.sh` | 启动脚本 |
| `test_enhanced_proxy.sh` | 测试脚本 |
| `ENHANCED_PROXY_README.md` | 完整使用文档 |
| `requirements.txt` | 依赖列表 |

## 十、对比总结

| 特性 | 原版 | 增强版 |
|------|------|--------|
| 并发模型 | 同步 | 异步 |
| 队列管理 | ❌ | ✅ |
| 长任务支持 | ❌ | ✅ |
| 状态查询 | ❌ | ✅ |
| 统计信息 | ❌ | ✅ |
| 适用场景 | 简单转发 | 高并发+长任务 |
