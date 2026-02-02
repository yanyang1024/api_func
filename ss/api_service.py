"""
FastAPI服务核心模块
提供统一的API封装和数据处理
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
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
        async def api_endpoint(request: RequestModel) -> JSONResponse:
            try:
                # 提取参数
                kwargs = request.model_dump()

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

                # 构造响应
                response = APIResponse(
                    success=True,
                    message=processed_result["message"],
                    data=processed_result.get("raw_data", {}),
                    files=processed_result["files"],
                    images=processed_result["images"],
                    archive=archive
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
