#!/bin/bash
# 增强型转发服务测试脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROXY_URL="${PROXY_URL:-http://localhost:8080}"

print_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

echo "============================================"
echo "  增强型转发服务测试"
echo "============================================"
echo ""

# 测试1: 健康检查
print_info "测试1: 检查服务是否运行"
if curl -s "$PROXY_URL/" | grep -q "Enhanced Proxy Server"; then
    print_success "服务运行正常"
else
    print_error "服务未运行或无法访问"
    exit 1
fi
echo ""

# 测试2: 统计信息
print_info "测试2: 获取服务统计信息"
response=$(curl -s "$PROXY_URL/stats")
echo "响应: $response"
if echo "$response" | grep -q "total_tasks"; then
    print_success "统计信息获取成功"
else
    print_error "统计信息获取失败"
fi
echo ""

# 测试3: 提交任务
print_info "测试3: 提交测试任务"
task_response=$(curl -s -X POST "$PROXY_URL/api/test" \
    -H "Content-Type: application/json" \
    -d '{"test": "value"}')

echo "响应: $task_response"

if echo "$task_response" | grep -q "task_id"; then
    task_id=$(echo "$task_response" | grep -o '"task_id":"[^"]*' | cut -d'"' -f4)
    print_success "任务提交成功，ID: $task_id"
else
    print_error "任务提交失败"
    exit 1
fi
echo ""

# 测试4: 查询任务状态
print_info "测试4: 查询任务状态（等待3秒后）"
sleep 3
status_response=$(curl -s "$PROXY_URL/task/$task_id")
echo "响应: $status_response"

if echo "$status_response" | grep -q "status"; then
    print_success "任务状态查询成功"
else
    print_error "任务状态查询失败"
fi
echo ""

# 测试5: 列出所有任务
print_info "测试5: 列出所有任务"
tasks_response=$(curl -s "$PROXY_URL/tasks")
echo "响应: $tasks_response"

if echo "$tasks_response" | grep -q "tasks"; then
    print_success "任务列表获取成功"
else
    print_error "任务列表获取失败"
fi
echo ""

echo "============================================"
echo "  测试完成"
echo "============================================"
