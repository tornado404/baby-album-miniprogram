"""应用配置 — Pydantic Settings 加载环境变量"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，所有值从环境变量读取，提供合理默认值"""

    # 应用
    APP_NAME: str = "宝宝成长相册 API"
    DEBUG: bool = False

    # 数据库
    DATABASE_URL: str = "postgresql+asyncpg://app:change_me@localhost:5432/baby_album"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "development-secret-change-in-production"
    JWT_REFRESH_SECRET: str = "development-refresh-secret-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # 微信小程序
    WECHAT_APP_ID: str = ""
    WECHAT_APP_SECRET: str = ""

    # 腾讯云 COS
    COS_SECRET_ID: str = ""
    COS_SECRET_KEY: str = ""
    COS_BUCKET: str = "baby-album"
    COS_REGION: str = "ap-guangzhou"

    # 上传限制
    UPLOAD_MAX_SIZE: int = 20 * 1024 * 1024  # 20MB

    # 缩略图
    THUMBNAIL_WIDTH: int = 300
    THUMBNAIL_HEIGHT: int = 300
    THUMBNAIL_QUALITY: int = 80

    # 限流
    RATE_LIMIT_PER_MINUTE: int = 100

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()