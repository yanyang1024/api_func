#!/bin/bash
# 快速启动增强版转发服务 - 针对5分钟超时场景优化

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "  增强版转发服务 - 并发控制版本"
echo "=================================================="
echo ""

# 检查依赖
echo -e "${YELLOW}[1/4] 检查依赖...${NC}"
if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  未安装requests库，将使用标准库（功能受限）${NC}"
    echo "   推荐安装: pip install requests"
    echo ""
else
    echo -e "${GREEN}✅ requests库已安装${NC}"
fi

# 检查配置文件
if [ -f "proxy_config.json" ]; then
    echo -e "${GREEN}✅ 找到配置文件 proxy_config.json${NC}"
    USE_CONFIG=true
else
    echo -e "${YELLOW}⚠️  未找到配置文件，使用命令行参数${NC}"
    USE_CONFIG=false
fi

# 获取目标服务器
if [ -z "$TARGET_HOST" ]; then
    TARGET_HOST="ssrf-proxy.vke-system"
fi

if [ -z "$TARGET_PORT" ]; then
    TARGET_PORT=8888
fi

echo ""
echo -e "${YELLOW}[2/4] 服务配置${NC}"
echo "  目标服务器: $TARGET_HOST:$TARGET_PORT"
echo "  监听端口: 8080"
echo "  最大并发: 100"
echo "  队列大小: 200"
echo "  读取超时: 300秒 (5分钟)"
echo ""

# 检查端口是否被占用
if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
    echo -e "${RED}❌ 端口8080已被占用，请先停止其他服务${NC}"
    echo ""
    netstat -tuln | grep ":8080 "
    exit 1
fi

echo -e "${GREEN}✅ 端口8080可用${NC}"
echo ""

# 启动服务
echo -e "${YELLOW}[3/4] 启动转发服务...${NC}"
echo ""

if [ "$USE_CONFIG" = true ]; then
    # 使用配置文件
    python3 start_enhanced_proxy.py \
        --config proxy_config.json \
        --target-host "$TARGET_HOST" \
        --read-timeout 300 \
        --max-concurrent 100
else
    # 使用命令行参数
    python3 proxy_server_enhanced.py \
        --target-host "$TARGET_HOST" \
        --target-port "$TARGET_PORT" \
        --listen-host 0.0.0.0 \
        --listen-port 8080 \
        --max-concurrent-requests 100 \
        --max-queue-size 200 \
        --connect-timeout 15 \
        --read-timeout 300 \
        --pool-connections 30 \
        --pool-maxsize 100 \
        --max-retries 2 \
        --circuit-breaker-threshold 10 \
        --circuit-breaker-timeout 120
fi

# 如果上面的命令成功执行，说明服务正在运行
# 下面的代码不会被执行，因为前面的服务会阻塞

echo ""
echo -e "${GREEN}[4/4] 服务已启动！${NC}"
echo ""
echo "测试命令:"
echo "  curl http://localhost:8080/proxy-health"
echo "  curl http://localhost:8080/proxy-metrics | jq"
echo ""
echo "负载测试:"
echo "  python3 test_concurrent_load.py --url http://localhost:8080/api/health --concurrent 50"
echo ""
echo "查看完整文档:"
echo "  cat CONCURRENCY_CONTROL_GUIDE.md"
echo ""
