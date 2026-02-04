#!/bin/bash
# 对比测试脚本 - 比较原版和增强版的性能

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=================================================="
echo "  转发服务对比测试"
echo "=================================================="
echo ""

# 检查是否已安装requests
if ! python3 -c "import requests" 2>/dev/null; then
    echo -e "${RED}❌ 请先安装requests库:${NC}"
    echo "   pip install requests"
    exit 1
fi

# 配置
TARGET_HOST="${TARGET_HOST:-localhost}"
TARGET_PORT="${TARGET_PORT:-8000}"
CONCURRENT="${CONCURRENT:-50}"
TOTAL_REQUESTS="${TOTAL_REQUESTS:-500}"

echo -e "${BLUE}测试配置:${NC}"
echo "  目标服务器: $TARGET_HOST:$TARGET_PORT"
echo "  并发数: $CONCURRENT"
echo "  总请求数: $TOTAL_REQUESTS"
echo ""

# 测试URL
TEST_URL="http://localhost:8080/health"

echo -e "${YELLOW}开始测试...${NC}"
echo ""

python3 test_concurrent_load.py \
    --url "$TEST_URL" \
    --total-requests "$TOTAL_REQUESTS" \
    --concurrent "$CONCURRENT" \
    --timeout 30

echo ""
echo -e "${GREEN}测试完成！${NC}"
echo ""
echo "查看实时监控:"
echo "  curl http://localhost:8080/proxy-metrics | jq"
echo ""
echo "监控面板（需要安装jq）:"
echo "  watch -n 2 'curl -s http://localhost:8080/proxy-metrics | jq'"
echo ""
