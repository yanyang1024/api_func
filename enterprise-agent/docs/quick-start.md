# 企业内网Agent - 快速上手指南

## 一分钟入门

```bash
# 1. 安装依赖
npm install

# 2. 复制配置
cp config.example.yaml config.yaml

# 3. 启动对话
ent-agent chat
```

就这么简单！现在你可以与企业内网Agent进行对话了。

## 环境要求

- Node.js 20+
- 本地Ollama服务
- 2GB可用内存（运行模型）

## 安装步骤

### 第一步：安装Node.js

从 [nodejs.org](https://nodejs.org) 下载并安装Node.js 20或更高版本。

验证安装：
```bash
node --version  # 应显示 v20.x.x
npm --version   # 应显示 10.x.x
```

### 第二步：安装Ollama

**Linux/macOS：**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows：**
从 [ollama.ai/download](https://ollama.ai/download) 下载安装包。

启动Ollama服务：
```bash
ollama serve
```

### 第三步：拉取模型

```bash
# 主模型（用于对话）
ollama pull qwen2.5:7b

# 嵌入模型（用于搜索）
ollama pull nomic-embed-text:latest

# 查看已安装模型
ollama list
```

### 第四步：安装项目依赖

```bash
cd enterprise-agent
npm install
```

### 第五步：配置项目

```bash
cp config.example.yaml config.yaml
```

编辑 `config.yaml`：

```yaml
ollama:
  host: http://localhost:11434  # Ollama地址
  model: qwen2.5:7b             # 使用的主模型

storage:
  dataDir: ./data               # 数据存储目录
  sessionDir: ./data/sessions   # 会话存储目录

services:
  database:
    type: sqlite
    database: ./data/enterprise.db
```

## 启动服务

### 开发模式（推荐）

```bash
npm run dev
```

### 生产模式

```bash
npm run build
npm start
```

### 检查状态

```bash
ent-agent status
```

输出示例：
```
=== 系统状态 ===
Ollama服务: ✓ 就绪
可用模型: qwen2.5:7b
```

## 基本使用

### 交互式对话

```bash
ent-agent chat
```

在对话中可以使用以下命令：
- `/exit` - 退出对话
- `/new` - 开始新会话
- `/history` - 查看会话列表
- `/session <id>` - 切换会话

### 单次请求

```bash
ent-agent ask "你好，请帮我查询今天的销售数据"
```

### 指定模型

```bash
ent-agent chat --model llama3.2
ent-agent ask "分析这份数据" --model llama3.2
```

## 会话管理

### 查看所有会话

```bash
ent-agent sessions
```

输出示例：
```
=== 会话列表 ===

会话: abc123-xxx
  Agent: default
  消息数: 15
  最后活跃: 2024-01-15 14:30:00
```

### 查看会话详情

```bash
ent-agent session abc123-xxx
```

### 清除会话

```bash
# 清除指定会话
ent-agent clear abc123-xxx

# 清除所有会话
ent-agent clear
```

## 常用操作

### 文件操作

在对话中直接使用：
```
请读取 config.yaml 文件的内容
帮我创建一个新文件 test.txt
列出当前目录下的文件
```

### 数据库查询

```
查询用户表的所有数据
统计今天的订单数量
```

### 任务管理

```
创建一个任务：完成季度报告
列出我的待办任务
标记任务已完成
```

### 搜索文档

```
搜索包含"项目计划"的文档
查找技术规范文档
```

## 故障排除

### Ollama连接失败

```bash
# 检查Ollama是否运行
curl http://localhost:11434/api/tags

# 重启Ollama服务
ollama serve
```

### 模型加载失败

```bash
# 重新拉取模型
ollama pull qwen2.5:7b

# 查看模型列表
ollama list
```

### 端口被占用

修改 `config.yaml` 中的端口配置：
```yaml
services:
  file:
    baseDir: ./data/files  # 避免使用被占用的目录
```

### 权限错误

```bash
# 确保数据目录有写权限
chmod -R 755 ./data
```

## 下一步

- 查看 [完整文档](./development.md) 了解高级功能
- 学习如何 [添加自定义工具](./development.md#添加自定义工具)
- 了解如何 [集成新服务](./development.md#集成新服务)

## 获取帮助

```bash
# 查看所有命令
ent-agent --help

# 查看特定命令帮助
ent-agent chat --help
```
