"""数据导出路由测试 — export/data + export/report"""

from httpx import AsyncClient


class TestExportAPI:
    """POST /api/v1/export/data + GET /api/v1/export/report 端点测试"""

    async def test_export_data_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.post("/api/v1/export/data")
        assert resp.status_code == 401

    async def test_export_data_empty(self, client: AsyncClient, auth_headers: dict):
        """新用户导出数据（空）"""
        resp = await client.post("/api/v1/export/data", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        data = body["data"]
        assert data["totalBabies"] == 0
        assert data["totalMedia"] == 0
        assert data["babies"] == []
        assert data["media"] == []
        assert "exportedAt" in data

    async def test_export_data_with_content(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """有宝宝和媒体时导出数据"""
        # 创建媒体
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/export_test.jpg",
                "captureDate": "2026-06-01",
                "title": "导出测试照片",
            },
            headers=auth_headers,
        )

        resp = await client.post("/api/v1/export/data", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalBabies"] >= 1
        assert data["totalMedia"] >= 1
        assert len(data["babies"]) >= 1
        assert len(data["media"]) >= 1
        # 验证宝宝数据结构
        baby = data["babies"][0]
        assert "id" in baby
        assert "name" in baby
        # 验证媒体数据结构
        media = data["media"][0]
        assert "id" in media
        assert "type" in media
        assert "captureDate" in media

    async def test_export_report_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/export/report")
        assert resp.status_code == 401

    async def test_export_report_empty(self, client: AsyncClient, auth_headers: dict):
        """无媒体时获取成长报告"""
        resp = await client.get("/api/v1/export/report", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        data = body["data"]
        assert data["totalMedia"] == 0
        assert data["totalImages"] == 0
        assert data["totalVideos"] == 0
        assert data["firstRecord"] is None
        assert data["lastRecord"] is None

    async def test_export_report_with_media(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """有媒体时获取成长报告"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/export_report_1.jpg",
                "captureDate": "2026-05-01",
                "title": "5月",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "video",
                "cosKey": "videos/test/export_report_2.mp4",
                "captureDate": "2026-06-01",
                "title": "6月视频",
            },
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/export/report", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] == 2
        assert data["totalImages"] == 1
        assert data["totalVideos"] == 1
        assert data["firstRecord"] == "2026-05-01"
        assert data["lastRecord"] == "2026-06-01"

    async def test_export_report_with_baby_filter(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """按 baby_id 过滤报告"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/export_filter.jpg",
                "captureDate": "2026-06-10",
                "title": "过滤",
            },
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/export/report",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] >= 1

    async def test_export_report_with_date_range(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """按日期范围过滤报告"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/export_daterange_1.jpg",
                "captureDate": "2026-03-01",
                "title": "3月",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/export_daterange_2.jpg",
                "captureDate": "2026-06-01",
                "title": "6月",
            },
            headers=auth_headers,
        )

        # 只看 5 月之后
        resp = await client.get(
            "/api/v1/export/report",
            params={"start": "2026-05-01"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] >= 1
        for month_key in data["monthlyDistribution"]:
            assert month_key >= "2026-05"

    async def test_export_data_isolation(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """用户 A 导出数据不应包含用户 B 的内容"""
        # 用户 A 创建媒体
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/isolation_a.jpg",
                "captureDate": "2026-06-01",
                "title": "用户A",
            },
            headers=auth_headers,
        )

        # 用户 B 登录
        rb = await client.post("/api/v1/auth/login", json={"code": "user_b_export"})
        token_b = rb.json()["accessToken"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 用户 B 导出数据应为空
        resp = await client.post("/api/v1/export/data", headers=headers_b)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalBabies"] == 0
        assert data["totalMedia"] == 0
