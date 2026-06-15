"""宝宝路由"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.baby_service import BabyService
from app.schemas.baby import BabyCreate, BabyUpdate, BabyResponse
from app.utils.milestones import get_recommended_milestones
from app.services.file_service import minio_client, get_file_url, generate_file_path
from app.config import settings

router = APIRouter()


@router.get("/", response_model=list[BabyResponse])
async def list_babies(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    svc = BabyService(db)
    babies = await svc.list_babies(user_id)
    baby_ids = [b.id for b in babies]
    stats_map = await svc.get_babies_stats(baby_ids, user_id)
    return [
        BabyResponse(
            id=b.id, name=b.name, gender=b.gender, birthDate=b.birth_date,
            **stats_map.get(b.id, {"photoCount": 0, "videoCount": 0, "recordDays": 0}),
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
    svc = BabyService(db)
    baby = await svc.get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")
    stats = await svc.get_baby_stats(baby_id, user_id)
    return BabyResponse(
        id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date,
        **stats,
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


@router.get("/{baby_id}/milestones")
async def get_baby_milestones(
    baby_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """根据宝宝月龄返回推荐里程碑列表"""
    svc = BabyService(db)
    baby = await svc.get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")
    milestones = get_recommended_milestones(baby.birth_date)
    return {"code": 0, "data": {"milestones": milestones}}


@router.put("/{baby_id}/avatar")
async def upload_baby_avatar(
    baby_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """上传宝宝头像到 MinIO"""
    import uuid

    svc = BabyService(db)
    baby = await svc.get_baby(baby_id, user_id)
    if not baby:
        raise HTTPException(404, "Baby not found")

    # 读取文件内容
    content = await file.read()
    if len(content) > settings.UPLOAD_MAX_SIZE:
        raise HTTPException(400, "文件大小超过限制")

    # 确定扩展名
    filename = file.filename or "avatar.jpg"
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    if ext.lower() not in ("jpg", "jpeg", "png", "gif", "webp"):
        ext = "jpg"

    # 上传到 MinIO
    object_path = f"avatars/{baby_id}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "image/jpeg"
    minio_client.put_object(
        settings.MINIO_BUCKET,
        object_path,
        data=content,
        length=len(content),
        content_type=content_type,
    )

    # 更新 Baby.avatar
    avatar_url = get_file_url(object_path)
    baby.avatar = avatar_url
    await db.commit()
    await db.refresh(baby)

    return {
        "code": 0,
        "data": {
            "id": baby.id,
            "name": baby.name,
            "avatar": baby.avatar,
        },
    }