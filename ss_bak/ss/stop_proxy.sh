#!/bin/bash
##############################################################################
# HTTP转发服务停止脚本
# 用法: ./stop_proxy.sh
##############################################################################

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PID_FILE="proxy.pid"

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
HTTP转发服务停止脚本

用法: $0 [选项]

选项:
    -f, --force   强制停止，查找并杀死所有proxy_server.py进程
    -h, --help    显示此帮助信息

示例:
    # 正常停止（使用PID文件）
    $0

    # 强制停止（查找进程）
    $0 -f

EOF
}

# 函数：正常停止服务
stop_normal() {
    if [[ ! -f "$PID_FILE" ]]; then
        error "未找到PID文件 (${PID_FILE})，服务可能未运行或使用 -f 选项强制停止"
    fi

    local pid=$(cat "$PID_FILE")

    # 检查进程是否存在
    if ! ps -p "$pid" > /dev/null 2>&1; then
        warning "进程 ${pid} 不存在，清理PID文件"
        rm -f "$PID_FILE"
        exit 0
    fi

    echo "正在停止转发服务（PID: ${pid}）..."
    kill "$pid"

    # 等待进程结束
    local count=0
    while ps -p "$pid" > /dev/null 2>&1; do
        sleep 1
        count=$((count + 1))
        if [[ $count -ge 10 ]]; then
            warning "进程未响应，强制终止..."
            kill -9 "$pid" 2>/dev/null || true
            break
        fi
        echo -n "."
    done

    echo ""
    rm -f "$PID_FILE"
    success "转发服务已停止"
}

# 函数：强制停止服务
stop_force() {
    echo "正在查找转发服务进程..."

    # 查找所有proxy_server.py进程
    local pids=$(ps aux | grep "[p]roxy_server.py" | awk '{print $2}')

    if [[ -z "$pids" ]]; then
        echo "未找到运行中的转发服务"
    else
        echo "找到以下进程:"
        ps aux | grep "[p]roxy_server.py"
        echo ""

        read -p "是否停止这些进程？(y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            for pid in $pids; do
                echo "停止进程 ${pid}..."
                kill "$pid" 2>/dev/null || true
            done

            # 等待进程结束
            sleep 2

            # 清理顽固进程
            pids=$(ps aux | grep "[p]roxy_server.py" | awk '{print $2}')
            if [[ -n "$pids" ]]; then
                echo "强制终止剩余进程..."
                for pid in $pids; do
                    kill -9 "$pid" 2>/dev/null || true
                done
            fi

            rm -f "$PID_FILE"
            success "转发服务已停止"
        else
            echo "操作已取消"
        fi
    fi
}

# 主程序
main() {
    local force=false

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                force=true
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

    if [[ "$force" == true ]]; then
        stop_force
    else
        stop_normal
    fi
}

# 运行主程序
main "$@"
