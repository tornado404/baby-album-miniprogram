"""Integration tests for main app endpoints (health, version, lifespan)"""
import pytest


class TestHealth:
    async def test_health_returns_ok(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_version_returns_info(self, client):
        response = await client.get("/api/v1/version")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 0
        assert "version" in data["data"]