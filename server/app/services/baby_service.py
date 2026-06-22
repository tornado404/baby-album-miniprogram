"""宝宝服务"""
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.baby import Baby
from app.models.media import Media, MediaType
from app.models.sync_log import SyncAction
from app.schemas.baby import BabyCreate, BabyUpdate
from app.services.sync_service import record_sync_log


class DuplicateBabyNameError(ValueError):
    """同一用户下同名宝宝已存在"""
    pass


class BabyNotFoundError(ValueError):
    """宝宝记录不存在"""
    pass


class BabyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_babies(self, user_id: str):
        r = await self.db.execute(
            select(Baby).where(Baby.user_id == user_id, Baby.is_deleted == False).order_by(Baby.order)
        )
        return r.scalars().all()

    async def get_baby(self, baby_id: str, user_id: str):
        r = await self.db.execute(
            select(Baby).where(Baby.id == baby_id, Baby.user_id == user_id, Baby.is_deleted == False)
        )
        return r.scalar_one_or_none()

    async def get_baby_stats(self, baby_id: str, user_id: str) -> dict:
        """获取单个宝宝的媒体统计数据"""
        r = await self.db.execute(
            select(
                func.count().filter(Media.type == MediaType.image).label("photos"),
                func.count().filter(Media.type == MediaType.video).label("videos"),
            ).where(Media.baby_id == baby_id, Media.user_id == user_id, Media.is_deleted == False)
        )
        row = r.one_or_none()
        r2 = await self.db.execute(
            select(func.count(func.distinct(Media.capture_date)))
            .where(Media.baby_id == baby_id, Media.user_id == user_id, Media.is_deleted == False)
        )
        record_days = r2.scalar() or 0
        return {
            "photoCount": getattr(row, 'photos', 0) or 0 if row else 0,
            "videoCount": getattr(row, 'videos', 0) or 0 if row else 0,
            "recordDays": record_days,
        }

    async def get_babies_stats(self, baby_ids: list[str], user_id: str) -> dict[str, dict]:
        """批量返回 {baby_id: {photoCount, videoCount, recordDays}}，避免 N+1"""
        if not baby_ids:
            return {}
        r = await self.db.execute(
            select(
                Media.baby_id,
                func.count().filter(Media.type == MediaType.image).label("photos"),
                func.count().filter(Media.type == MediaType.video).label("videos"),
                func.count(func.distinct(Media.capture_date)).label("record_days"),
            ).where(
                Media.baby_id.in_(baby_ids),
                Media.user_id == user_id,
                Media.is_deleted == False,
            ).group_by(Media.baby_id)
        )
        rows = r.all()
        result = {}
        for row in rows:
            result[row.baby_id] = {
                "photoCount": getattr(row, 'photos', 0) or 0,
                "videoCount": getattr(row, 'videos', 0) or 0,
                "recordDays": getattr(row, 'record_days', 0) or 0,
            }
        # 没有媒体的宝宝也返回 0
        for bid in baby_ids:
            if bid not in result:
                result[bid] = {"photoCount": 0, "videoCount": 0, "recordDays": 0}
        return result

    async def create_baby(self, user_id: str, data: BabyCreate):
        existing = await self.db.execute(
            select(Baby.id).where(
                Baby.user_id == user_id, Baby.name == data.name,
                Baby.is_deleted == False
            )
        )
        if existing.first() is not None:
            raise DuplicateBabyNameError(f"Baby with name '{data.name}' already exists")

        baby = Baby(
            user_id=user_id, name=data.name, gender=data.gender,
            birth_date=data.birthDate, avatar=data.avatar
        )
        self.db.add(baby)
        await self.db.flush()
        await record_sync_log(self.db, user_id, "baby", baby.id, SyncAction.create)
        await self.db.commit()
        await self.db.refresh(baby)
        return baby

    async def update_baby(self, baby_id: str, user_id: str, data: BabyUpdate):
        baby = await self.get_baby(baby_id, user_id)
        if not baby:
            raise BabyNotFoundError("Baby not found")

        # 如果更新了 name，检查是否与同用户的其他宝宝重名
        new_name = data.name
        if new_name is not None and new_name != baby.name:
            existing = await self.db.execute(
                select(Baby.id).where(
                    Baby.user_id == user_id, Baby.name == new_name,
                    Baby.is_deleted == False, Baby.id != baby_id
                )
            )
            if existing.first() is not None:
                raise DuplicateBabyNameError(f"Baby with name '{new_name}' already exists")

        # camelCase → snake_case 字段映射 + 类型安全转换
        field_map = {"birthDate": "birth_date"}
        decimal_fields = {"weight", "height"}
        for k, v in data.model_dump(exclude_unset=True).items():
            if v is not None:
                col = field_map.get(k, k)
                # 将 weight/height 转为 Decimal，避免 asyncpg 绑定参数类型不匹配
                if k in decimal_fields:
                    try:
                        v = Decimal(str(v))
                    except Exception:
                        continue  # 转换失败则跳过该字段
                setattr(baby, col, v)
        await record_sync_log(self.db, user_id, "baby", baby_id, SyncAction.update)
        await self.db.commit()
        await self.db.refresh(baby)
        return baby

    async def delete_baby(self, baby_id: str, user_id: str):
        baby = await self.get_baby(baby_id, user_id)
        if not baby:
            raise BabyNotFoundError("Baby not found")
        baby.is_deleted = True
        await record_sync_log(self.db, user_id, "baby", baby_id, SyncAction.delete)
        await self.db.commit()