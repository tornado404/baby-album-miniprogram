"""数据分析路由测试 — stats / achievements / report"""

from httpx import AsyncClient


class TestAnalyticsAPI:
    """GET /api/v1/analytics/* 端点测试"""

    async def test_stats_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/analytics/stats")
        assert resp.status_code == 401

    async def test_stats_authenticated(self, client: AsyncClient, auth_headers: dict):
        """认证用户获取统计（新用户，所有计数为 0）"""
        resp = await client.get("/api/v1/analytics/stats", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        data = body["data"]
        assert data["photoCount"] == 0
        assert data["videoCount"] == 0
        assert data["modelCount"] == 0
        assert data["recordDays"] == 0

    async def test_stats_with_baby_id_new_user(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """按 baby_id 统计（新用户无媒体，计数为 0）"""
        resp = await client.get(
            "/api/v1/analytics/stats",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["photoCount"] == 0
        assert data["videoCount"] == 0
        assert data["modelCount"] == 0
        assert data["recordDays"] == 0

    async def test_stats_with_baby_id_after_upload(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """上传媒体后按 baby_id 统计"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/stats_baby.jpg",
                "captureDate": "2026-06-01",
                "title": "统计测试",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "video",
                "cosKey": "videos/test/stats_baby.mp4",
                "captureDate": "2026-06-02",
                "title": "视频测试",
            },
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/analytics/stats",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["photoCount"] == 1
        assert data["videoCount"] == 1
        assert data["modelCount"] == 0
        assert data["recordDays"] == 2

    async def test_stats_with_baby_id_wrong_baby(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """用不存在的 baby_id 过滤 → 计数均为 0"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/stats_wrong.jpg",
                "captureDate": "2026-06-01",
            },
            headers=auth_headers,
        )
        resp = await client.get(
            "/api/v1/analytics/stats",
            params={"baby_id": "nonexistent-baby"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["photoCount"] == 0
        assert data["videoCount"] == 0

    async def test_achievements_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/analytics/achievements")
        assert resp.status_code == 401

    async def test_achievements_new_user(self, client: AsyncClient, auth_headers: dict):
        """新用户获取成就列表（全部未解锁）"""
        resp = await client.get("/api/v1/analytics/achievements", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        badges = body["data"]["badges"]
        assert len(badges) > 0
        for badge in badges:
            assert badge["unlocked"] is False
            assert badge["unlockedAt"] is None

    async def test_check_achievements_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.post("/api/v1/analytics/achievements/check")
        assert resp.status_code == 401

    async def test_check_achievements_new_user(self, client: AsyncClient, auth_headers: dict):
        """新用户主动检测成就（无媒体，不应获得任何成就）"""
        resp = await client.post(
            "/api/v1/analytics/achievements/check", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["newBadges"] == []

    async def test_check_achievements_first_upload(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """上传媒体后检测成就 → 获得「初来乍到」"""
        # 先创建一条媒体
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/achievement_test.jpg",
                "captureDate": "2026-06-01",
                "title": "成就测试照片",
            },
            headers=auth_headers,
        )

        resp = await client.post(
            "/api/v1/analytics/achievements/check", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        new_badges = body["data"]["newBadges"]
        assert len(new_badges) >= 1
        badge_keys = [b["key"] for b in new_badges]
        assert "first_upload" in badge_keys

    async def test_achievements_after_first_upload(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """上传后获取成就列表，first_upload 应为已解锁"""
        # 创建媒体 + 触发检测
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/badge_list_test.jpg",
                "captureDate": "2026-06-02",
                "title": "成就列表测试",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/analytics/achievements/check", headers=auth_headers
        )

        # 查询成就列表
        resp = await client.get("/api/v1/analytics/achievements", headers=auth_headers)
        assert resp.status_code == 200
        badges = resp.json()["data"]["badges"]
        first_upload = [b for b in badges if b["key"] == "first_upload"]
        assert len(first_upload) == 1
        assert first_upload[0]["unlocked"] is True
        assert first_upload[0]["unlockedAt"] is not None

    async def test_report_requires_auth(self, client: AsyncClient):
        """未认证 → 401"""
        resp = await client.get("/api/v1/analytics/report")
        assert resp.status_code == 401

    async def test_report_empty(self, client: AsyncClient, auth_headers: dict):
        """无媒体时获取成长报告"""
        resp = await client.get("/api/v1/analytics/report", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        data = body["data"]
        assert data["totalMedia"] == 0
        assert data["totalImages"] == 0
        assert data["totalVideos"] == 0
        assert data["firstRecord"] is None
        assert data["lastRecord"] is None

    async def test_report_with_media(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """有媒体时获取成长报告"""
        # 创建 2 条图片 + 1 条视频
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/report_1.jpg",
                "captureDate": "2026-05-01",
                "title": "5月照片",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/report_2.jpg",
                "captureDate": "2026-06-01",
                "title": "6月照片",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "video",
                "cosKey": "videos/test/report_1.mp4",
                "captureDate": "2026-06-15",
                "title": "6月视频",
            },
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/analytics/report", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] == 3
        assert data["totalImages"] == 2
        assert data["totalVideos"] == 1
        assert data["firstRecord"] == "2026-05-01"
        assert data["lastRecord"] == "2026-06-15"
        assert "2026-05" in data["monthlyDistribution"]
        assert "2026-06" in data["monthlyDistribution"]

    async def test_report_with_baby_filter(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """按 baby_id 过滤成长报告"""
        # 先为 test_baby_id 创建媒体
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/filter_test.jpg",
                "captureDate": "2026-06-10",
                "title": "过滤测试",
            },
            headers=auth_headers,
        )

        # 用 baby_id 过滤
        resp = await client.get(
            "/api/v1/analytics/report",
            params={"baby_id": test_baby_id},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] >= 1

        # 用不存在的 baby_id 过滤 → 0
        resp = await client.get(
            "/api/v1/analytics/report",
            params={"baby_id": "nonexistent-baby-id"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] == 0

    async def test_report_with_date_range(
        self, client: AsyncClient, auth_headers: dict, test_baby_id: str
    ):
        """按日期范围过滤成长报告"""
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/date_range_1.jpg",
                "captureDate": "2026-04-15",
                "title": "4月",
            },
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/media/",
            json={
                "babyId": test_baby_id,
                "type": "image",
                "cosKey": "photos/test/date_range_2.jpg",
                "captureDate": "2026-06-15",
                "title": "6月",
            },
            headers=auth_headers,
        )

        # 只看 5 月之后
        resp = await client.get(
            "/api/v1/analytics/report",
            params={"start": "2026-05-01"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["totalMedia"] >= 1
        # 确认不包含 4 月的记录
        for month_key in data["monthlyDistribution"]:
            assert month_key >= "2026-05"
