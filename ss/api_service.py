"""
FastAPI服务核心模块
提供统一的API封装和数据处理
"""
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse, HTMLResponse
from pydantic import BaseModel, create_model
from typing import Dict, List, Optional, Any, Union
from PIL import Image
import io
import base64
import pandas as pd
import inspect
import os
import zipfile
import tempfile
from datetime import datetime
from functools import wraps
import uuid
import fastapi


app = FastAPI(
    title="Data Processing API Service",
    description="统一的Python函数API封装服务",
    version="1.0.0"
)


# ==================== 数据模型定义 ====================

class Base64Image(BaseModel):
    """图片的base64编码模型"""
    filename: str
    format: str
    size: str
    data: str  # base64编码的图片数据


class Base64File(BaseModel):
    """文件的base64编码模型"""
    filename: str
    content_type: str
    size: int
    data: str  # base64编码的文件内容


class APIResponse(BaseModel):
    """统一API响应格式"""
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None
    files: List[Base64File] = []
    images: List[Base64Image] = []
    archive: Optional[Base64File] = None  # 压缩包文件
    files_url: Optional[str] = None  # 文件列表展示页面URL
    error: Optional[str] = None


# ==================== 工具函数 ====================

def image_to_base64(image: Image.Image, filename: str = "image.png") -> Base64Image:
    """将PIL图片转换为base64编码"""
    img_buffer = io.BytesIO()
    image.save(img_buffer, format='PNG')
    img_buffer.seek(0)

    img_base64 = base64.b64encode(img_buffer.read()).decode('utf-8')

    return Base64Image(
        filename=filename,
        format=image.format or 'PNG',
        size=f"{image.width}x{image.height}",
        data=img_base64
    )


def file_to_base64(filepath: str) -> Base64File:
    """将文件转换为base64编码"""
    if not os.path.exists(filepath):
        # 如果文件不存在，返回空的base64
        return Base64File(
            filename=filepath,
            content_type="text/plain",
            size=0,
            data=""
        )

    with open(filepath, 'rb') as f:
        file_content = f.read()
        file_base64 = base64.b64encode(file_content).decode('utf-8')

    return Base64File(
        filename=os.path.basename(filepath),
        content_type="application/octet-stream",
        size=len(file_content),
        data=file_base64
    )


def process_function_result(result: Dict) -> Dict:
    """
    处理函数返回结果，统一转换为API响应格式
    """
    message = result.get("message", "Processing completed!")
    result_data = result.get("result", {})
    file_paths = result_data.get("files", [])
    images = result_data.get("images", [])

    # 处理图片 - 支持PIL图片对象和已经是base64字典的图片
    base64_images = []
    for i, img in enumerate(images):
        if isinstance(img, Image.Image):
            # 如果是PIL图片对象，转换为base64
            base64_images.append(
                image_to_base64(img, f"image_{i+1}.png")
            )
        elif isinstance(img, dict):
            # 如果已经是字典格式（包含data字段），直接使用
            if 'data' in img:
                base64_images.append(img)
            else:
                # 如果是其他格式的字典，尝试转换
                try:
                    base64_images.append(Base64Image(**img))
                except:
                    pass

    # 处理文件 - 添加空字符串容错处理
    base64_files = []
    for filepath in file_paths:
        # 跳过空字符串或None
        if not filepath or not isinstance(filepath, str) or filepath.strip() == "":
            continue
        base64_files.append(file_to_base64(filepath))

    return {
        "message": message,
        "files": base64_files,
        "images": base64_images,
        "raw_data": result_data
    }


def create_zip_archive(file_paths: List[str], images: List[Base64Image], zip_name: str = None) -> Base64File:
    """
    将所有文件和图片打包成ZIP压缩包

    Args:
        file_paths: 文件路径列表
        images: Base64Image对象列表
        zip_name: 压缩包名称（可选）

    Returns:
        Base64File对象，包含压缩包的base64编码
    """
    # 创建临时文件
    temp_fd, temp_path = tempfile.mkstemp(suffix='.zip')
    os.close(temp_fd)

    try:
        with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # 添加文件
            for filepath in file_paths:
                if not filepath or not os.path.exists(filepath):
                    continue

                filename = os.path.basename(filepath)
                zipf.write(filepath, filename)

            # 添加图片
            for img in images:
                img_bytes = base64.b64decode(img.data)
                zipf.writestr(img.filename, img_bytes)

        # 读取压缩包并转换为base64
        with open(temp_path, 'rb') as f:
            zip_content = f.read()
            zip_base64 = base64.b64encode(zip_content).decode('utf-8')

        # 生成压缩包文件名
        if not zip_name:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            zip_name = f"output_{timestamp}.zip"

        return Base64File(
            filename=zip_name,
            content_type="application/zip",
            size=len(zip_content),
            data=zip_base64
        )

    finally:
        # 清理临时文件
        if os.path.exists(temp_path):
            os.remove(temp_path)


