# HTTP转发服务部署指南

## 架构说明

```
A服务器 (访问端) → B服务器 (转发层) → C服务器 (API服务)
   可访问B            可访问C          运行FastAPI服务
```

## 部署步骤

### 1. 在C服务器上（已部署API服务）

确保API服务正在运行（端口8000）：

```bash
cd /home/yy/haa
python3 main.py
```

### 2. 在B服务器上（部署转发服务）

将 `proxy_server.py` 上传到B服务器，然后启动：

```bash
# 方式1：直接运行
python3 proxy_server.py --target-host <C服务器IP> --target-port 8000 --listen-port 8080

# 方式2：使用后台运行（推荐）
nohup python3 proxy_server.py --target-host <C服务器IP> --target-port 8000 --listen-port 8080 > proxy.log 2>&1 &
```

**参数说明：**
- `--target-host`: C服务器的IP地址（必需）
- `--target-port`: C服务器API端口（默认8000）
- `--listen-port`: B服务器监听端口（默认8080）
- `--listen-host`: B服务器监听地址（默认0.0.0.0）

### 3. 在A服务器上（访问API）

现在A服务器可以通过访问B服务器来调用C服务器的API：

```bash
# 示例：调用function1
curl -X POST http://<B服务器IP>:8080/api/function1 \
  -H "Content-Type: application/json" \
  -d '{
    "param1": "value1",
    "param2": "value2",
    "param3": 100,
    "param4": "value4",
    "param5": 200
  }'
```

## 实际部署示例

假设：
- C服务器IP: `192.168.2.100`（运行API服务）
- B服务器IP: `192.168.1.50`（转发层）
- A服务器可以访问 `192.168.1.50`

### 在B服务器上执行：

```bash
# 上传proxy_server.py到B服务器后
python3 proxy_server.py \
  --target-host 192.168.2.100 \
  --target-port 8000 \
  --listen-port 8080
```

### 在A服务器上测试：

```bash
# 测试健康检查
curl http://192.168.1.50:8080/health

# 查看可用函数列表
curl http://192.168.1.50:8080/functions

# 调用function1
curl -X POST http://192.168.1.50:8080/api/function1 \
  -H "Content-Type: application/json" \
  -d '{"param1": "test", "param2": "demo", "param3": 10, "param4": "value", "param5": 20}'
```

## 后台运行管理

### 启动服务（后台）

```bash
nohup python3 proxy_server.py \
  --target-host <C服务器IP> \
  --target-port 8000 \
  --listen-port 8080 \
  > proxy.log 2>&1 &

# 记录进程ID
echo $! > proxy.pid
```

### 停止服务

```bash
# 如果记录了PID
kill $(cat proxy.pid)

# 或者查找进程并停止
ps aux | grep proxy_server.py
kill <进程ID>
```

### 查看日志

```bash
tail -f proxy.log
```

## 防火墙配置

确保B服务器开放了监听端口（如8080）：

```bash
# Ubuntu/Debian
sudo ufw allow 8080/tcp

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --reload
```

## 测试转发是否正常工作

```bash
# 在B服务器上测试
curl http://localhost:8080/health

# 应该返回：{"status": "healthy"}

# 在A服务器上测试（替换为B服务器的实际IP）
curl http://<B服务器IP>:8080/health
```

## 故障排查

### 1. 检查C服务器API是否运行

在B服务器上执行：

```bash
curl http://<C服务器IP>:8000/health
```

### 2. 检查B服务器转发服务是否运行

```bash
ps aux | grep proxy_server
netstat -tuln | grep 8080
```

### 3. 检查网络连通性

```bash
# 在B服务器上测试能否访问C
telnet <C服务器IP> 8000

# 在A服务器上测试能否访问B
telnet <B服务器IP> 8080
```

### 4. 查看详细错误日志

```bash
# 查看转发服务日志
tail -100 proxy.log
```

## 安全建议

1. **限制访问来源**：如果可能，配置防火墙只允许A服务器IP访问B服务器的8080端口
2. **使用HTTPS**：生产环境建议配置SSL证书
3. **添加认证**：可以在转发层添加基本的认证机制
4. **日志监控**：定期检查访问日志，发现异常访问

## 特性说明

- ✅ 支持GET、POST、PUT、DELETE请求
- ✅ 自动处理查询参数
- ✅ 转发请求体（POST/PUT）
- ✅ 保留响应头
- ✅ 错误处理和超时控制
- ✅ 只依赖Python标准库
- ✅ 支持OPTIONS请求（CORS预检）
