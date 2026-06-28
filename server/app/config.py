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

    # MinIO 对象存储
    # 内部通信地址（后端容器与 MinIO 容器之间通信）
    MINIO_ENDPOINT: str = "101.126.41.146:9000"
    # 外部访问地址（用于生成客户端预签名 URL，必须客户端可达；
    # 生产环境通过 Cloudflare 反代到 baby-nginx → baby-minio:9000）
    MINIO_EXTERNAL_ENDPOINT: str = "oss.qzjlyouhua.fun"
    MINIO_ACCESS_KEY: str = "Cs516@2026"
    MINIO_SECRET_KEY: str = "Cs516@2026"
    MINIO_BUCKET: str = "baby-album"
    # MinIO 公网访问地址（用于拼接公开文件 URL；与 MINIO_EXTERNAL_ENDPOINT 同源，含协议）
    MINIO_PUBLIC_URL: str = "https://oss.qzjlyouhua.fun"

    # 火山引擎 TOS 对象存储（替代 MinIO，S3 兼容 API）
    # 通过 TOS_ACCESS_KEY 是否为空来判断使用 TOS 还是 MinIO
    TOS_ACCESS_KEY: str = ""
    TOS_SECRET_KEY: str = ""
    TOS_BUCKET: str = "baby-album"
    TOS_REGION: str = "cn-beijing"
    TOS_ENDPOINT: str = "tos-cn-beijing.volces.com"
    TOS_INTERNAL_ENDPOINT: str = "tos-cn-beijing.internal.volces.com"
    TOS_PUBLIC_URL: str = "https://baby-album.tos-cn-beijing.volces.com"
    TOS_CDN_URL: str = ""

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