# ==================== 函数注册装饰器 ====================

def register_api_endpoint(route_path: str, func_name: str):
    """
    装饰器：自动将函数注册为API端点

    Args:
        route_path: API路由路径
        func_name: 函数名称（用于日志）
    """
    def decorator(func):
        # 获取函数签名
        sig = inspect.signature(func)
        parameters = sig.parameters

        # 动态创建请求模型
        request_fields = {}
        for param_name, param in parameters.items():
            param_type = param.annotation

            # 处理类型注解
            if param_type == inspect.Parameter.empty:
                param_type = str

            # 设置默认值
            if param.default == inspect.Parameter.empty:
                request_fields[param_name] = (param_type, ...)
            else:
                request_fields[param_name] = (param_type, param.default)

        # 创建动态请求模型
        RequestModel = create_model(
            f'{func_name.title()}Request',
            **request_fields
        )

        # 创建API端点
        @app.post(route_path, name=func_name, summary=f"Execute {func_name}")
        async def api_endpoint(api_request: RequestModel, request: fastapi.Request) -> JSONResponse:
            try:
                # 提取参数
                kwargs = api_request.model_dump()

                # 调用原始函数
                result = func(**kwargs)

                # 处理结果
                processed_result = process_function_result(result)

                # 收集有效的文件路径（用于压缩包）
                valid_file_paths = []
                result_data = result.get("result", {})
                file_paths = result_data.get("files", [])

                for filepath in file_paths:
                    if filepath and isinstance(filepath, str) and filepath.strip() and os.path.exists(filepath):
                        valid_file_paths.append(filepath)

                # 创建压缩包（如果有文件或图片）
                archive = None
                if valid_file_paths or processed_result["images"]:
                    try:
                        archive = create_zip_archive(
                            valid_file_paths,
                            processed_result["images"],
                            zip_name=f"{func_name}_output.zip"
                        )
                    except Exception as zip_error:
                        # 压缩失败不影响主流程，只记录错误
                        print(f"Warning: Failed to create archive: {zip_error}")

                # 生成会话ID并存储会话数据
                session_id = str(uuid.uuid4())
                session_storage[session_id] = {
                    'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    'function_name': func_name,
                    'message': processed_result["message"],
                    'files': [f.model_dump() for f in processed_result["files"]],
                    'images': [img.model_dump() for img in processed_result["images"]],
                    'archive': archive.model_dump() if archive else None
                }

                # 生成文件列表页面URL
                base_url = str(request.base_url)
                files_url = f"{base_url}files/{session_id}"

                # 构造响应
                response = APIResponse(
                    success=True,
                    message=processed_result["message"],
                    data=processed_result.get("raw_data", {}),
                    files=processed_result["files"],
                    images=processed_result["images"],
                    archive=archive,
                    files_url=files_url
                )

                return JSONResponse(content=response.model_dump())

            except Exception as e:
                return JSONResponse(
                    status_code=500,
                    content=APIResponse(
                        success=False,
                        message=f"Error in {func_name}",
                        error=str(e)
                    ).model_dump()
                )

        # 添加函数的文档字符串
        api_endpoint.__doc__ = func.__doc__ or f"Execute {func_name}"

        return func

    return decorator


# ==================== 批量注册函数 ====================

class FunctionRegistry:
    """函数注册器，用于批量管理函数"""

    def __init__(self):
        self.functions = {}

    def register(self, route_path: str, func_name: str):
        """注册单个函数"""
        def decorator(func):
            self.functions[func_name] = {
                'func': func,
                'route': route_path,
                'name': func_name
            }
            # 应用装饰器
            return register_api_endpoint(route_path, func_name)(func)
        return decorator

    def list_functions(self) -> List[Dict]:
        """列出所有已注册的函数"""
        return [
            {
                'name': info['name'],
                'route': info['route'],
                'doc': info['func'].__doc__
            }
            for info in self.functions.values()
        ]


