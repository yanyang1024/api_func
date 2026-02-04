#!/bin/bash
# 增强型转发服务启动脚本

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认配置
DEFAULT_TARGET_HOST="localhost"
DEFAULT_TARGET_PORT=8000
DEFAULT_LISTEN_HOST="0.0.0.0"
DEFAULT_LISTEN_PORT=8080
DEFAULT_MAX_CONCURRENT=10
DEFAULT_MAX_QUEUE_SIZE=100
DEFAULT_NUM_WORKERS=5

# 函数：打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 函数：显示帮助信息
show_help() {
    cat << EOF
增强型转发服务启动脚本

用法: $0 [OPTIONS]

选项:
    -t, --target-host HOST       目标服务器IP地址（必需）
    -p, --target-port PORT       目标服务器端口（默认: 8000）
    -l, --listen-host HOST       监听地址（默认: 0.0.0.0）
    -o, --listen-port PORT       监听端口（默认: 8080）
    -c, --max-concurrent NUM     最大并发任务数（默认: 10）
    -q, --max-queue-size NUM     最大队列大小（默认: 100）
    -w, --num-workers NUM        工作线程数（默认: 5）
    -h, --help                   显示此帮助信息

示例:
    # 基本启动
    $0 --target-host 192.168.1.100

    # 完整配置
    $0 --target-host 192.168.1.100 \\
       --target-port 8000 \\
       --listen-port 8080 \\
       --max-concurrent 20 \\
       --max-queue-size 200 \\
       --num-workers 10

    # 高性能配置
    $0 --target-host 192.168.1.100 \\
       --max-concurrent 50 \\
       --num-workers 20

配置说明:
    --max-concurrent    控制同时处理的任务数量
                        建议：CPU核心数的2-4倍

    --max-queue-size    控制等待队列的最大长度
                        建议：根据内存大小和任务类型调整

    --num-workers       后台工作线程数量
                        建议：与max-concurrent相同或略大

EOF
}

# 函数：检查依赖
check_dependencies() {
    print_info "检查依赖..."

    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 未安装"
        exit 1
    fi

    if ! python3 -c "import fastapi" 2>/dev/null; then
        print_warning "FastAPI 未安装，正在安装依赖..."
        pip install -r requirements.txt
    fi

    if ! python3 -c "import httpx" 2>/dev/null; then
        print_warning "httpx 未安装，正在安装..."
        pip install httpx==0.25.2
    fi

    print_success "依赖检查完成"
}

# 函数：验证参数
validate_params() {
    if [ -z "$TARGET_HOST" ]; then
        print_error "必须指定目标主机（--target-host）"
        exit 1
    fi

    if [ "$TARGET_PORT" -lt 1 ] || [ "$TARGET_PORT" -gt 65535 ]; then
        print_error "目标端口必须在 1-65535 之间"
        exit 1
    fi

    if [ "$LISTEN_PORT" -lt 1 ] || [ "$LISTEN_PORT" -gt 65535 ]; then
        print_error "监听端口必须在 1-65535 之间"
        exit 1
    fi

    if [ "$MAX_CONCURRENT" -lt 1 ]; then
        print_error "最大并发数必须大于 0"
        exit 1
    fi

    if [ "$MAX_QUEUE_SIZE" -lt 1 ]; then
        print_error "队列大小必须大于 0"
        exit 1
    fi

    if [ "$NUM_WORKERS" -lt 1 ]; then
        print_error "工作线程数必须大于 0"
        exit 1
    fi
}

# 函数：显示配置信息
show_config() {
    echo ""
    echo "============================================"
    echo "  增强型转发服务配置"
    echo "============================================"
    echo "  目标服务器: $TARGET_HOST:$TARGET_PORT"
    echo "  监听地址:   $LISTEN_HOST:$LISTEN_PORT"
    echo "  最大并发:   $MAX_CONCURRENT"
    echo "  队列大小:   $MAX_QUEUE_SIZE"
    echo "  工作线程:   $NUM_WORKERS"
    echo "============================================"
    echo ""
}

# 函数：检查端口是否被占用
check_port() {
    local port=$1
    local host=$2

    if command -v lsof &> /dev/null; then
        if lsof -i:"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_warning "端口 $port 可能已被占用"
            read -p "是否继续？(y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            print_warning "端口 $port 可能已被占用"
            read -p "是否继续？(y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target-host)
            TARGET_HOST="$2"
            shift 2
            ;;
        -p|--target-port)
            TARGET_PORT="$2"
            shift 2
            ;;
        -l|--listen-host)
            LISTEN_HOST="$2"
            shift 2
            ;;
        -o|--listen-port)
            LISTEN_PORT="$2"
            shift 2
            ;;
        -c|--max-concurrent)
            MAX_CONCURRENT="$2"
            shift 2
            ;;
        -q|--max-queue-size)
            MAX_QUEUE_SIZE="$2"
            shift 2
            ;;
        -w|--num-workers)
            NUM_WORKERS="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 设置默认值
TARGET_HOST=${TARGET_HOST:-$DEFAULT_TARGET_HOST}
TARGET_PORT=${TARGET_PORT:-$DEFAULT_TARGET_PORT}
LISTEN_HOST=${LISTEN_HOST:-$DEFAULT_LISTEN_HOST}
LISTEN_PORT=${LISTEN_PORT:-$DEFAULT_LISTEN_PORT}
MAX_CONCURRENT=${MAX_CONCURRENT:-$DEFAULT_MAX_CONCURRENT}
MAX_QUEUE_SIZE=${MAX_QUEUE_SIZE:-$DEFAULT_MAX_QUEUE_SIZE}
NUM_WORKERS=${NUM_WORKERS:-$DEFAULT_NUM_WORKERS}

# 主流程
main() {
    # 显示标题
    echo ""
    echo "============================================"
    echo "  增强型转发服务启动脚本"
    echo "============================================"
    echo ""

    # 检查依赖
    check_dependencies

    # 验证参数
    validate_params

    # 显示配置
    show_config

    # 检查端口
    check_port "$LISTEN_PORT" "$LISTEN_HOST"

    # 启动服务
    print_info "正在启动增强型转发服务..."

    python3 enhanced_proxy_server.py \
        --target-host "$TARGET_HOST" \
        --target-port "$TARGET_PORT" \
        --listen-host "$LISTEN_HOST" \
        --listen-port "$LISTEN_PORT" \
        --max-concurrent "$MAX_CONCURRENT" \
        --max-queue-size "$MAX_QUEUE_SIZE" \
        --num-workers "$NUM_WORKERS"
}

# 运行主流程
main
