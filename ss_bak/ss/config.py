"""
配置文件
"""
import os
from typing import List


class Settings:
    """应用配置"""

    # API配置
    APP_NAME: str = "Data Processing API Service"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # 服务器配置
    HOST: str = os.getenv("API_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("API_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

    # CORS配置
    CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "*"
    ]

    # 文件配置
    OUTPUT_DIR: str = "outputs"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB

    # 日志配置
    LOG_LEVEL: str = "info"

    class Config:
        case_sensitive = True


settings = Settings()
