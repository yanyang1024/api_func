# 转发服务并发控制指南

## 概述

增强版转发服务 (`proxy_server_enhanced.py`) 提供了完整的并发控制机制，解决高负载下的超时问题。

## 核心特性

### 1. 连接池复用
- 复用HTTP连接，避免频繁建立/断开
- 减少TCP握手开销
- 提高吞吐量

### 2. 请求队列管理
- 信号量控制最大并发数
- 队列缓冲超出并发的请求
- 队列满时快速拒绝（保护系统）

### 3. 灵活超时配置
- **连接超时**: 建立连接的最大时间
- **读取超时**: 等待响应的最大时间（可设置为300秒）
- 分离两个超时，更精确控制

### 4. 自动重试机制
- 失败请求自动重试
- 指数退避策略
- 可配置重试次数

### 5. 熔断保护
- 连续失败达到阈值后熔断
- 快速失败，保护后端服务
- 自动恢复机制

### 6. 实时监控
- `/proxy-metrics` - 查看详细指标
- `/proxy-health` - 健康检查
- 响应时间统计
- 成功率监控

## 安装依赖

### 基础版本（仅使用标准库）
```bash
# 无需额外安装
python3 proxy_server_enhanced.py --target-host <目标IP>
```

### 完整版本（推荐，使用requests库）
```bash
pip install requests
python3 proxy_server_enhanced.py --target-host <目标IP>
```

## 快速开始

### 方法1: 使用命令行参数

```bash
# 基础使用
python3 proxy_server_enhanced.py --target-host ssrf-proxy.vke-system --target-port 8888

# 调整超时为5分钟
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --read-timeout 300

# 增加并发数
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 100 \
  --read-timeout 300
```

### 方法2: 使用配置文件

```bash
# 编辑 proxy_config.json
# 然后启动
python3 start_enhanced_proxy.py --config proxy_config.json

# 或覆盖配置文件中的某些参数
python3 start_enhanced_proxy.py \
  --config proxy_config.json \
  --target-host ssrf-proxy.vke-system \
  --read-timeout 300
```

## 配置参数说明

### 并发控制参数

| 参数 | 默认值 | 说明 | 推荐值 |
|-----|--------|------|--------|
| `--max-concurrent-requests` | 50 | 最大并发请求数 | CPU核心数 × 10-20 |
| `--max-queue-size` | 100 | 请求队列最大长度 | 并发数的2倍 |

**调优建议**:
- CPU密集型: `CPU核心数 × 10`
- IO密集型: `CPU核心数 × 20-50`
- 观察CPU和内存使用率调整

### 超时参数

| 参数 | 默认值 | 说明 | 推荐值 |
|-----|--------|------|--------|
| `--connect-timeout` | 10 | 连接超时（秒） | 10-30 |
| `--read-timeout` | 120 | 读取超时（秒） | 根据业务调整，你的场景建议300 |

**你的场景** (5分钟超时):
```bash
--read-timeout 300
```

### 连接池参数

| 参数 | 默认值 | 说明 | 推荐值 |
|-----|--------|------|--------|
| `--pool-connections` | 20 | 连接池大小 | 10-50 |
| `--pool-maxsize` | 50 | 连接池最大连接数 | 并发数的1-2倍 |

**调优建议**:
- `pool_connections`: 通常设为10-20即可
- `pool_maxsize`: 应该 ≥ `max_concurrent_requests`

### 重试参数

| 参数 | 默认值 | 说明 | 推荐值 |
|-----|--------|------|--------|
| `--max-retries` | 2 | 失败重试次数 | 2-3 |
| `--retry-backoff-factor` | 0.5 | 重试退避因子 | 0.5-1.0 |

### 熔断参数

| 参数 | 默认值 | 说明 | 推荐值 |
|-----|--------|------|--------|
| `--circuit-breaker-threshold` | 5 | 熔断阈值（连续失败） | 5-10 |
| `--circuit-breaker-timeout` | 60 | 熔断恢复时间（秒） | 60-300 |

## 监控和诊断

### 查看实时指标

```bash
# 查看详细指标
curl http://localhost:8080/proxy-metrics | jq

# 健康检查
curl http://localhost:8080/proxy-health
```

### 指标说明

```json
{
  "status": "healthy",          // healthy, degraded, unhealthy
  "metrics": {
    "total_requests": 1000,     // 总请求数
    "successful_requests": 950, // 成功请求数
    "failed_requests": 50,      // 失败请求数
    "timeout_requests": 5,      // 超时请求数
    "active_requests": 10,      // 当前活跃请求数
    "queue_rejected": 2,        // 被拒绝的队列请求数
    "success_rate": 95.0,       // 成功率 %
    "avg_response_time": 2.5,   // 平均响应时间（秒）
    "circuit_open": false,      // 熔断器是否打开
    "consecutive_failures": 0,  // 连续失败次数
    "queue_size": 5,            // 当前队列长度
    "available_slots": 40       // 可用并发槽位
  }
}
```

### 性能基准

使用负载测试脚本测试性能:

```bash
# 基础测试：100请求，10并发
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --total-requests 100 \
  --concurrent 10

# 高并发测试：1000请求，50并发
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --total-requests 1000 \
  --concurrent 50

# 持续负载测试：运行60秒
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --duration 60 \
  --concurrent 100

# 测试慢速后端（5分钟超时）
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/slow-function \
  --timeout 300 \
  --concurrent 20
```

## 性能调优指南

### 场景1: 少量用户，快速响应
```bash
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 20 \
  --read-timeout 30 \
  --pool-maxsize 30
```

