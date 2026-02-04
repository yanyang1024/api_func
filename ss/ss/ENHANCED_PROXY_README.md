# 增强型转发服务使用指南

## 概述

增强型转发服务（`enhanced_proxy_server.py`）在原有转发功能基础上，新增以下高级特性：

1. **异步请求处理** - 使用 async/await 提升并发性能
2. **请求队列管理** - 有序维护高并发请求，避免服务器过载
3. **长任务状态跟踪** - 自动识别超过5分钟的长任务
4. **任务ID查询接口** - 实时查询任务执行状态和结果

## 与原版对比

| 特性 | 原版 (proxy_server.py) | 增强版 (enhanced_proxy_server.py) |
|------|------------------------|----------------------------------|
| 并发模型 | 同步阻塞 | 异步非阻塞 |
| 队列管理 | 无 | 有（可配置队列大小） |
| 长任务处理 | 超时断开 | 异步执行 + 状态跟踪 |
| 任务状态查询 | 不支持 | 支持（通过task_id） |
| 并发控制 | 无限制 | 可配置（默认10） |
| 统计信息 | 无 | 详细的统计API |

## 安装依赖

```bash
pip install -r requirements.txt
```

新增依赖：
- `httpx==0.25.2` - 异步HTTP客户端

## 快速启动

### 基本用法

```bash
# 启动增强型转发服务
python3 enhanced_proxy_server.py \
    --target-host 192.168.1.100 \
    --target-port 8000 \
    --listen-port 8080
```

### 自定义并发参数

```bash
# 高并发场景配置
python3 enhanced_proxy_server.py \
    --target-host 192.168.1.100 \
    --target-port 8000 \
    --listen-port 8080 \
    --max-concurrent 20 \
    --max-queue-size 200 \
    --num-workers 10
```

### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--target-host` | 必需 | 目标服务器IP地址（C服务器） |
| `--target-port` | 8000 | 目标服务器端口 |
| `--listen-host` | 0.0.0.0 | 监听地址 |
| `--listen-port` | 8080 | 监听端口 |
| `--max-concurrent` | 10 | 最大并发任务数 |
| `--max-queue-size` | 100 | 最大队列大小 |
| `--num-workers` | 5 | 后台工作线程数 |

## API使用指南

### 1. 转发请求（创建任务）

**请求：**
```bash
curl -X POST http://localhost:8080/api/function1 \
  -H "Content-Type: application/json" \
  -d '{
    "param1": "value1",
    "param2": "value2",
    "param3": 100,
    "param4": "value4",
    "param5": 200
  }'
```

**响应（立即返回）：**
```json
{
  "success": true,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "pending",
  "message": "任务已创建，ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890。请使用 /task/{task_id} 查询状态。",
  "data": {
    "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "status_url": "/task/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### 2. 查询任务状态

**请求：**
```bash
curl http://localhost:8080/task/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**响应（任务进行中）：**
```json
{
  "success": true,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "processing",
  "message": "任务正在processing中，请稍后查询",
  "data": {
    "is_long_task": true,
    "created_at": "2026-02-04T18:30:00.123456",
    "updated_at": "2026-02-04T18:35:00.789012"
  }
}
```

**响应（任务完成）：**
```json
{
  "success": true,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "message": "任务执行完成",
  "result": {
    "message": "Processing completed!",
    "files": [],
    "images": []
  },
  "data": {
    "is_long_task": true,
    "created_at": "2026-02-04T18:30:00.123456",
    "updated_at": "2026-02-04T18:35:30.456789"
  }
}
```

**响应（任务失败）：**
```json
{
  "success": false,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "failed",
  "message": "任务执行失败",
  "error": "Connection timeout",
  "data": {
    "created_at": "2026-02-04T18:30:00.123456",
    "updated_at": "2026-02-04T18:31:00.789012"
  }
}
```

### 3. 查看服务统计

**请求：**
```bash
curl http://localhost:8080/stats
```

**响应：**
```json
{
  "total_tasks": 150,
  "completed_tasks": 120,
  "failed_tasks": 5,
  "long_tasks": 25,
  "current_queue_size": 10,
  "max_concurrent": 10,
  "max_queue_size": 100,
  "active_tasks": 8,
  "queue_size": 10
}
```

