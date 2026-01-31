#!/bin/bash
# Local Agent 快速启动脚本

set -e

echo "========================================"
echo "  Local Agent - 快速启动"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低 (需要 >= 18.0.0)"
    echo "当前版本: $(node -v)"
    exit 1
fi

echo "✓ Node.js: $(node -v)"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 错误: 未找到 npm"
    exit 1
fi

echo "✓ npm: $(npm -v)"
echo ""

# 检查 Ollama
if ! command -v ollama &> /dev/null; then
    echo "⚠️  警告: 未找到 Ollama"
    echo "请先安装 Ollama: https://ollama.ai/"
    echo ""
    read -p "是否继续？(y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Ollama: $(ollama -v)"
fi

echo ""

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    echo "✓ 依赖安装完成"
    echo ""
fi

# 检查 Ollama 是否运行
echo "🔍 检查 Ollama 服务..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama 正在运行"
    echo ""

    # 检查模型
    echo "🔍 检查已安装的模型..."
    MODELS=$(ollama list 2>/dev/null | grep -o "[a-z0-9]*:[0-9.]*" || echo "")

    if [ -z "$MODELS" ]; then
        echo "⚠️  未找到已安装的模型"
        echo "建议安装: llama3.1:8b"
        echo ""
        read -p "是否现在安装 llama3.1:8b? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📥 正在下载 llama3.1:8b (约 4.7GB)..."
            ollama pull llama3.1:8b
            echo "✓ 模型安装完成"
        fi
    else
        echo "✓ 已安装的模型:"
        echo "$MODELS" | while read -r model; do
            echo "  - $model"
        done
    fi
else
    echo "⚠️  Ollama 未运行"
    echo "请在新终端运行: ollama serve"
    echo ""
    read -p "按 Enter 继续..."
fi

echo ""
echo "========================================"
echo "  准备就绪！"
echo "========================================"
echo ""
echo "启动选项:"
echo "  1. 交互式模式:     node cli.js"
echo "  2. 运行测试:       node examples/basic-test.js"
echo "  3. 启动服务:       node cli.js services"
echo "  4. 查看帮助:       node cli.js help"
echo ""
echo "文档:"
echo "  - 学习文档: docs/LEARNING.md"
echo "  - 使用文档: docs/USAGE.md"
echo ""
echo "========================================"