### 场景2: 中等负载，平衡性能和资源
```bash
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 50 \
  --max-queue-size 100 \
  --read-timeout 120 \
  --pool-maxsize 60
```

### 场景3: 高负载，5分钟超时（你的场景）
```bash
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 100 \
  --max-queue-size 200 \
  --read-timeout 300 \
  --connect-timeout 15 \
  --pool-connections 30 \
  --pool-maxsize 100 \
  --circuit-breaker-threshold 10 \
  --circuit-breaker-timeout 120
```

### 场景4: 超高负载，大规模并发
```bash
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 200 \
  --max-queue-size 500 \
  --read-timeout 300 \
  --pool-connections 50 \
  --pool-maxsize 200
```

## 故障排查

### 问题1: 大量超时

**症状**:
```
timeout_requests: 100
avg_response_time: > read_timeout
```

**解决方案**:
1. 增加 `read-timeout`
2. 减少 `max-concurrent-requests`（后端处理不过来）
3. 检查后端服务性能

### 问题2: 队列拒绝

**症状**:
```
queue_rejected: > 0
available_slots: 0
```

**解决方案**:
1. 增加 `max-concurrent-requests`
2. 增加 `max-queue-size`
3. 扩容服务器资源

### 问题3: 熔断器打开

**症状**:
```
circuit_open: true
consecutive_failures: >= threshold
```

**解决方案**:
1. 检查后端服务是否正常
2. 增加 `circuit-breaker-timeout`
3. 增加 `circuit-breaker-threshold`

### 问题4: 响应慢

**症状**:
```
avg_response_time: > 5秒
p95_response_time: >> avg_response_time
```

**解决方案**:
1. 增加 `pool-maxsize`
2. 优化后端服务
3. 检查网络延迟

## 对比：原版 vs 增强版

| 特性 | 原版 proxy_server.py | 增强版 proxy_server_enhanced.py |
|-----|---------------------|-------------------------------|
| 连接管理 | 每次新建连接 | 连接池复用 ✅ |
| 并发控制 | 无限制 | 信号量控制 ✅ |
| 请求队列 | 无 | 有界队列 ✅ |
| 超时配置 | 固定30秒 | 可配置（支持300秒）✅ |
| 失败重试 | 无 | 自动重试 ✅ |
| 熔断保护 | 无 | 熔断器 ✅ |
| 实时监控 | 无 | 指标端点 ✅ |
| 高负载表现 | 超时/崩溃 | 稳定运行 ✅ |

## 生产环境部署

### 1. 使用systemd服务

创建 `/etc/systemd/system/proxy-service.service`:

```ini
[Unit]
Description=Enhanced Proxy Server
After=network.target

[Service]
Type=simple
User=proxy
WorkingDirectory=/opt/proxy
ExecStart=/usr/bin/python3 /opt/proxy/proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 100 \
  --read-timeout 300
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:
```bash
sudo systemctl daemon-reload
sudo systemctl enable proxy-service
sudo systemctl start proxy-service
sudo systemctl status proxy-service
```

### 2. 使用Docker

创建 `Dockerfile`:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY proxy_server_enhanced.py .
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

CMD ["python3", "proxy_server_enhanced.py", \
     "--target-host", "ssrf-proxy.vke-system", \
     "--target-port", "8888", \
     "--max-concurrent-requests", "100", \
     "--read-timeout", "300"]
```

构建和运行:
```bash
docker build -t enhanced-proxy .
docker run -d -p 8080:8080 --name proxy enhanced-proxy
```

### 3. 日志管理

```bash
# 启动时重定向日志
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  >> /var/log/proxy.log 2>&1

# 或使用日志轮转
logrotate -f /etc/logrotate.d/proxy
```

## 常见问题

### Q1: 为什么会出现300秒超时？

**A**: 后端服务处理时间过长，超过了设定的 `read-timeout`。解决方案：
1. 增加 `--read-timeout 300`
2. 优化后端处理逻辑
3. 使用异步处理

### Q2: 如何选择合适的并发数？

**A**: 根据服务器配置和业务类型：
- 测试: 从50开始，逐步增加
- 监控: 观察CPU/内存使用率
- 调整: 找到性能拐点

公式参考：
```
并发数 = CPU核心数 × (1 + 等待时间/计算时间)
```

### Q3: requests库是必需的吗？

**A**: 不是必需的。如果没有安装requests：
- 服务仍可正常运行
- 使用标准库urllib
- 功能略弱但基本可用
- 推荐安装requests以获得最佳性能

## 性能监控脚本

创建简单的监控脚本 `monitor_proxy.sh`:

```bash
#!/bin/bash

while true; do
  clear
  echo "=== 转发服务监控 ==="
  echo "时间: $(date)"
  curl -s http://localhost:8080/proxy-metrics | jq
  echo ""
  echo "按 Ctrl+C 退出"
  sleep 5
done
```

使用:
```bash
chmod +x monitor_proxy.sh
./monitor_proxy.sh
```

## 总结

增强版转发服务通过以下机制解决高并发超时问题：

1. ✅ **连接池** - 减少连接开销
2. ✅ **并发控制** - 防止资源耗尽
3. ✅ **灵活超时** - 支持长时间请求
4. ✅ **自动重试** - 提高成功率
5. ✅ **熔断保护** - 保护后端服务
6. ✅ **实时监控** - 快速定位问题

根据你的场景（5分钟超时），推荐配置：

```bash
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --max-concurrent-requests 100 \
  --max-queue-size 200 \
  --read-timeout 300 \
  --pool-maxsize 100
```
