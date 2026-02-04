# Python函数API封装服务

一个简单易用、高度可扩展的Python函数API封装框架，特别适合将包含CSV文件输出和图片生成的Python函数快速转换为RESTful API服务。

## 核心特性

- **统一的数据传输格式**：CSV文件和图片自动转换为base64编码，便于API传输
- **高度可扩展**：通过装饰器模式，一行代码即可注册新函数
- **类型安全**：基于Pydantic的数据验证和自动类型转换
- **自动文档**：自动生成OpenAPI文档（Swagger UI）
- **灵活适配**：支持不同数量、不同类型的函数参数

## 项目结构

```
.
├── main.py                 # 主应用入口，注册所有函数
├── api_service.py          # API服务核心框架
├── sample_functions.py     # 示例函数（实际使用时替换为你的函数）
├── config.py               # 配置文件
├── requirements.txt        # 依赖包列表
├── .env.example           # 环境变量示例
├── README.md              # 本文档
├── DEPLOYMENT.md          # 部署文档
├── client_example.py      # 客户端调用示例
└── outputs/               # 输出文件目录（自动创建）
```

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 访问API文档

打开浏览器访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 如何集成你的函数

### 步骤1: 准备你的函数

你的函数应该返回如下格式的字典：

```python
from typing import Dict, List
from PIL import Image

def your_function(param1: str, param2: int, ...) -> Dict:
    """
    你的函数说明
    """
    # 你的处理逻辑
    csv_path = "path/to/output.csv"
    images = [Image.new('RGB', (800, 600)), ...]  # PIL图片对象列表

    return {
        "message": "处理完成!",
        "result": {
            "files": [csv_path, "other_file.ppt"],  # 文件路径列表
            "images": images  # PIL图片对象列表
        }
    }
```

### 步骤2: 在main.py中注册函数

打开 `main.py`，添加以下代码：

```python
from api_service import registry
from your_module import your_function

@registry.register("/api/your-endpoint", "your_function_name")
def wrap_your_function(param1: str, param2: int, ...):
    """包装你的函数"""
    return your_function(param1, param2, ...)
```

就这么简单！你的函数已经可以通过API访问了。

## API调用示例

### 使用Python requests

```python
import requests
import base64
from PIL import Image
import io

# 调用API
url = "http://localhost:8000/api/function1"
payload = {
    "param1": "test",
    "param2": "analysis",
    "param3": 100,
    "param4": "output",
    "param5": 50
}

response = requests.post(url, json=payload)
result = response.json()

if result['success']:
    print(f"消息: {result['message']}")

    # 保存CSV文件
    for file_data in result['files']:
        if file_data['data']:  # 检查是否有数据
            file_content = base64.b64decode(file_data['data'])
            with open(f"downloads/{file_data['filename']}", 'wb') as f:
                f.write(file_content)
            print(f"已保存文件: {file_data['filename']}")

    # 保存图片
    for img_data in result['images']:
        img_bytes = base64.b64decode(img_data['data'])
        img = Image.open(io.BytesIO(img_bytes))
        img.save(f"downloads/{img_data['filename']}")
        print(f"已保存图片: {img_data['filename']} ({img_data['size']})")
```

### 使用curl

```bash
curl -X POST "http://localhost:8000/api/function1" \
  -H "Content-Type: application/json" \
  -d '{
    "param1": "test",
    "param2": "analysis",
    "param3": 100,
    "param4": "output",
    "param5": 50
  }'
```

### 使用JavaScript/Node.js

```javascript
const axios = require('axios');
const fs = require('fs');

async function callAPI() {
  try {
    const response = await axios.post('http://localhost:8000/api/function1', {
      param1: 'test',
      param2: 'analysis',
      param3: 100,
      param4: 'output',
      param5: 50
    });

    const result = response.data;

    if (result.success) {
      console.log('消息:', result.message);

      // 保存文件
      result.files.forEach(file => {
        if (file.data) {
          const buffer = Buffer.from(file.data, 'base64');
          fs.writeFileSync(`downloads/${file.filename}`, buffer);
        }
      });

      // 保存图片
      result.images.forEach(img => {
        const buffer = Buffer.from(img.data, 'base64');
        fs.writeFileSync(`downloads/${img.filename}`, buffer);
      });
    }
  } catch (error) {
    console.error('错误:', error);
  }
}

callAPI();
```

## 数据格式说明

### 请求格式

发送JSON格式的POST请求，字段名对应函数参数：

```json
{
  "param1": "string_value",
  "param2": 123,
  "param3": "another_string"
}
```

### 响应格式

统一的JSON响应格式：

```json
{
  "success": true,
  "message": "Processing completed!",
  "data": {
    "files": ["file1.csv", "file2.ppt"],
    "images": [...]
  },
  "files": [
    {
      "filename": "output.csv",
      "content_type": "application/octet-stream",
      "size": 12345,
      "data": "base64编码的文件内容"
    }
  ],
  "images": [
    {
      "filename": "image_1.png",
      "format": "PNG",
      "size": "800x600",
      "data": "base64编码的图片数据"
    }
  ],
  "error": null
}
```

## 扩展性设计

### 添加新函数

只需要3步：

1. **编写或导入你的函数**
2. **在main.py中注册**
3. **重启服务**

无需修改任何框架代码！

### 支持的参数类型

- str
- int
- float
- bool
- List
- Dict
- 可选参数（带默认值）

## API端点

### 系统端点

- `GET /` - 服务信息和函数列表
- `GET /functions` - 列出所有可用函数
- `GET /health` - 健康检查
- `GET /docs` - Swagger UI文档

### 函数端点

- `POST /api/function1` - 执行函数1
- `POST /api/function2` - 执行函数2
- `POST /api/function3` - 执行函数3
- `POST /api/function4` - 执行函数4
- `POST /api/function5` - 执行函数5
- `POST /api/function6` - 执行函数6

## 配置

编辑 `.env` 文件或环境变量：

```bash
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
OUTPUT_DIR=outputs
LOG_LEVEL=info
```

## 常见问题

### Q: 如何处理大文件？
A: 当前方案使用base64编码，适合中小文件。对于大文件(>10MB)，建议：
- 使用分块传输
- 改用文件URL返回
- 实现异步任务队列

### Q: 如何添加身份验证？
A: 在 `api_service.py` 中添加FastAPI的依赖注入：
```python
from fastapi.security import APIKeyHeader

API_KEY = "your-secret-key"
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")
```

### Q: 支持异步函数吗？
A: 支持！将函数定义为 `async def` 即可。

## 技术栈

- **FastAPI**: 现代、高性能的Web框架
- **Pydantic**: 数据验证和序列化
- **Pillow**: 图片处理
- **Pandas**: CSV数据处理
- **Uvicorn**: ASGI服务器

## 许可证

MIT License

## 支持

如有问题，请查看：
1. API文档: http://localhost:8000/docs
2. 部署文档: [DEPLOYMENT.md](DEPLOYMENT.md)
3. 客户端示例: [client_example.py](client_example.py)
