"""数据导出服务"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.baby import Baby
from app.models.media import Media
import json


class ExportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_json(self, user_id: str) -> dict:
        """导出用户所有数据为 JSON"""
        r = await self.db.execute(
            select(Baby).where(Baby.user_id == user_id, Baby.is_deleted == False)
        )
        babies = r.scalars().all()

        r2 = await self.db.execute(
            select(Media).where(Media.user_id == user_id, Media.is_deleted == False)
        )
        media = r2.scalars().all()

        return {
            "exportedAt": __import__("datetime").datetime.utcnow().isoformat(),
            "user_id": user_id,
            "babies": [
                {"id": b.id, "name": b.name, "gender": b.gender, "birthDate": b.birth_date}
                for b in babies
            ],
            "media": [
                {
                    "id": m.id, "type": m.type.value, "title": m.title,
                    "captureDate": m.capture_date, "babyId": m.baby_id,
                    "cosKey": m.cos_key, "fileSize": m.file_size,
                }
                for m in media
            ],
            "totalBabies": len(babies),
            "totalMedia": len(media),
        }

    async def get_report(self, user_id: str, baby_id: str = None,
                         start: str = None, end: str = None) -> dict:
        """生成成长报告"""
        conditions = [Media.user_id == user_id, Media.is_deleted == False]
        if baby_id:
            conditions.append(Media.baby_id == baby_id)
        if start:
            conditions.append(Media.capture_date >= start)
        if end:
            conditions.append(Media.capture_date <= end)

        r = await self.db.execute(
            select(Media).where(and_(*conditions)).order_by(Media.capture_date)
        )
        items = r.scalars().all()

        monthly = {}
        for m in items:
            month_key = m.capture_date[:7]
            if month_key not in monthly:
                monthly[month_key] = {"count": 0, "images": 0, "videos": 0}
            monthly[month_key]["count"] += 1
            if m.type.value == "image":
                monthly[month_key]["images"] += 1
            else:
                monthly[month_key]["videos"] += 1

        return {
            "period": {"start": start or "all", "end": end or "all"},
            "totalMedia": len(items),
            "totalImages": sum(1 for m in items if m.type.value == "image"),
            "totalVideos": sum(1 for m in items if m.type.value == "video"),
            "monthlyDistribution": monthly,
            "firstRecord": items[0].capture_date if items else None,
            "lastRecord": items[-1].capture_date if items else None,
        }


