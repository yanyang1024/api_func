# 如何将你的函数集成到API服务

## 概述

这个指南将一步步教你如何将现有的Python函数集成到API服务中。

## 前提条件

你的函数应该满足以下条件：

1. ✅ 接受字符串或整型参数
2. ✅ 返回包含CSV文件路径和PIL图片的字典
3. ✅ 返回格式如下：

```python
{
    "message": "处理完成",
    "result": {
        "files": ["file1.csv", "file2.ppt", ...],
        "images": [PIL_Image对象1, PIL_Image对象2, ...]
    }
}
```

## 集成步骤

### 第1步: 准备你的函数文件

假设你的函数在 `my_functions.py` 中：

```python
# my_functions.py
import pandas as pd
from PIL import Image, ImageDraw
from typing import Dict

def my_analysis_function(
    data_source: str,
    year: int,
    category: str,
    threshold: int,
    output_type: str
) -> Dict:
    """
    我的数据分析函数
    """
    # 1. 处理数据
    data = {
        'source': [data_source] * 10,
        'year': [year] * 10,
        'value': range(10)
    }
    df = pd.DataFrame(data)

    # 2. 保存CSV
    import os
    os.makedirs("outputs", exist_ok=True)
    csv_path = f"outputs/{data_source}_{year}.csv"
    df.to_csv(csv_path, index=False)

    # 3. 生成图片
    img = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img)
    draw.text((10, 10), f"Analysis: {data_source}", fill='black')

    # 4. 返回结果
    return {
        "message": f"分析完成: {data_source}",
        "result": {
            "files": [csv_path, f"outputs/report_{year}.ppt"],
            "images": [img]
        }
    }
```

### 第2步: 在main.py中注册函数

打开 `main.py`，添加以下内容：

```python
# main.py
from api_service import registry
from sample_functions import (
    function_1, function_2, function_3,
    function_4, function_5, function_6
)

# ========== 导入你的函数 ==========
from my_functions import my_analysis_function

# ========== 注册你的函数 ==========
@registry.register("/api/my-analysis", "my_analysis_function")
def wrap_my_analysis(
    data_source: str,
    year: int,
    category: str,
    threshold: int,
    output_type: str
):
    """数据分析API - 处理各种数据源"""
    return my_analysis_function(data_source, year, category, threshold, output_type)

# 保留原有的示例函数...
@registry.register("/api/function1", "function_1")
def wrap_function_1(param1: str, param2: str, param3: int, param4: str, param5: int):
    return function_1(param1, param2, param3, param4, param5)

# ... 其他函数
```

### 第3步: 测试你的函数

```bash
# 启动服务
python main.py

# 在另一个终端测试
curl -X POST "http://localhost:8000/api/my-analysis" \
  -H "Content-Type: application/json" \
  -d '{
    "data_source": "sales_data",
    "year": 2024,
    "category": "electronics",
    "threshold": 100,
    "output_type": "detailed"
  }'
```

或使用Python：

```python
import requests

response = requests.post(
    "http://localhost:8000/api/my-analysis",
    json={
        "data_source": "sales_data",
        "year": 2024,
        "category": "electronics",
        "threshold": 100,
        "output_type": "detailed"
    }
)

result = response.json()
print(result)
```

## 多个函数的集成示例

假设你有6个类似的函数：

### 你的函数文件

```python
# my_functions.py
from typing import Dict
from PIL import Image
import pandas as pd

def function_a(name: str, count: int, threshold: int, filter: str, batch: int) -> Dict:
    """函数A - 5个参数"""
    # 你的实现
    return {
        "message": "Function A completed",
        "result": {
            "files": ["output_a.csv"],
            "images": [Image.new('RGB', (800, 600))]
        }
    }

def function_b(name: str, count: int, threshold: int, filter: str, batch: int, extra: int) -> Dict:
    """函数B - 6个参数"""
    # 你的实现
    return {
        "message": "Function B completed",
        "result": {
            "files": ["output_b.csv"],
            "images": [Image.new('RGB', (800, 600))]
        }
    }

def function_c(source: str, target: str, limit: int, offset: int, format: str) -> Dict:
    """函数C - 5个参数，不同命名"""
    # 你的实现
    return {
        "message": "Function C completed",
        "result": {
            "files": ["output_c.csv"],
            "images": [Image.new('RGB', (800, 600))]
        }
    }

# ... function_d, function_e, function_f
```

### 在main.py中批量注册

```python
# main.py
from api_service import registry
from my_functions import (
    function_a, function_b, function_c,
    function_d, function_e, function_f
)

# 函数A (5个参数)
@registry.register("/api/func-a", "function_a")
def wrap_function_a(name: str, count: int, threshold: int, filter: str, batch: int):
    """执行函数A"""
    return function_a(name, count, threshold, filter, batch)

# 函数B (6个参数)
@registry.register("/api/func-b", "function_b")
def wrap_function_b(name: str, count: int, threshold: int, filter: str, batch: int, extra: int):
    """执行函数B"""
    return function_b(name, count, threshold, filter, batch, extra)

# 函数C (5个参数)
@registry.register("/api/func-c", "function_c")
def wrap_function_c(source: str, target: str, limit: int, offset: int, format: str):
    """执行函数C"""
    return function_c(source, target, limit, offset, format)

# 函数D, E, F... 同样的方式注册
```

