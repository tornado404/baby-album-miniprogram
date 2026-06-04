"""宝宝服务"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.baby import Baby
from app.schemas.baby import BabyCreate, BabyUpdate


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

    async def create_baby(self, user_id: str, data: BabyCreate):
        baby = Baby(
            user_id=user_id, name=data.name, gender=data.gender,
            birth_date=data.birthDate, avatar=data.avatar
        )
        self.db.add(baby)
        await self.db.commit()
        await self.db.refresh(baby)
        return baby

    async def update_baby(self, baby_id: str, user_id: str, data: BabyUpdate):
        baby = await self.get_baby(baby_id, user_id)
        if not baby:
            raise ValueError("Baby not found")
        for k, v in data.dict(exclude_unset=True).items():
            if v is not None:
                setattr(baby, k, v)
        await self.db.commit()
        await self.db.refresh(baby)
        return baby

    async def delete_baby(self, baby_id: str, user_id: str):
        baby = await self.get_baby(baby_id, user_id)
        if not baby:
            raise ValueError("Baby not found")
        baby.is_deleted = True
        await self.db.commit()