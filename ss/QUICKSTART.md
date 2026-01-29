# 快速入门指南

本指南将在5分钟内帮助你快速上手Python函数API封装服务。

## 第一步: 环境准备 (1分钟)

### 安装依赖

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate     # Windows

# 安装依赖包
pip install -r requirements.txt
```

## 第二步: 启动服务 (30秒)

```bash
python main.py
```

看到以下输出表示启动成功：

```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 第三步: 测试API (1分钟)

### 方法1: 使用浏览器

1. 打开浏览器访问: http://localhost:8000/docs
2. 你会看到自动生成的API文档界面
3. 展开任一端点（如 `/api/function1`）
4. 点击 "Try it out"
5. 填入参数，点击 "Execute"
6. 查看响应结果

### 方法2: 使用curl

```bash
curl -X POST "http://localhost:8000/api/function1" \
  -H "Content-Type: application/json" \
  -d '{
    "param1": "test",
    "param2": "demo",
    "param3": 100,
    "param4": "output",
    "param5": 50
  }'
```

### 方法3: 使用Python客户端

```bash
# 在另一个终端运行
python client_example.py
```

## 第四步: 集成你的函数 (2分钟)

### 场景: 你有一个现有的Python函数

```python
# your_functions.py
from PIL import Image
import pandas as pd

def analyze_data(data_source: str, threshold: int, output_format: str):
    """
    数据分析函数
    """
    # 你的处理逻辑
    df = pd.DataFrame({'col1': [1, 2, 3]})
    csv_path = f"outputs/{data_source}.csv"
    df.to_csv(csv_path, index=False)

    # 生成图片
    img = Image.new('RGB', (800, 600), color='blue')

    return {
        "message": "Analysis completed!",
        "result": {
            "files": [csv_path, "report.ppt"],
            "images": [img]
        }
    }
```

### 注册到API服务

1. 在 `main.py` 中导入：

```python
from your_functions import analyze_data
```

2. 注册函数：

```python
@registry.register("/api/analyze", "analyze_data")
def wrap_analyze_data(data_source: str, threshold: int, output_format: str):
    """数据分析API"""
    return analyze_data(data_source, threshold, output_format)
```

3. 重启服务：

```bash
# Ctrl+C 停止服务
python main.py  # 重新启动
```

4. 访问新端点: http://localhost:8000/api/analyze

## 第五步: 在你的应用中调用 (30秒)

### Python示例

```python
import requests
import base64
from PIL import Image
import io

# 调用API
response = requests.post(
    "http://localhost:8000/api/function1",
    json={
        "param1": "my_data",
        "param2": "report",
        "param3": 100,
        "param4": "output",
        "param5": 50
    }
)

result = response.json()

if result['success']:
    # 保存CSV
    csv_data = base64.b64decode(result['files'][0]['data'])
    with open('output.csv', 'wb') as f:
        f.write(csv_data)

    # 保存图片
    img_data = base64.b64decode(result['images'][0]['data'])
    img = Image.open(io.BytesIO(img_data))
    img.save('output.png')

    print("处理完成!")
```

## 常用命令速查

```bash
# 启动服务
python main.py

# 或使用uvicorn（更灵活）
uvicorn main:app --reload --port 8000

# 查看所有函数
curl http://localhost:8000/functions

# 健康检查
curl http://localhost:8000/health

# 查看API文档
# 浏览器访问 http://localhost:8000/docs
```

## 项目结构说明

```
.
├── main.py              # 【重点】在这里注册你的函数
├── api_service.py       # 核心框架（一般不需要修改）
├── sample_functions.py  # 示例函数（可以替换为你的函数）
├── client_example.py    # 客户端调用示例
└── outputs/             # 输出目录（自动创建）
```

## 支持的函数参数类型

- ✅ 字符串 (str)
- ✅ 整数 (int)
- ✅ 浮点数 (float)
- ✅ 布尔值 (bool)
- ✅ 可选参数（带默认值）
- ✅ 列表 (List)
- ✅ 字典 (Dict)

## 返回数据格式

所有文件和图片都会自动转换为base64编码，方便传输：

```json
{
  "success": true,
  "message": "Processing completed!",
  "files": [
    {
      "filename": "data.csv",
      "content_type": "application/octet-stream",
      "size": 1234,
      "data": "base64编码的内容..."
    }
  ],
  "images": [
    {
      "filename": "chart.png",
      "format": "PNG",
      "size": "800x600",
      "data": "base64编码的图片..."
    }
  ]
}
```

## 下一步

- 📖 阅读完整文档: [README.md](README.md)
- 🚀 学习部署: [DEPLOYMENT.md](DEPLOYMENT.md)
- 💡 查看更多示例: [client_example.py](client_example.py)

## 需要帮助？

1. 查看自动生成的API文档: http://localhost:8000/docs
2. 检查函数列表: http://localhost:8000/functions
3. 健康检查: http://localhost:8000/health

## 常见问题

**Q: 如何修改端口？**
A: 编辑 `.env` 文件，设置 `API_PORT=9000`

**Q: 如何添加更多函数？**
A: 在 `main.py` 中用 `@registry.register()` 装饰器注册

**Q: 支持异步函数吗？**
A: 支持！使用 `async def` 定义函数即可

**Q: 如何处理大文件？**
A: 对于大文件，建议使用文件URL而不是base64编码

**Q: 可以部署到生产环境吗？**
A: 可以！参考 [DEPLOYMENT.md](DEPLOYMENT.md) 了解部署方案

---

恭喜！你已经学会了如何使用Python函数API封装服务。
