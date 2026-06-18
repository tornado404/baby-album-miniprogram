"""宝宝路由补充测试 — 里程碑 + 头像上传"""
from unittest.mock import patch, MagicMock
from httpx import AsyncClient


class TestBabyExtra:
    """宝宝路由未覆盖路径"""

    BASE = "/api/v1/babies/"

    async def test_get_milestones(self, client: AsyncClient, auth_headers: dict):
        """获取宝宝里程碑"""
        r = await client.post(self.BASE, json={"name": "里程碑宝宝", "birthDate": "2026-01-01"}, headers=auth_headers)
        baby_id = r.json()["id"]
        r = await client.get(f"{self.BASE}{baby_id}/milestones", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["code"] == 0

    async def test_milestones_not_found(self, client: AsyncClient, auth_headers: dict):
        """里程碑 - 宝宝不存在"""
        r = await client.get(f"{self.BASE}nonexistent/milestones", headers=auth_headers)
        assert r.status_code == 404

    async def test_upload_avatar(self, client: AsyncClient, auth_headers: dict):
        """上传头像（mock MinIO 和 httpx）"""
        r = await client.post(self.BASE, json={"name": "头像宝宝"}, headers=auth_headers)
        baby_id = r.json()["id"]

        with patch("app.routers.baby._sign_request_headers") as ms:
            with patch("httpx.put") as mp:
                ms.return_value = {}
                mp.return_value.status_code = 204
                r = await client.put(
                    f"{self.BASE}{baby_id}/avatar",
                    files={"file": ("a.png", b"img", "image/png")},
                    headers=auth_headers,
                )
        assert r.status_code == 200
        assert r.json()["code"] == 0

    async def test_upload_avatar_not_found(self, client: AsyncClient, auth_headers: dict):
        """上传头像 - 宝宝不存在"""
        r = await client.put(
            f"{self.BASE}nonexistent/avatar",
            files={"file": ("a.png", b"x", "image/png")},
            headers=auth_headers,
        )
        assert r.status_code == 404

    async def test_upload_avatar_too_large(self, client: AsyncClient, auth_headers: dict):
        """上传头像 - 文件超过限制"""
        r = await client.post(self.BASE, json={"name": "大文件宝宝"}, headers=auth_headers)
        baby_id = r.json()["id"]

        with patch("app.config.settings.UPLOAD_MAX_SIZE", 10):
            r = await client.put(
                f"{self.BASE}{baby_id}/avatar",
                files={"file": ("a.png", b"x" * 100, "image/png")},
                headers=auth_headers,
            )
        assert r.status_code == 400