### 4. 列出所有任务

**请求：**
```bash
# 列出所有任务（最近50个）
curl http://localhost:8080/tasks

# 只列出已完成的任务
curl http://localhost:8080/tasks?status=completed

# 只列出失败的任务
curl http://localhost:8080/tasks?status=failed
```

**响应：**
```json
{
  "count": 3,
  "tasks": [
    {
      "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "status": "completed",
      "created_at": "2026-02-04T18:30:00.123456",
      "updated_at": "2026-02-04T18:35:30.456789",
      "is_long_task": true,
      "result": {...}
    }
  ]
}
```

### 5. 清理旧任务

**请求：**
```bash
# 清理24小时前的已完成/失败任务
curl -X DELETE http://localhost:8080/tasks/cleanup?max_age_hours=24
```

**响应：**
```json
{
  "success": true,
  "message": "已清理 42 个旧任务",
  "removed_count": 42
}
```

## 客户端集成示例

### Python客户端（轮询查询）

```python
import requests
import time
import json

class EnhancedProxyClient:
    """增强型转发服务客户端"""

    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url

    def submit_task(self, api_path: str, data: dict) -> str:
        """
        提交任务到转发服务

        Args:
            api_path: API路径（如 "api/function1"）
            data: 请求数据

        Returns:
            task_id: 任务ID
        """
        url = f"{self.base_url}/{api_path}"
        response = requests.post(url, json=data)
        result = response.json()

        if result.get("success"):
            return result["task_id"]
        else:
            raise Exception(f"提交任务失败: {result.get('error')}")

    def query_task(self, task_id: str, poll: bool = True,
                   poll_interval: int = 5, timeout: int = 600) -> dict:
        """
        查询任务状态

        Args:
            task_id: 任务ID
            poll: 是否轮询等待任务完成
            poll_interval: 轮询间隔（秒）
            timeout: 超时时间（秒）

        Returns:
            任务结果
        """
        url = f"{self.base_url}/task/{task_id}"

        if not poll:
            response = requests.get(url)
            return response.json()

        # 轮询模式
        start_time = time.time()
        while True:
            # 检查超时
            if time.time() - start_time > timeout:
                raise TimeoutError(f"任务查询超时: {task_id}")

            # 查询状态
            response = requests.get(url)
            result = response.json()

            status = result.get("status")

            # 任务完成或失败
            if status in ["completed", "failed"]:
                return result

            # 任务仍在进行中
            print(f"任务状态: {status}，等待 {poll_interval} 秒后重试...")
            time.sleep(poll_interval)

    def get_stats(self) -> dict:
        """获取服务统计信息"""
        url = f"{self.base_url}/stats"
        response = requests.get(url)
        return response.json()


# 使用示例
if __name__ == "__main__":
    # 创建客户端
    client = EnhancedProxyClient("http://localhost:8080")

    # 提交任务
    task_id = client.submit_task("api/function1", {
        "param1": "value1",
        "param2": "value2",
        "param3": 100,
        "param4": "value4",
        "param5": 200
    })

    print(f"任务已提交，ID: {task_id}")

    # 轮询查询任务状态
    result = client.query_task(task_id, poll=True, poll_interval=5)

    if result["success"]:
        print("任务执行成功!")
        print("结果:", json.dumps(result["result"], indent=2, ensure_ascii=False))
    else:
        print("任务执行失败!")
        print("错误:", result["error"])

    # 查看服务统计
    stats = client.get_stats()
    print("\n服务统计:", json.dumps(stats, indent=2))
```

### Python客户端（异步版本）

