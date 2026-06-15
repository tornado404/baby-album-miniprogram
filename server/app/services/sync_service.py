"""数据同步服务"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.sync_log import SyncLog, SyncAction
from app.models.baby import Baby
from app.models.media import Media
from datetime import datetime
import json


async def record_sync_log(
    db: AsyncSession, user_id: str, entity_type: str, entity_id: str, action: SyncAction
):
    """写入一条 SyncLog 记录（不 commit，由调用方统一提交事务）"""
    log = SyncLog(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
    )
    db.add(log)


class SyncService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def full_sync(self, user_id: str, local_data: dict) -> dict:
        """全量同步：接收本地数据，返回云端 ID 映射"""
        id_map = {}  # 本地ID -> 云端ID

        # 同步 babies
        for baby in local_data.get("babies", []):
            local_id = baby.get("id")
            b = Baby(
                user_id=user_id, name=baby.get("name", ""),
                gender=baby.get("gender"), birth_date=baby.get("birthDate"),
            )
            self.db.add(b)
            await self.db.flush()
            id_map[local_id] = b.id

        # 同步 media
        for media in local_data.get("media", []):
            local_id = media.get("id")
            baby_id = id_map.get(media.get("babyId"), media.get("babyId"))
            m = Media(
                user_id=user_id, baby_id=baby_id,
                type=media.get("type", "image"),
                title=media.get("title", ""),
                cos_key=media.get("cosKey", ""),
                capture_date=media.get("captureDate", datetime.utcnow().strftime("%Y-%m-%d")),
            )
            self.db.add(m)
            await self.db.flush()
            id_map[local_id] = m.id

        await self.db.commit()
        return {"idMap": id_map}

    async def delta_sync(self, user_id: str, since: str) -> dict:
        """增量同步：返回指定时间后的变更"""
        r = await self.db.execute(
            select(SyncLog).where(
                SyncLog.user_id == user_id,
                SyncLog.created_at > since,
            ).order_by(SyncLog.created_at)
        )
        logs = r.scalars().all()
        return {
            "changes": [
                {
                    "entityType": l.entity_type,
                    "entityId": l.entity_id,
                    "action": l.action.value if isinstance(l.action, SyncAction) else l.action,
                }
                for l in logs
            ],
            "lastSyncTime": datetime.utcnow().isoformat(),
        }

    async def get_sync_status(self, user_id: str) -> dict:
        """获取用户同步状态：最近同步时间、待同步数量、按实体分类计数"""
        # 最近一条 SyncLog 的时间
        r = await self.db.execute(
            select(func.max(SyncLog.created_at)).where(SyncLog.user_id == user_id)
        )
        last_sync_time = r.scalar()

        # 待同步变更总数
        r = await self.db.execute(
            select(func.count()).select_from(SyncLog).where(SyncLog.user_id == user_id)
        )
        pending_changes = r.scalar() or 0

        # 按实体类型和操作分组计数
        entity_counts = {}
        for entity_type in ("baby", "media"):
            entity_counts[entity_type] = {"create": 0, "update": 0, "delete": 0}
            for action in (SyncAction.create, SyncAction.update, SyncAction.delete):
                r = await self.db.execute(
                    select(func.count()).select_from(SyncLog).where(
                        SyncLog.user_id == user_id,
                        SyncLog.entity_type == entity_type,
                        SyncLog.action == action,
                    )
                )
                entity_counts[entity_type][action.value] = r.scalar() or 0

        return {
            "lastSyncTime": last_sync_time.isoformat() if last_sync_time else None,
            "pendingChanges": pending_changes,
            "entityCounts": entity_counts,
        }