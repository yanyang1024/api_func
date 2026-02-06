# 文件服务器API

基于Flask的文件操作API服务，支持txt和markdown文件的读写创建。

## 安装依赖

```bash
pip install flask
```

## 启动服务

```bash
python file_server.py
```

服务将在 `http://0.0.0.0:5000` 启动

## API接口

### 1. 列出目录内容
- **端点**: `GET /api/files`
- **参数**: `path` - 相对路径（可选，默认为根目录）
- **示例**: `GET http://localhost:5000/api/files?path=documents`

### 2. 读取文件
- **端点**: `GET /api/read`
- **参数**: `path` - 文件相对路径
- **示例**: `GET http://localhost:5000/api/read?path=notes/hello.txt`

### 3. 写入/创建文件
- **端点**: `POST /api/write`
- **请求体** (JSON):
  ```json
  {
    "path": "notes/hello.txt",
    "content": "文件内容"
  }
  ```
- **示例**:
```bash
curl -X POST http://localhost:5000/api/write \
  -H "Content-Type: application/json" \
  -d '{"path": "notes/hello.txt", "content": "Hello World"}'
```

### 4. 创建新文件
- **端点**: `POST /api/create`
- **请求体** (JSON):
  ```json
  {
    "path": "notes/new.md",
    "content": "# 新文件"
  }
  ```
- **示例**:
```bash
curl -X POST http://localhost:5000/api/create \
  -H "Content-Type: application/json" \
  -d '{"path": "notes/new.md", "content": "# 新文件"}'
```

### 5. 删除文件/目录
- **端点**: `DELETE /api/delete`
- **参数**: `path` - 相对路径
- **示例**: `DELETE http://localhost:5000/api/delete?path=notes/hello.txt`

### 6. 获取文件信息
- **端点**: `GET /api/info`
- **参数**: `path` - 相对路径
- **示例**: `GET http://localhost:5000/api/info?path=notes/hello.txt`

## 支持的文件类型

- `.txt` - 文本文件
- `.md` - Markdown文件

## 文件存储位置

所有文件存储在服务目录下的 `files` 文件夹中。

## 响应格式

所有接口返回JSON格式数据，成功响应示例：
```json
{
  "message": "File written successfully",
  "path": "notes/hello.txt",
  "size": 11
}
```

错误响应示例：
```json
{
  "error": "File not found"
}
```

## 安全性说明

- 路径访问限制在 `files` 目录内
- 不支持路径遍历（`../`）
- 仅支持txt和md文件格式
