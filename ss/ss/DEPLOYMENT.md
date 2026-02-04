# 部署文档

本文档详细介绍如何在不同环境中部署Python函数API封装服务。

## 目录

- [本地开发部署](#本地开发部署)
- [生产环境部署](#生产环境部署)
- [Docker部署](#docker部署)
- [Nginx反向代理](#nginx反向代理)
- [Systemd服务](#systemd服务)
- [云平台部署](#云平台部署)

## 本地开发部署

### 方法1: 直接运行

```bash
# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

服务将在 http://localhost:8000 启动。

### 方法2: 使用Uvicorn

```bash
# 开发模式（支持热重载）
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 生产模式
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 生产环境部署

### 1. 系统准备

#### Ubuntu/Debian

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Python和pip
sudo apt install python3 python3-pip python3-venv -y

# 安装其他依赖
sudo apt install -y nginx supervisor  # 可选
```

#### CentOS/RHEL

```bash
# 安装Python和pip
sudo yum install python3 python3-pip -y

# 或使用dnf (较新版本)
sudo dnf install python3 python3-pip -y
```

### 2. 创建部署目录

```bash
# 创建应用目录
sudo mkdir -p /opt/api-service
sudo chown $USER:$USER /opt/api-service

# 复制应用文件
cp -r . /opt/api-service/
cd /opt/api-service
```

### 3. 创建虚拟环境

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 4. 配置环境变量

```bash
# 复制环境变量示例
cp .env.example .env

# 编辑配置
nano .env
```

生产环境推荐配置：

```bash
API_HOST=127.0.0.1
API_PORT=8000
DEBUG=False
LOG_LEVEL=warning
```

### 5. 测试启动

```bash
# 激活虚拟环境
source venv/bin/activate

# 启动服务
python main.py
```

在另一个终端测试：

```bash
curl http://localhost:8000/health
```

## Docker部署

### 1. 创建Dockerfile

创建文件 `Dockerfile`：

```dockerfile
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建输出目录
RUN mkdir -p outputs

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 2. 创建docker-compose.yml

创建文件 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  api-service:
    build: .
    container_name: python-api-service
    ports:
      - "8000:8000"
    environment:
      - API_HOST=0.0.0.0
      - API_PORT=8000
      - DEBUG=False
    volumes:
      - ./outputs:/app/outputs
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries:3
```

### 3. 构建和运行

```bash
# 构建镜像
docker build -t python-api-service .

# 运行容器
docker run -d \
  --name api-service \
  -p 8000:8000 \
  -v $(pwd)/outputs:/app/outputs \
  python-api-service

# 或使用docker-compose
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## Nginx反向代理

### 1. 安装Nginx

```bash
sudo apt install nginx -y
```

### 2. 创建Nginx配置

创建文件 `/etc/nginx/sites-available/api-service`：

```nginx
upstream api_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    client_max_body_size 100M;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket支持（如果需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 超时设置
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }

    # 如果有静态文件
    location /static {
        alias /opt/api-service/static;
    }
}
```

### 3. 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/api-service /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx

# 开机自启
sudo systemctl enable nginx
```

### 4. 配置SSL（推荐）

使用Let's Encrypt免费证书：

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## Systemd服务

### 1. 创建服务文件

创建文件 `/etc/systemd/system/api-service.service`：

```ini
[Unit]
Description=Python API Service
After=network.target

[Service]
Type=notify
User=www-data
Group=www-data
WorkingDirectory=/opt/api-service
Environment="PATH=/opt/api-service/venv/bin"
EnvironmentFile=-/opt/api-service/.env
ExecStart=/opt/api-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 2. 启动服务

```bash
# 重载systemd配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start api-service

# 查看状态
sudo systemctl status api-service

# 开机自启
sudo systemctl enable api-service

# 查看日志
sudo journalctl -u api-service -f

# 重启服务
sudo systemctl restart api-service

# 停止服务
sudo systemctl stop api-service
```

## Supervisor管理

### 1. 安装Supervisor

```bash
sudo apt install supervisor -y
```

### 2. 创建配置文件

创建文件 `/etc/supervisor/conf.d/api-service.conf`：

```ini
[program:api-service]
command=/opt/api-service/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
directory=/opt/api-service
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/api-service.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
environment=API_PORT="8000",DEBUG="False"
```

### 3. 启动服务

```bash
# 重载配置
sudo supervisorctl reread
sudo supervisorctl update

# 启动服务
sudo supervisorctl start api-service

# 查看状态
sudo supervisorctl status

# 查看日志
sudo supervisorctl tail api-service

# 重启服务
sudo supervisorctl restart api-service
```

## 云平台部署

### AWS EC2

1. **启动EC2实例**
   - 选择Ubuntu 22.04 AMI
   - 实例类型：t3.medium或更高
   - 配置安全组，开放8000端口

2. **连接并部署**

```bash
# SSH连接
ssh -i your-key.pem ubuntu@your-ec2-ip

# 安装Docker
sudo apt update
sudo apt install docker.io docker-compose -y
sudo usermod -aG docker ubuntu

# 克隆代码
git clone your-repo-url
cd your-repo

# 启动服务
docker-compose up -d
```

### Google Cloud Platform

```bash
# 创建实例
gcloud compute instances create api-service \
    --zone=us-central1-a \
    --machine-type=e2-medium \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --tags=http-server,https-server

# 创建防火墙规则
gcloud compute firewall-rules create allow-http \
    --allow tcp:8000 \
    --source-ranges 0.0.0.0/0

# SSH连接并部署（同EC2步骤）
```

### Azure Container Instances

```bash
# 创建资源组
az group create --name api-service-rg --location eastus

# 创建容器实例
az container create \
  --resource-group api-service-rg \
  --name api-service \
  --image your-registry/python-api-service:latest \
  --cpu 2 \
  --memory 4 \
  --ports 8000 \
  --environment-variables API_PORT=8000
```

## 性能优化

### 1. 调整Worker数量

```bash
# 公式：workers = (2 x CPU核心数) + 1
# 例如4核CPU
uvicorn main:app --workers 9
```

### 2. 启用Gunicorn（多进程管理）

```bash
# 安装gunicorn
pip install gunicorn

# 启动
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

### 3. 配置文件缓存

对于频繁读取的配置文件，使用缓存：

```python
from functools import lru_cache

@lru_cache()
def get_config():
    return load_config()
```

## 监控和日志

### 1. 日志配置

在 `main.py` 中添加：

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/api.log"),
        logging.StreamHandler()
    ]
)
```

### 2. 健康检查

```bash
# 添加到cron
crontab -e

# 每5分钟检查一次
*/5 * * * * curl -f http://localhost:8000/health || echo "Service down" | mail -s "Alert" admin@example.com
```

### 3. 性能监控

使用Prometheus + Grafana：

```bash
# 安装prometheus_client
pip install prometheus-client

# 在代码中添加metrics
from prometheus_client import Counter, start_http_server

request_counter = Counter('api_requests_total', 'Total API requests')
request_counter.inc()
```

## 备份和恢复

### 1. 备份应用代码

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/api-service"
SOURCE_DIR="/opt/api-service"

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/api-service-$DATE.tar.gz $SOURCE_DIR

# 保留最近7天的备份
find $BACKUP_DIR -name "api-service-*.tar.gz" -mtime +7 -delete
```

### 2. 恢复

```bash
tar -xzf api-service-20231201_120000.tar.gz -C /
```

## 故障排查

### 问题1: 端口被占用

```bash
# 查找占用端口的进程
sudo lsof -i :8000

# 杀死进程
sudo kill -9 <PID>
```

### 问题2: 权限错误

```bash
# 修改文件权限
sudo chown -R www-data:www-data /opt/api-service
sudo chmod -R 755 /opt/api-service
```

### 问题3: 依赖冲突

```bash
# 重新安装依赖
pip uninstall -y -r requirements.txt
pip install -r requirements.txt --force-reinstall
```

## 安全建议

1. **使用HTTPS**
2. **添加API密钥认证**
3. **限制请求频率**
4. **输入数据验证**
5. **定期更新依赖**
6. **配置防火墙**
7. **隐藏敏感信息**

## 总结

根据你的需求选择合适的部署方式：

- **开发测试**: 直接运行或Uvicorn
- **小型生产**: Systemd + Nginx
- **中型生产**: Docker + Nginx
- **大型生产**: Kubernetes + 云平台

更多问题请参考 README.md 或提交Issue。
