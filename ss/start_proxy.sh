#!/bin/bash
##############################################################################
# HTTP转发服务启动脚本
# 用法: ./start_proxy.sh <C服务器IP> [监听端口]
##############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_TARGET_PORT=8000
DEFAULT_LISTEN_PORT=8080
DEFAULT_LISTEN_HOST="0.0.0.0"

# 函数：打印错误信息
error() {
    echo -e "${RED}[错误]${NC} $1"
    exit 1
}

# 函数：打印成功信息
success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

# 函数：打印警告信息
warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

# 函数：显示使用帮助
show_help() {
    cat << EOF
HTTP转发服务启动脚本

用法: $0 <C服务器IP> [选项]

参数:
    C服务器IP         目标服务器（C服务器）的IP地址 [必需]

选项:
    -p, --listen-port 监听端口，默认: 8080
    -t, --target-port 目标端口，默认: 8000
    -b, --background  后台运行
    -h, --help        显示此帮助信息

示例:
    # 前台运行，转发到192.168.2.100:8000，监听8080端口
    $0 192.168.2.100

    # 后台运行，监听9090端口
    $0 192.168.2.100 -p 9090 -b

    # 转发到C服务器的9000端口
    $0 192.168.2.100 -t 9000 -b

EOF
}

# 函数：检查依赖
check_dependencies() {
    if ! command -v python3 &> /dev/null; then
        error "未找到python3，请先安装Python 3"
    fi

    if [[ ! -f "proxy_server.py" ]]; then
        error "未找到proxy_server.py文件"
    fi
}

# 函数：检查端口是否可用
check_port() {
    local port=$1
    if netstat -tuln 2>/dev/null | grep -q ":${port} "; then
        warning "端口 ${port} 已被占用"
        read -p "是否继续？(y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "用户取消操作"
        fi
    fi
}

# 函数：测试目标服务器连通性
test_target_connection() {
    local target_host=$1
    local target_port=$2

    echo -n "测试到目标服务器的连通性..."
    if timeout 3 bash -c "cat < /dev/null > /dev/tcp/${target_host}/${target_port}" 2>/dev/null; then
        success "连接正常"
    else
        warning "无法连接到 ${target_host}:${target_port}"
        read -p "是否继续启动？(y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "用户取消操作"
        fi
    fi
}

# 函数：启动服务（前台）
start_foreground() {
    local target_host=$1
    local target_port=$2
    local listen_host=$3
    local listen_port=$4

    echo ""
    echo "========================================"
    echo "  HTTP转发服务（前台模式）"
    echo "========================================"
    echo "目标服务器: ${target_host}:${target_port}"
    echo "监听地址: ${listen_host}:${listen_port}"
    echo "========================================"
    echo ""

    python3 proxy_server.py \
        --target-host "${target_host}" \
        --target-port "${target_port}" \
        --listen-host "${listen_host}" \
        --listen-port "${listen_port}"
}

# 函数：启动服务（后台）
start_background() {
    local target_host=$1
    local target_port=$2
    local listen_host=$3
    local listen_port=$4

    local pid_file="proxy.pid"
    local log_file="proxy.log"

    # 检查是否已有服务在运行
    if [[ -f "$pid_file" ]]; then
        local old_pid=$(cat "$pid_file")
        if ps -p "$old_pid" > /dev/null 2>&1; then
            warning "转发服务已在运行（PID: ${old_pid}）"
            read -p "是否重启服务？(y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "停止旧服务..."
                kill "$old_pid" 2>/dev/null || true
                sleep 1
            else
                echo "操作已取消"
                exit 0
            fi
        fi
    fi

    echo ""
    echo "========================================"
    echo "  HTTP转发服务（后台模式）"
    echo "========================================"
    echo "目标服务器: ${target_host}:${target_port}"
    echo "监听地址: ${listen_host}:${listen_port}"
    echo "日志文件: ${log_file}"
    echo "进程文件: ${pid_file}"
    echo "========================================"
    echo ""

    # 启动服务
    nohup python3 proxy_server.py \
        --target-host "${target_host}" \
        --target-port "${target_port}" \
        --listen-host "${listen_host}" \
        --listen-port "${listen_port}" \
        > "${log_file}" 2>&1 &

    local pid=$!
    echo $pid > "${pid_file}"

    # 等待服务启动
    sleep 2

    # 验证服务是否启动成功
    if ps -p "$pid" > /dev/null 2>&1; then
        success "转发服务已启动（PID: ${pid}）"
        echo ""
        echo "管理命令："
        echo "  查看日志: tail -f ${log_file}"
        echo "  停止服务: kill ${pid} 或 kill \$(cat ${pid_file})"
        echo "  查看状态: ps aux | grep ${pid}"
        echo ""
        echo "测试命令："
        echo "  curl http://localhost:${listen_port}/health"
        echo ""
    else
        error "服务启动失败，请查看日志: ${log_file}"
    fi
}

# 主程序
main() {
    local target_host=""
    local target_port=$DEFAULT_TARGET_PORT
    local listen_port=$DEFAULT_LISTEN_PORT
    local listen_host=$DEFAULT_LISTEN_HOST
    local background=false

    # 解析参数
    if [[ $# -eq 0 ]]; then
        show_help
        exit 0
    fi

    target_host="$1"
    shift

    # 解析选项
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--listen-port)
                listen_port="$2"
                shift 2
                ;;
            -t|--target-port)
                target_port="$2"
                shift 2
                ;;
            -b|--background)
                background=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "未知参数: $1"
                ;;
        esac
    done

    # 验证参数
    if [[ -z "$target_host" ]]; then
        error "必须指定目标服务器IP"
    fi

    # 执行检查
    check_dependencies
    check_port "$listen_port"
    test_target_connection "$target_host" "$target_port"

    # 启动服务
    if [[ "$background" == true ]]; then
        start_background "$target_host" "$target_port" "$listen_host" "$listen_port"
    else
        start_foreground "$target_host" "$target_port" "$listen_host" "$listen_port"
    fi
}

# 运行主程序
main "$@"
