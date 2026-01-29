# HTTP转发服务 - 快速开始

## 场景说明

```
┌─────────┐      ┌─────────┐      ┌─────────┐
│ A服务器 │ ───> │ B服务器 │ ───> │ C服务器 │
│ (访问端) │      │ (转发层) │      │ (API)   │
└─────────┘      └─────────┘      └─────────┘

网段限制: A无法直接访问C，但A可访问B，B可访问C
```

## 快速部署（3步）

### 步骤1：在C服务器上
确保API服务运行在8000端口（已部署）✓

### 步骤2：在B服务器上
```bash
# 上传以下文件到B服务器
# - proxy_server.py
# - start_proxy.sh
# - stop_proxy.sh

# 添加执行权限
chmod +x start_proxy.sh stop_proxy.sh

# 启动转发服务（替换<C服务器IP>为实际IP）
./start_proxy.sh <C服务器IP> -b

# 例如：./start_proxy.sh 192.168.2.100 -b
```

### 步骤3：在A服务器上测试
```bash
# 测试连接（替换<B服务器IP>为实际IP）
curl http://<B服务器IP>:8080/health

# 应该返回: {"status": "healthy"}
```

## 使用示例

### 查看API文档
```bash
curl http://<B服务器IP>:8080/
curl http://<B服务器IP>:8080/functions
```

### 调用API
```bash
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

## 管理命令

### 启动服务
```bash
# 前台运行（测试用）
./start_proxy.sh <C服务器IP>

# 后台运行（生产用）
./start_proxy.sh <C服务器IP> -b

# 自定义端口
./start_proxy.sh <C服务器IP> -p 9090 -b
```

### 停止服务
```bash
# 正常停止
./stop_proxy.sh

# 强制停止
./stop_proxy.sh -f
```

### 查看日志
```bash
tail -f proxy.log
```

### 查看状态
```bash
# 检查进程
ps aux | grep proxy_server

# 检查端口
netstat -tuln | grep 8080
```

## 配置说明

### 参数列表
| 参数 | 默认值 | 说明 |
|------|--------|------|
| --target-host | 必填 | C服务器IP地址 |
| --target-port | 8000 | C服务器API端口 |
| --listen-port | 8080 | B服务器监听端口 |
| --listen-host | 0.0.0.0 | 监听地址 |

### 端口配置示例
```bash
# C服务器IP: 192.168.2.100, API端口: 8000
# B服务器监听端口: 8080
./start_proxy.sh 192.168.2.100 -b

# C服务器IP: 192.168.2.100, API端口: 9000
# B服务器监听端口: 9090
./start_proxy.sh 192.168.2.100 -t 9000 -p 9090 -b
```

## Python直接使用

如果不使用脚本，可以直接运行Python：

```bash
# 基础用法
python3 proxy_server.py --target-host <C服务器IP>

# 完整参数
python3 proxy_server.py \
  --target-host <C服务器IP> \
  --target-port 8000 \
  --listen-port 8080

# 后台运行
nohup python3 proxy_server.py \
  --target-host <C服务器IP> \
  --target-port 8000 \
  --listen-port 8080 \
  > proxy.log 2>&1 &
```

## 文件说明

| 文件 | 说明 |
|------|------|
| proxy_server.py | 转发服务主程序 |
| start_proxy.sh | 启动脚本（推荐） |
| stop_proxy.sh | 停止脚本（推荐） |
| PROXY_SETUP.md | 详细部署文档 |

## 故障排查

### 1. 无法连接到C服务器
```bash
# 在B服务器测试
telnet <C服务器IP> 8000
curl http://<C服务器IP>:8000/health
```

### 2. 转发服务启动失败
```bash
# 检查端口占用
netstat -tuln | grep 8080

# 查看错误日志
tail -50 proxy.log
```

### 3. A服务器无法访问B
```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 8080/tcp

# 测试连通性
telnet <B服务器IP> 8080
```

## 特性

✓ 只依赖Python标准库（无需安装额外包）
✓ 支持GET/POST/PUT/DELETE/OPTIONS请求
✓ 自动处理查询参数和请求体
✓ 完整的错误处理
✓ 前台/后台运行模式
✓ 详细的日志输出
✓ 进程管理脚本

## 安全建议

1. 限制防火墙规则，只允许必要IP访问
2. 使用VPN或专用网络
3. 定期检查访问日志
4. 生产环境建议添加认证机制

## 技术支持

详细文档请参考：PROXY_SETUP.md
