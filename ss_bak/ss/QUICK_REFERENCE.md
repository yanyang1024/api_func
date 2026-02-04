# 快速参考指南 - 修复后的 API 使用

## 问题已解决 ✓

### 1. PIL 图片对象 JSON 序列化错误
**状态**: ✓ 已修复
- 之前: `object of type PngImageFile is not json serializable`
- 现在: 自动将 PIL 图片对象转换为 base64 编码

### 2. 空字符串路径容错
**状态**: ✓ 已实现
- 空字符串 `""` 自动跳过
- 不存在的文件返回空 base64（不报错）

### 3. 压缩包下载
**状态**: ✓ 已实现
- 所有文件和图片自动打包成 ZIP
- 通过 API 响应的 `archive` 字段提供

## 你的函数应该这样写

```python
from typing import Dict
from PIL import Image

def your_inline_compare_function(...) -> Dict:
    """
    你的 Inline Compare 函数
    """
    # 生成文件（可能有些文件不存在，返回空字符串即可）
    ppt_file_path = "/path/to/ppt.ppt"  # 或者 ""
    test_csv_path = "/path/to/test.csv"
    rawdata_csv_path = ""  # 空字符串会被自动处理

    # 生成图片（PIL Image 对象）
    images = [
        Image.new('RGB', (2000, 1000)),  # 你的图片
        # ... 更多图片
    ]

    # 返回这个格式
    return {
        "message": "Inline compare Processing completed!",
        "result": {
            "files": [ppt_file_path, test_csv_path, rawdata_csv_path],  # 可以包含空字符串
            "images": images  # PIL 图片对象列表
        }
    }
```

## API 响应格式

```json
{
  "success": true,
  "message": "Inline compare Processing completed!",
  "data": {
    "files": [...],
    "images": [...]
  },
  "files": [
    {
      "filename": "test.csv",
      "content_type": "application/octet-stream",
      "size": 1234,
      "data": "base64编码的数据..."
    }
  ],
  "images": [
    {
      "filename": "image_1.png",
      "format": "PNG",
      "size": "2000x1000",
      "data": "base64编码的图片..."
    }
  ],
  "archive": {
    "filename": "function_name_output.zip",
    "content_type": "application/zip",
    "size": 5678,
    "data": "base64编码的压缩包..."
  },
  "error": null
}
```

## 客户端使用示例

### Python 客户端

```python
import requests
import base64

# 调用 API
url = "http://localhost:8000/api/your_endpoint"
response = requests.post(url, json={
    "param1": "value1",
    "param2": "value2",
    # ... 其他参数
})

result = response.json()

# 方式1: 下载压缩包（推荐）
if result.get('archive'):
    archive_data = result['archive']
    archive_content = base64.b64decode(archive_data['data'])

    with open(archive_data['filename'], 'wb') as f:
        f.write(archive_content)

    print(f"✓ 已下载压缩包: {archive_data['filename']}")

# 方式2: 分别下载文件和图片
for file_data in result.get('files', []):
    if file_data.get('data'):
        file_content = base64.b64decode(file_data['data'])
        with open(file_data['filename'], 'wb') as f:
            f.write(file_content)

for img_data in result.get('images', []):
    img_bytes = base64.b64decode(img_data['data'])
    with open(img_data['filename'], 'wb') as f:
        f.write(img_bytes)
```

### JavaScript/Node.js 客户端

```javascript
const axios = require('axios');
const fs = require('fs');

async function callAPI() {
  const response = await axios.post('http://localhost:8000/api/your_endpoint', {
    param1: 'value1',
    param2: 'value2'
  });

  const result = response.data;

  // 下载压缩包
  if (result.archive) {
    const buffer = Buffer.from(result.archive.data, 'base64');
    fs.writeFileSync(result.archive.filename, buffer);
    console.log(`✓ 已下载压缩包: ${result.archive.filename}`);
  }

  // 或者分别下载
  result.files.forEach(file => {
    if (file.data) {
      const buffer = Buffer.from(file.data, 'base64');
      fs.writeFileSync(file.filename, buffer);
    }
  });

  result.images.forEach(img => {
    const buffer = Buffer.from(img.data, 'base64');
    fs.writeFileSync(img.filename, buffer);
  });
}
```

## 测试

运行测试脚本验证修复：

```bash
cd /home/yy/ss
python3 test_fixes.py
```

预期输出：
```
==============================================================
修复功能测试
==============================================================
...
所有测试通过! ✓
```

## 关键代码位置

- **核心处理逻辑**: `api_service.py:94-135` (process_function_result)
- **压缩包创建**: `api_service.py:141-192` (create_zip_archive)
- **API 响应模型**: `api_service.py:46-54` (APIResponse)
- **API 端点**: `api_service.py:232-287` (register_api_endpoint)

## 容错特性

1. **空字符串路径**: 自动跳过，不会报错
2. **不存在的文件**: 返回空 base64 数据
3. **PIL 图片对象**: 自动转换为 base64
4. **压缩包失败**: 不影响主流程，只打印警告

## 注意事项

- 所有修改向后兼容
- 压缩包字段是可选的
- 客户端可以选择下载压缩包或单独下载文件
- base64 编码会增大约 33% 的体积

## 获取帮助

- 查看详细文档: `MODIFICATIONS.md`
- 查看示例代码: `client_example.py`
- 运行测试: `python3 test_fixes.py`
- API 文档: http://localhost:8000/docs
