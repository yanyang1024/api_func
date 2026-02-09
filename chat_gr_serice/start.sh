#!/bin/bash
# 启动脚本

echo "======================================"
echo "  智能对话工作流系统 - 启动中..."
echo "======================================"

# 检查Python环境
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到Python3"
    exit 1
fi

# 检查依赖
echo "📦 检查依赖..."
pip install -r requirements.txt -q

# 启动应用
echo "🚀 启动应用..."
python3 app.py