# 全局注册器实例
registry = FunctionRegistry()

# 全局会话存储（用于存储文件元数据）
session_storage: Dict[str, Dict] = {}


# ==================== 文件列表展示功能 ====================

def generate_files_html(session_id: str) -> str:
    """
    生成文件列表展示页面的HTML

    Args:
        session_id: 会话ID

    Returns:
        HTML字符串
    """
    session_data = session_storage.get(session_id, {})

    # 生成HTML
    html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>API 输出文件列表 - {session_id}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}

        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}

        .header h1 {{
            font-size: 28px;
            margin-bottom: 10px;
        }}

        .header p {{
            opacity: 0.9;
            font-size: 14px;
        }}

        .info {{
            background: #f8f9fa;
            padding: 20px 30px;
            border-bottom: 1px solid #e9ecef;
        }}

        .info-item {{
            display: inline-block;
            margin-right: 30px;
            font-size: 14px;
        }}

        .info-label {{
            font-weight: 600;
            color: #495057;
        }}

        .info-value {{
            color: #6c757d;
            margin-left: 8px;
        }}

        .section {{
            padding: 30px;
        }}

        .section-title {{
            font-size: 20px;
            font-weight: 600;
            color: #212529;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #667eea;
        }}

        .file-grid, .image-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}

        .file-card, .image-card {{
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            transition: all 0.3s ease;
        }}

        .file-card:hover, .image-card:hover {{
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }}

        .file-icon {{
            font-size: 48px;
            margin-bottom: 10px;
        }}

        .file-name {{
            font-weight: 600;
            color: #212529;
            margin-bottom: 8px;
            word-break: break-all;
        }}

        .file-meta {{
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 15px;
        }}

        .btn {{
            display: inline-block;
            padding: 8px 16px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            font-size: 14px;
            transition: background 0.3s ease;
            border: none;
            cursor: pointer;
        }}

        .btn:hover {{
            background: #5568d3;
        }}

        .btn-download {{
            width: 100%;
            text-align: center;
        }}

        .image-preview {{
            width: 100%;
            height: 200px;
            object-fit: contain;
            background: #f8f9fa;
            border-radius: 4px;
            margin-bottom: 10px;
        }}

        .archive-section {{
            background: #e7f3ff;
            border: 2px solid #667eea;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }}

        .archive-title {{
            font-size: 18px;
            font-weight: 600;
            color: #004085;
            margin-bottom: 10px;
        }}

        .archive-info {{
            font-size: 14px;
            color: #004085;
            margin-bottom: 15px;
        }}

        .empty-state {{
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }}

        .empty-state-icon {{
            font-size: 64px;
            margin-bottom: 20px;
        }}

        .copy-btn {{
            background: #28a745;
            font-size: 12px;
            padding: 4px 8px;
            margin-left: 10px;
        }}

        .copy-btn:hover {{
            background: #218838;
        }}

        .footer {{
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 API 输出文件列表</h1>
            <p>所有生成的文件和图片都在这里</p>
        </div>

        <div class="info">
            <div class="info-item">
                <span class="info-label">会话ID:</span>
                <span class="info-value">{session_id}</span>
                <button class="btn copy-btn" onclick="copySessionId()">复制</button>
            </div>
            <div class="info-item">
                <span class="info-label">生成时间:</span>
                <span class="info-value">{session_data.get('timestamp', 'N/A')}</span>
            </div>
            <div class="info-item">
                <span class="info-label">函数名称:</span>
                <span class="info-value">{session_data.get('function_name', 'N/A')}</span>
            </div>
        </div>

        <div class="section">
"""

    # 压缩包部分
    if session_data.get('archive'):
        archive = session_data['archive']
        html += f"""
            <div class="archive-section">
                <div class="archive-title">📦 压缩包下载</div>
                <div class="archive-info">
                    包含所有文件和图片，推荐一次性下载<br>
                    文件名: <strong>{archive['filename']}</strong> |
                    大小: {archive['size']} bytes
                </div>
                <button class="btn btn-download" onclick="downloadArchive()">
                    ⬇️ 下载压缩包
                </button>
            </div>
"""

    # 文件部分
    html += """
            <div class="section-title">📁 文件列表</div>
    """

    files = session_data.get('files', [])
    if files:
        html += '<div class="file-grid">'
        for i, file_data in enumerate(files):
            html += f"""
                <div class="file-card">
                    <div class="file-icon">📄</div>
                    <div class="file-name">{file_data.get('filename', f'file_{i+1}')}</div>
                    <div class="file-meta">
                        大小: {file_data.get('size', 0)} bytes<br>
                        类型: {file_data.get('content_type', 'unknown')}
                    </div>
                    <button class="btn btn-download" onclick="downloadFile({i})">
                        ⬇️ 下载文件
                    </button>
                </div>
            """
        html += '</div>'
    else:
        html += """
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>没有生成文件</p>
            </div>
        """

    # 图片部分
    html += """
        </div>

        <div class="section">
            <div class="section-title">🖼️ 图片列表</div>
    """

    images = session_data.get('images', [])
    if images:
        html += '<div class="image-grid">'
        for i, img_data in enumerate(images):
            html += f"""
                <div class="image-card">
                    <img class="image-preview" src="data:image/png;base64,{img_data.get('data', '')}" alt="{img_data.get('filename', f'image_{i+1}')}">
                    <div class="file-name">{img_data.get('filename', f'image_{i+1}')}</div>
                    <div class="file-meta">
                        尺寸: {img_data.get('size', 'N/A')}<br>
                        格式: {img_data.get('format', 'N/A')}
                    </div>
                    <button class="btn btn-download" onclick="downloadImage({i})">
                        ⬇️ 下载图片
                    </button>
                </div>
            """
        html += '</div>'
    else:
        html += """
            <div class="empty-state">
                <div class="empty-state-icon">🖼️</div>
                <p>没有生成图片</p>
            </div>
        """

    # 页面底部和JavaScript
    html += f"""
        </div>

        <div class="footer">
            <p>Generated by Data Processing API Service | Session ID: {session_id}</p>
        </div>
    </div>

    <script>
        // 会话数据
        const sessionData = {session_data};

        function downloadFile(index) {{
            const file = sessionData.files[index];
            const blob = base64ToBlob(file.data, file.content_type);
            downloadBlob(blob, file.filename);
        }}

        function downloadImage(index) {{
            const img = sessionData.images[index];
            const blob = base64ToBlob(img.data, 'image/png');
            downloadBlob(blob, img.filename);
        }}

        function downloadArchive() {{
            const archive = sessionData.archive;
            const blob = base64ToBlob(archive.data, 'application/zip');
            downloadBlob(blob, archive.filename);
        }}

        function base64ToBlob(base64, contentType) {{
            const byteCharacters = atob(base64);
            const byteArrays = [];
            const sliceSize = 512;

            for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {{
                const slice = byteCharacters.slice(offset, offset + sliceSize);
                const byteNumbers = new Array(slice.length);
                for (let i = 0; i < slice.length; i++) {{
                    byteNumbers[i] = slice.charCodeAt(i);
                }}
                const byteArray = new Uint8Array(byteNumbers);
                byteArrays.push(byteArray);
            }}

            return new Blob(byteArrays, {{ type: contentType }});
        }}

        function downloadBlob(blob, filename) {{
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }}

        function copySessionId() {{
            navigator.clipboard.writeText('{session_id}').then(() => {{
                alert('会话ID已复制到剪贴板');
            }});
        }}
    </script>
</body>
</html>
    """

    return html


# ==================== 通用API端点 ====================

@app.get("/", summary="API服务根路径")
async def root():
    """根路径，返回服务信息"""
    return {
        "service": "Data Processing API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": registry.list_functions()
    }


@app.get("/functions", summary="列出所有可用函数")
async def list_functions():
    """列出所有已注册的函数"""
    return {
        "count": len(registry.functions),
        "functions": registry.list_functions()
    }


@app.get("/health", summary="健康检查")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


@app.get("/files/{session_id}", summary="查看文件列表页面")
async def view_files_page(session_id: str):
    """
    查看指定会话的文件列表页面

    Args:
        session_id: 会话ID

    Returns:
        HTML页面，展示所有文件和图片
    """
    if session_id not in session_storage:
        return HTMLResponse(
            content="""
            <html>
            <head><title>会话不存在</title></head>
            <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h1>❌ 会话不存在或已过期</h1>
                <p>请检查会话ID是否正确</p>
            </body>
            </html>
            """,
            status_code=404
        )

    html = generate_files_html(session_id)
    return HTMLResponse(content=html)
