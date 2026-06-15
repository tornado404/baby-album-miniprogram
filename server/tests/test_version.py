"""版本 API 端点测试"""

from httpx import AsyncClient


class TestVersionAPI:
    """版本 API 端点测试"""

    async def test_get_version(self, client: AsyncClient):
        """获取版本信息"""
        resp = await client.get("/api/v1/version")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "version" in body["data"]
        assert "commit" in body["data"]
        assert "buildTime" in body["data"]

    async def test_version_no_auth_required(self, client: AsyncClient):
        """版本接口无需认证"""
        resp = await client.get("/api/v1/version")
        assert resp.status_code == 200

    async def test_version_format(self, client: AsyncClient):
        """版本号格式为 semver"""
        resp = await client.get("/api/v1/version")
        body = resp.json()
        version = body["data"]["version"]
        parts = version.split(".")
        assert len(parts) == 3
        for p in parts:
            assert p.isdigit()