## 参数类型转换

框架会自动处理以下类型：

| Python类型 | JSON类型 | 示例 |
|-----------|---------|------|
| str | string | `"hello"` |
| int | number | `123` |
| float | number | `3.14` |
| bool | boolean | `true` |
| List[str] | array | `["a", "b"]` |
| Dict[str, int] | object | `{"a": 1}` |

## 处理可选参数

如果你的函数有可选参数：

```python
def my_function(required_param: str, optional_param: int = 10) -> Dict:
    return {
        "message": "Done",
        "result": {
            "files": ["output.csv"],
            "images": []
        }
    }
```

注册时保持一致：

```python
@registry.register("/api/my-func", "my_function")
def wrap_my_function(required_param: str, optional_param: int = 10):
    return my_function(required_param, optional_param)
```

客户端可以选择性传递：

```python
# 只传必需参数
requests.post("http://localhost:8000/api/my-func", json={
    "required_param": "test"
})

# 传所有参数
requests.post("http://localhost:8000/api/my-func", json={
    "required_param": "test",
    "optional_param": 20
})
```

## 调试技巧

### 1. 查看自动生成的API文档

启动服务后访问: http://localhost:8000/docs

### 2. 查看所有已注册函数

```bash
curl http://localhost:8000/functions
```

### 3. 使用测试脚本

```bash
python test_api.py
```

### 4. 添加日志

在你的函数中添加日志：

```python
import logging

logger = logging.getLogger(__name__)

def my_function(param1: str, param2: int):
    logger.info(f"执行函数: param1={param1}, param2={param2}")
    # 你的代码...
```

## 常见问题

### Q1: 我的函数返回格式不一样

**问题**: 你的函数返回格式不匹配标准格式。

**解决**: 创建一个包装函数：

```python
def my_original_function(param1, param2):
    # 你的原始函数
    return {
        "status": "success",
        "csv_path": "output.csv",
        "charts": [img1, img2]
    }

def wrapper_function(param1, param2):
    # 包装器 - 转换格式
    result = my_original_function(param1, param2)

    return {
        "message": result["status"],
        "result": {
            "files": [result["csv_path"]],
            "images": result["charts"]
        }
    }

# 注册包装函数
@registry.register("/api/my-func", "my_function")
def wrap_my_function(param1: str, param2: int):
    return wrapper_function(param1, param2)
```

### Q2: 函数执行时间很长

**解决**: 使用异步函数：

```python
async def my_long_function(param1: str):
    # 长时间运行的任务
    await asyncio.sleep(10)  # 模拟耗时操作
    return {"message": "Done", "result": {"files": [], "images": []}}

# 注册异步函数
@registry.register("/api/long-func", "long_function")
async def wrap_long_function(param1: str):
    return await my_long_function(param1)
```

### Q3: 需要传递文件

**解决**: 使用FastAPI的UploadFile：

```python
from fastapi import UploadFile, File

@app.post("/api/process-file")
async def process_file(file: UploadFile = File(...)):
    content = await file.read()
    # 处理文件内容...
    return {"success": True}
```

### Q4: 如何处理错误

**解决**: 在函数中使用try-except：

```python
def my_function(param1: str):
    try:
        # 你的处理逻辑
        if some_error:
            raise ValueError("参数错误")

        return {
            "message": "成功",
            "result": {"files": [], "images": []}
        }

    except Exception as e:
        return {
            "message": f"错误: {str(e)}",
            "result": {"files": [], "images": []}
        }
```

## 性能优化建议

### 1. 使用缓存

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def expensive_operation(param: str):
    # 耗时操作
    return result
```

### 2. 批量处理

```python
def batch_process(items: list):
    results = []
    for item in items:
        result = process_item(item)
        results.append(result)
    return results
```

### 3. 使用连接池

如果使用数据库，使用连接池：

```python
import psycopg2_pool
pool = psycopg2_pool.SimpleConnectionPool(1, 10, dsn)
```

## 安全建议

### 1. 验证输入

```python
def my_function(data_path: str):
    # 验证路径，防止路径遍历攻击
    if not data_path.startswith("allowed/"):
        raise ValueError("Invalid path")
```

### 2. 限制资源使用

```python
import resource

def set_limits():
    resource.setrlimit(resource.RLIMIT_AS, (1 * 1024 * 1024 * 1024, -1))  # 1GB
```

### 3. 清理临时文件

```python
import tempfile
import os

def my_function():
    fd, path = tempfile.mkstemp()
    try:
        # 使用文件
        pass
    finally:
        # 清理
        os.close(fd)
        os.unlink(path)
```

## 完整示例

查看以下文件获取完整示例：

- `main.py` - 函数注册示例
- `sample_functions.py` - 6个不同参数的函数示例
- `client_example.py` - 客户端调用示例
- `test_api.py` - 测试示例

## 总结

集成你的函数只需要3步：

1. **准备函数** - 确保返回格式正确
2. **注册函数** - 在main.py中添加@registry.register装饰器
3. **测试** - 使用curl或Python客户端测试

就这么简单！

需要帮助？查看 `QUICKSTART.md` 或 `README.md`。
