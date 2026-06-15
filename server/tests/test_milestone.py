"""里程碑工具 + API 端点测试"""

from datetime import date
from httpx import AsyncClient
from app.utils.milestones import get_recommended_milestones, MILESTONE_MAP


class TestMilestoneUtil:
    """里程碑工具函数测试"""

    def test_milestone_map_length(self):
        """10 个里程碑定义"""
        assert len(MILESTONE_MAP) == 10

    def test_empty_birth_date(self):
        """空出生日期返回空列表"""
        result = get_recommended_milestones("")
        assert result == []

    def test_none_birth_date(self):
        """None 出生日期返回空列表"""
        result = get_recommended_milestones(None)
        assert result == []

    def test_invalid_format(self):
        """无效日期格式返回空列表"""
        result = get_recommended_milestones("not-a-date")
        assert result == []

    def test_newborn(self):
        """新生儿：只有 month=0 达成"""
        today = date.today()
        birth = today.isoformat()
        result = get_recommended_milestones(birth)
        achieved = [m for m in result if m["achieved"]]
        assert len(achieved) == 1
        assert achieved[0]["month"] == 0
        assert achieved[0]["name"] == "出生"

    def test_6_months_old(self):
        """6 个月大：0/1/3/6 月里程碑达成，8 月未达成"""
        today = date.today()
        # 构造恰好 6 个月前的日期
        birth_year = today.year
        birth_month = today.month - 6
        if birth_month <= 0:
            birth_month += 12
            birth_year -= 1
        birth = f"{birth_year}-{birth_month:02d}-{today.day:02d}"
        result = get_recommended_milestones(birth)
        achieved = [m for m in result if m["achieved"]]
        achieved_months = [m["month"] for m in achieved]
        assert 0 in achieved_months
        assert 6 in achieved_months
        # 8 月里程碑不应达成（宝宝只有 6 个月）
        assert 8 not in achieved_months

    def test_2_years_old(self):
        """2 岁大：0~18 月里程碑达成"""
        today = date.today()
        birth = f"{today.year - 2}-{today.month:02d}-{today.day:02d}"
        result = get_recommended_milestones(birth)
        achieved = [m for m in result if m["achieved"]]
        achieved_months = [m["month"] for m in achieved]
        assert 0 in achieved_months
        assert 12 in achieved_months
        assert 18 in achieved_months
        assert 24 in achieved_months

    def test_result_structure(self):
        """返回结构包含所有必需字段"""
        birth = date.today().isoformat()
        result = get_recommended_milestones(birth)
        for m in result:
            assert "month" in m
            assert "name" in m
            assert "icon" in m
            assert "desc" in m
            assert "achieved" in m
            assert isinstance(m["achieved"], bool)


class TestMilestoneAPI:
    """里程碑 API 端点测试"""

    async def test_get_milestones(self, client: AsyncClient, auth_headers: dict, test_baby_id: str):
        """获取宝宝里程碑列表"""
        resp = await client.get(
            f"/api/v1/babies/{test_baby_id}/milestones",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert len(body["data"]["milestones"]) == 10

    async def test_milestones_baby_not_found(self, client: AsyncClient, auth_headers: dict):
        """不存在的宝宝返回 404"""
        resp = await client.get(
            "/api/v1/babies/nonexistent/milestones",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_milestones_requires_auth(self, client: AsyncClient, test_baby_id: str):
        """未认证返回 401"""
        resp = await client.get(
            f"/api/v1/babies/{test_baby_id}/milestones",
        )
        assert resp.status_code == 401
