"""成长对比 API 测试"""
from httpx import AsyncClient


class TestGrowthCompare:
    """GET /api/v1/analytics/growth-compare 测试"""

    async def test_growth_compare_no_milestones(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """无里程碑标记媒体的宝宝 -> milestones 返回空数组"""
        resp = await client.get(
            f"/api/v1/analytics/growth-compare?baby_id={test_baby_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["milestones"] == []
        # latestPhoto 可能为 null 或有值（取决于是否有媒体）
        assert "latestPhoto" in body["data"]

    async def test_growth_compare_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝返回 404"""
        resp = await client.get(
            "/api/v1/analytics/growth-compare?baby_id=nonexistent",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_growth_compare_requires_auth(self, client: AsyncClient):
        """未认证返回 401"""
        resp = await client.get(
            "/api/v1/analytics/growth-compare?baby_id=nonexistent-id",
        )
        assert resp.status_code == 401

    async def test_growth_compare_with_milestones(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """有里程碑标记媒体的宝宝返回正确聚合数据"""
        from datetime import datetime

        now = datetime.now().strftime("%Y-%m-%d")
        for milestone in ["满月", "翻身"]:
            resp = await client.post(
                "/api/v1/media/",
                json={
                    "babyId": test_baby_id,
                    "type": "image",
                    "cosKey": f"test/{milestone}.jpg",
                    "captureDate": now,
                    "title": f"test_{milestone}",
                    "milestone": milestone,
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200

        resp = await client.get(
            f"/api/v1/analytics/growth-compare?baby_id={test_baby_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["data"]["milestones"]) == 2
        milestone_names = [m["name"] for m in body["data"]["milestones"]]
        assert "满月" in milestone_names
        assert "翻身" in milestone_names