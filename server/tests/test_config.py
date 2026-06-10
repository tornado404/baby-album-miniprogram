"""配置测试 — 验证环境变量解析与数据库 URL 编码"""

import os
from unittest.mock import patch

import pytest


class TestDatabaseURLParsing:
    """数据库连接字符串解析测试"""

    def test_password_with_at_sign_url_encoded(self, monkeypatch):
        """密码含 @ 时，URL 编码 %40 应正确解析"""
        monkeypatch.setenv(
            "DATABASE_URL",
            "postgresql+asyncpg://app:Cs516%402026@postgres:5432/baby_album",
        )
        # 强制重新加载 Settings（绕过单例缓存）
        from pydantic_settings import BaseSettings

        class _TestSettings(BaseSettings):
            DATABASE_URL: str = ""
            model_config = {"env_file": ".env", "extra": "ignore"}

        settings = _TestSettings()
        assert "Cs516%402026" in settings.DATABASE_URL
        assert "@postgres:5432" in settings.DATABASE_URL

    def test_password_with_at_sign_unencoded_parses_wrong_host(self):
        """密码含 @ 但未编码时，SQLAlchemy 解析出的 host 错误"""
        from sqlalchemy.engine.url import make_url

        raw = "postgresql+asyncpg://app:Cs516@2026@postgres:5432/baby_album"
        url = make_url(raw)
        # SQLAlchemy 从左往右解析，导致 host 变成 "2026@postgres"
        assert url.host == "2026@postgres"
        assert url.password == "Cs516"

    def test_docker_service_name_used_in_compose(self):
        """验证 docker-compose.yml 中使用 Docker 服务名而非 localhost"""
        import yaml

        compose_path = os.path.join(
            os.path.dirname(__file__), "..", "docker-compose.yml"
        )
        with open(compose_path, "r") as f:
            compose = yaml.safe_load(f)

        api_env = compose["services"]["api"].get("environment", {})
        assert "DATABASE_URL" in api_env
        assert "REDIS_URL" in api_env
        # 必须使用 Docker 服务名，不能是 localhost
        assert "postgres" in api_env["DATABASE_URL"]
        assert "redis" in api_env["REDIS_URL"]
        assert "localhost" not in api_env["DATABASE_URL"]
        assert "localhost" not in api_env["REDIS_URL"]

    def test_docker_compose_password_encoded(self):
        """docker-compose.yml 中密码的 @ 必须已编码"""
        import yaml

        compose_path = os.path.join(
            os.path.dirname(__file__), "..", "docker-compose.yml"
        )
        with open(compose_path, "r") as f:
            compose = yaml.safe_load(f)

        db_url = compose["services"]["api"]["environment"]["DATABASE_URL"]
        # 提取密码部分（user:pass@host）
        # 编码后的 @ 应为 %40
        assert "%40" in db_url or "change_me" in db_url


class TestEnvExampleDocumentation:
    """.env.example 注释说明测试"""

    def test_env_example_has_docker_comments(self):
        """.env.example 中应包含 Docker 部署配置提示"""
        env_path = os.path.join(
            os.path.dirname(__file__), "..", ".env.example"
        )
        with open(env_path, "r") as f:
            content = f.read()

        assert "Docker Compose" in content or "docker" in content.lower()
        assert "postgres" in content or "redis" in content
