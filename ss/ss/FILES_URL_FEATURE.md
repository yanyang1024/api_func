# 文件列表URL功能说明

## 新增功能概览

API响应现在包含一个 `files_url` 字段，提供了一个可直接在浏览器中访问的URL，用于展示和下载所有生成的文件和图片。

## API响应格式

```json
{
  "success": true,
  "message": "Processing completed!",
  "data": {...},
  "files": [...],
  "images": [...],
  "archive": {...},
  "files_url": "http://localhost:8000/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "error": null
}
```

## 使用方法

### 1. 调用API获取files_url

```python
import requests

response = requests.post("http://localhost:8000/api/function1", json={
    "param1": "test",
    "param2": "analysis",
    "param3": 100,
    "param4": "output",
    "param5": 50
})

result = response.json()

# 获取文件列表URL
files_url = result.get('files_url')
print(f"文件列表页面: {files_url}")
```

### 2. 在浏览器中打开

**方法A: 手动复制URL**
- 从API响应中复制 `files_url` 字段
- 粘贴到浏览器地址栏
- 访问该URL即可查看文件列表页面

**方法B: 使用Python自动打开**
```python
import webbrowser

if files_url:
    webbrowser.open(files_url)
```

## 文件列表页面功能

### 页面布局

1. **头部区域**
   - 标题: "API 输出文件列表"
   - 渐变色背景设计

2. **信息栏**
   - 会话ID（可一键复制）
   - 生成时间
   - 函数名称

3. **压缩包下载区**（高亮显示）
   - 显示压缩包文件名和大小
   - 一键下载完整压缩包按钮
   - 包含所有文件和图片

4. **文件列表区**
   - 卡片式网格布局
   - 每个文件显示：
     - 文件图标
     - 文件名
     - 文件大小
     - 文件类型
     - 下载按钮

5. **图片列表区**
   - 卡片式网格布局
   - 每张图片显示：
     - 图片预览（缩略图）
     - 文件名
     - 图片尺寸
     - 图片格式
     - 下载按钮

6. **页脚**
   - 服务信息
   - 会话ID

### 交互功能

- ✅ **图片预览**: 直接在页面中查看所有生成的图片
- ✅ **单文件下载**: 点击按钮下载单个文件
- ✅ **批量下载**: 一键下载完整压缩包
- ✅ **复制会话ID**: 方便保存和分享
- ✅ **响应式设计**: 支持桌面和移动设备
- ✅ **悬停效果**: 卡片悬停时的动画效果

## 技术实现

### 会话管理

- 每次API调用生成唯一的会话ID（UUID）
- 会话数据存储在服务器内存中
- 包含所有文件的base64编码数据
- 页面加载时从会话存储中读取数据

### 数据传输

- 所有文件数据以base64编码嵌入HTML
- 图片直接在页面中显示（使用data URI）
- 下载功能通过JavaScript的Blob API实现
- 无需额外的文件服务器

### URL格式

```
http://your-host:port/files/{session_id}
```

示例：
```
http://localhost:8000/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## 使用场景

### 场景1: 快速预览结果

```python
import requests
import webbrowser

# 调用API
response = requests.post("http://localhost:8000/api/your_function", json={...})
result = response.json()

# 自动打开浏览器预览
if result.get('files_url'):
    webbrowser.open(result['files_url'])
```

### 场景2: 分享结果

```python
# 将files_url发送给他人
files_url = result['files_url']
print(f"请访问此链接查看结果: {files_url}")
```

### 场景3: 保存会话以便后续访问

```python
# 保存会话ID
session_id = result['files_url'].split('/')[-1]

# 稍后可以通过此URL重新访问
later_url = f"http://localhost:8000/files/{session_id}"
```

## 注意事项

### 会话生命周期

- ⚠️ **会话存储在内存中**
  - 服务重启后所有会话数据会丢失
  - 建议及时下载重要文件

- ⚠️ **会话持久化**
  - 会话在服务运行期间一直有效
  - 可以多次访问同一个files_url

### 性能考虑

- 对于大量文件或大图片，首次加载可能较慢
- 数据全部编码在HTML中，页面体积较大
- 建议压缩包下载用于生产环境

### 安全性

- URL中的会话ID是唯一的访问凭证
- 不建议将包含敏感数据的files_url公开分享
- 生产环境建议添加访问控制

## 完整示例

```python
import requests
import webbrowser
import base64

def process_and_view(url, payload):
    """调用API并在浏览器中查看结果"""

    # 1. 调用API
    response = requests.post(url, json=payload)
    result = response.json()

    if not result['success']:
        print(f"错误: {result['error']}")
        return

    # 2. 显示结果摘要
    print(f"✓ 处理成功: {result['message']}")
    print(f"  文件数量: {len(result['files'])}")
    print(f"  图片数量: {len(result['images'])}")
    print(f"  压缩包: {result['archive']['filename'] if result.get('archive') else '无'}")

    # 3. 获取files_url
    files_url = result.get('files_url')
    if not files_url:
        print("警告: 未生成files_url")
        return

    print(f"\n📎 文件列表页面: {files_url}")

    # 4. 选择操作
    choice = input("\n选择操作:\n1. 在浏览器中打开\n2. 下载压缩包\n3. 两者都做\n> ")

    if choice in ['1', '3']:
        print("\n正在打开浏览器...")
        webbrowser.open(files_url)

    if choice in ['2', '3'] and result.get('archive'):
        # 下载压缩包
        archive_data = result['archive']
        archive_content = base64.b64decode(archive_data['data'])

        with open(archive_data['filename'], 'wb') as f:
            f.write(archive_content)

        print(f"✓ 压缩包已下载: {archive_data['filename']}")

# 使用示例
process_and_view(
    "http://localhost:8000/api/function1",
    {
        "param1": "test_data",
        "param2": "analysis",
        "param3": 100,
        "param4": "output",
        "param5": 50
    }
)
```

## 相关文件

- `api_service.py:340-734` - HTML生成函数
- `api_service.py:765-791` - 文件列表查看端点
- `api_service.py:270-283` - 会话数据存储和URL生成
- `api_service.py:47-56` - APIResponse模型（包含files_url字段）

## 测试

运行测试脚本查看演示：
```bash
python3 test_files_url.py
```

## 页面预览

页面特点：
- 🎨 现代化渐变色设计
- 📱 响应式布局，支持移动端
- 🖼️ 图片缩略图预览
- ⬇️ 一键下载功能
- 📋 会话ID复制功能
- ⚡ 纯前端实现，无需额外依赖