```python
import httpx
import asyncio
from typing import Optional

class AsyncEnhancedProxyClient:
    """异步增强型转发服务客户端"""

    def __init__(self, base_url: str = "http://localhost:8080"):
        self.base_url = base_url

    async def submit_task(self, api_path: str, data: dict) -> str:
        """提交任务"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/{api_path}"
            response = await client.post(url, json=data)
            result = response.json()

            if result.get("success"):
                return result["task_id"]
            else:
                raise Exception(f"提交任务失败: {result.get('error')}")

    async def query_task(self, task_id: str) -> dict:
        """查询任务状态"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/task/{task_id}"
            response = await client.get(url)
            return response.json()

    async def wait_for_task(self, task_id: str,
                           poll_interval: int = 5,
                           max_attempts: int = 120) -> dict:
        """等待任务完成"""
        for i in range(max_attempts):
            result = await self.query_task(task_id)
            status = result.get("status")

            if status in ["completed", "failed"]:
                return result

            print(f"尝试 {i+1}/{max_attempts}: 任务状态 = {status}")
            await asyncio.sleep(poll_interval)

        raise TimeoutError(f"任务超时: {task_id}")

    async def get_stats(self) -> dict:
        """获取统计信息"""
        async with httpx.AsyncClient() as client:
            url = f"{self.base_url}/stats"
            response = await client.get(url)
            return response.json()


# 使用示例
async def main():
    client = AsyncEnhancedProxyClient("http://localhost:8080")

    # 提交任务
    task_id = await client.submit_task("api/function1", {
        "param1": "value1",
        "param2": "value2",
        "param3": 100,
        "param4": "value4",
        "param5": 200
    })

    print(f"任务已提交，ID: {task_id}")

    # 等待完成
    result = await client.wait_for_task(task_id)

    if result["success"]:
        print("任务执行成功!")
        print("结果:", result["result"])
    else:
        print("任务执行失败!")
        print("错误:", result["error"])


if __name__ == "__main__":
    asyncio.run(main())
```

## 性能优化建议

### 1. 并发配置调整

根据服务器性能调整并发参数：

```bash
# 低配置服务器
--max-concurrent 5 --num-workers 3

# 中等配置服务器（默认）
--max-concurrent 10 --num-workers 5

# 高配置服务器
--max-concurrent 50 --num-workers 20
```

### 2. 队列大小调整

根据请求量调整队列大小：

```bash
# 小规模部署
--max-queue-size 50

# 中等规模部署（默认）
--max-queue-size 100

# 大规模部署
--max-queue-size 500
```

### 3. 客户端轮询策略

根据任务执行时间调整轮询间隔：

```python
# 短任务（< 1分钟）
client.query_task(task_id, poll_interval=2)

# 中等任务（1-5分钟）
client.query_task(task_id, poll_interval=5)

# 长任务（> 5分钟）
client.query_task(task_id, poll_interval=10)
```

## 监控和运维

### 1. 定期查看统计信息

```bash
# 每分钟检查一次
watch -n 60 'curl -s http://localhost:8080/stats | jq'
```

### 2. 定期清理旧任务

建议设置定时任务（crontab）：

```bash
# 每天凌晨3点清理24小时前的旧任务
0 3 * * * curl -X DELETE "http://localhost:8080/tasks/cleanup?max_age_hours=24"
```

### 3. 日志监控

服务启动时会输出详细日志，建议使用日志管理工具（如ELK）收集和分析。

## 故障排查

### 问题1：任务一直处于pending状态

**原因：** 工作线程数不足或目标服务器响应慢

**解决方案：**
- 增加 `--num-workers` 参数
- 增加 `--max-concurrent` 参数
- 检查目标服务器状态

### 问题2：队列已满错误（503）

**原因：** 请求量超过队列容量

**解决方案：**
- 增加 `--max-queue-size` 参数
- 增加工作线程数提升处理速度
- 检查是否有任务执行失败导致积压

### 问题3：任务执行失败

**排查步骤：**
1. 查询任务状态获取错误信息
2. 检查目标服务器是否正常运行
3. 检查网络连接
4. 查看服务日志

## 与原版兼容性

增强版保持与原版API的兼容性：

- 原版直接转发请求，增强版使用异步队列
- 请求路径保持不变：`/api/{path}`
- 响应格式略有不同（增加了task_id和status字段）

如果需要保持与原版完全一致的行为，建议使用原版 `proxy_server.py`。

如果需要高并发和长任务支持，建议使用增强版 `enhanced_proxy_server.py`。

## 总结

增强型转发服务通过以下方式优化了高并发场景：

1. **异步非阻塞** - 大幅提升并发处理能力
2. **请求队列** - 有序维护请求，防止服务器过载
3. **长任务支持** - 自动识别长任务并提供状态查询
4. **实时监控** - 详细的统计信息便于运维

适用于高并发、长任务、需要状态跟踪的场景。
