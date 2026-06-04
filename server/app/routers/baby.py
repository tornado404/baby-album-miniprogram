"""宝宝路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.baby_service import BabyService
from app.schemas.baby import BabyCreate, BabyUpdate, BabyResponse

router = APIRouter()


@router.get("/", response_model=list[BabyResponse])
async def list_babies(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    babies = await BabyService(db).list_babies(user_id)
    return [
        BabyResponse(
            id=b.id, name=b.name, gender=b.gender, birthDate=b.birth_date
        ) for b in babies
    ]


@router.post("/", response_model=BabyResponse)
async def create_baby(
    data: BabyCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    baby = await BabyService(db).create_baby(user_id, data)
    return BabyResponse(
        id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date
    )


@router.get("/{baby_id}", response_model=BabyResponse)
async def get_baby(
    baby_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    baby = await BabyService(db).get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")
    return BabyResponse(
        id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date
    )


@router.put("/{baby_id}", response_model=BabyResponse)
async def update_baby(
    baby_id: str, data: BabyUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        baby = await BabyService(db).update_baby(baby_id, user_id, data)
        return BabyResponse(
            id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/{baby_id}")
async def delete_baby(
    baby_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        await BabyService(db).delete_baby(baby_id, user_id)
        return {"message": "Deleted"}
    except ValueError as e:
        raise HTTPException(404, str(e))