# 并发控制快速参考

## 一分钟快速启动

### 1. 安装依赖（推荐但可选）
```bash
pip install requests
```

### 2. 启动服务
```bash
# 方法1: 使用快速启动脚本（最简单）
./start_proxy_with_concurrency_control.sh

# 方法2: 使用命令行参数
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --read-timeout 300 \
  --max-concurrent-requests 100

# 方法3: 使用配置文件
python3 start_enhanced_proxy.py --config proxy_config.json
```

### 3. 测试服务
```bash
# 健康检查
curl http://localhost:8080/proxy-health

# 查看指标
curl http://localhost:8080/proxy-metrics | jq

# 负载测试
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --concurrent 50
```

## 关键配置参数

### 针对5分钟超时场景（推荐）
```bash
--read-timeout 300              # 5分钟读取超时
--max-concurrent-requests 100   # 最大100并发
--max-queue-size 200            # 队列200
--pool-maxsize 100              # 连接池100
```

### 性能调优公式
```
max_concurrent_requests = CPU核心数 × 10-20
pool_maxsize >= max_concurrent_requests
max_queue_size = max_concurrent_requests × 2
```

## 监控命令

```bash
# 实时监控
watch -n 2 'curl -s http://localhost:8080/proxy-metrics | jq'

# 查看特定指标
curl -s http://localhost:8080/proxy-metrics | jq '.metrics'

# 检查健康状态
curl -s http://localhost:8080/proxy-health | jq '.status'
```

## 性能基准

### 期望指标（正常负载）
```
success_rate: > 95%
avg_response_time: < 5秒
queue_rejected: 0
circuit_open: false
```

### 告警阈值
```
success_rate: < 90%  → 增加并发数或优化后端
queue_rejected: > 0  → 增加max_concurrent_requests或max_queue_size
circuit_open: true   → 检查后端服务健康状态
timeout_requests: > 5% → 增加read_timeout
```

## 故障排查速查表

| 症状 | 可能原因 | 解决方案 |
|-----|---------|---------|
| 大量超时 | read_timeout太小 | 增加 --read-timeout |
| 队列拒绝 | 并发数不够 | 增加 --max-concurrent-requests |
| 熔断打开 | 后端故障 | 检查后端服务，增加circuit-breaker-timeout |
| 响应慢 | 连接池太小 | 增加 --pool-maxsize |
| 成功率低 | 后端过载 | 减少并发或扩容后端 |

## 文件说明

| 文件 | 用途 |
|-----|------|
| `proxy_server_enhanced.py` | 增强版转发服务（主程序） |
| `start_enhanced_proxy.py` | 从配置文件启动 |
| `start_proxy_with_concurrency_control.sh` | 快速启动脚本 |
| `test_concurrent_load.py` | 负载测试工具 |
| `proxy_config.json` | 配置文件 |
| `CONCURRENCY_CONTROL_GUIDE.md` | 完整文档 |

## 常用命令

```bash
# 启动服务（5分钟超时配置）
python3 proxy_server_enhanced.py \
  --target-host ssrf-proxy.vke-system \
  --target-port 8888 \
  --read-timeout 300

# 查看实时指标（需要jq）
curl -s http://localhost:8080/proxy-metrics | jq

# 压力测试
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --total-requests 1000 \
  --concurrent 100 \
  --timeout 300

# 持续负载测试（60秒）
python3 test_concurrent_load.py \
  --url http://localhost:8080/api/health \
  --duration 60 \
  --concurrent 50
```

## 对比原版 vs 增强版

| 特性 | 原版 | 增强版 |
|-----|------|--------|
| 连接池 | ❌ | ✅ |
| 并发控制 | ❌ | ✅ |
| 队列管理 | ❌ | ✅ |
| 超时配置 | 固定30秒 | 可配置至300秒+ |
| 自动重试 | ❌ | ✅ |
| 熔断保护 | ❌ | ✅ |
| 实时监控 | ❌ | ✅ |

## 下一步

1. 阅读完整文档: `CONCURRENCY_CONTROL_GUIDE.md`
2. 运行负载测试: `python3 test_concurrent_load.py --help`
3. 调整配置参数: 编辑 `proxy_config.json`
4. 部署到生产: 参考 `CONCURRENCY_CONTROL_GUIDE.md` 的部署章节
