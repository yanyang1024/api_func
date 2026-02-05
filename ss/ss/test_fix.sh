#!/bin/bash
# 快速测试修复后的服务

echo "========================================"
echo "  测试增强型转发服务修复"
echo "========================================"
echo ""

# 检查Python版本
echo "1. 检查Python环境..."
python3 --version
echo ""

# 检查FastAPI版本
echo "2. 检查FastAPI版本..."
python3 -c "import fastapi; print(f'FastAPI版本: {fastapi.__version__}')" 2>/dev/null || {
    echo "✗ FastAPI未安装"
}
echo ""

# 检查httpx是否安装
echo "3. 检查依赖..."
python3 -c "import httpx; print('✓ httpx已安装')" 2>/dev/null || {
    echo "✗ httpx未安装"
    echo "  请运行: pip install httpx"
}
echo ""

# 测试导入
echo "4. 测试代码导入..."
python3 -c "from enhanced_proxy_server import app; print('✓ 代码导入成功')" 2>&1 | head -20
echo ""

echo "========================================"
echo "  修复验证完成"
echo "========================================"
echo ""
echo "如果以上测试都通过，可以启动服务："
echo ""
echo "启动命令示例："
echo "  python3 enhanced_proxy_server.py \\"
echo "    --target-host 10.20.52.238 \\"
echo "    --target-port 8901 \\"
echo "    --listen-port 8081"
echo ""
