"""宝宝路由"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.middleware.auth import get_current_user_id
from app.services.baby_service import BabyService
from app.schemas.baby import BabyCreate, BabyUpdate, BabyResponse
from app.utils.milestones import get_recommended_milestones
from app.services.file_service import get_file_url, generate_file_path, _sign_request_headers
from app.config import settings


def _compute_age_text(birth_date: str | None) -> str | None:
    """根据出生日期计算年龄文本（如 "6个月3天"）"""
    if not birth_date:
        return None
    try:
        parts = birth_date.split("-")
        if len(parts) != 3:
            return None
        bd = date(int(parts[0]), int(parts[1]), int(parts[2]))
        today = date.today()
        if today < bd:
            return None
        yrs = today.year - bd.year
        mos = today.month - bd.month
        days = today.day - bd.day
        if days < 0:
            mos -= 1
            prev = date(today.year, today.month - 1, bd.day)
            days = (today - prev).days
        if mos < 0:
            yrs -= 1
            mos += 12
        parts_list = []
        if yrs > 0:
            parts_list.append(f"{yrs}岁")
        if mos > 0 or yrs > 0:
            parts_list.append(f"{mos}个月")
        parts_list.append(f"{days}天")
        return "".join(parts_list)
    except (ValueError, IndexError):
        return None

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
            age=_compute_age_text(b.birth_date),
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
        id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date,
        age=_compute_age_text(baby.birth_date),
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
        age=_compute_age_text(baby.birth_date),
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
            id=baby.id, name=baby.name, gender=baby.gender, birthDate=baby.birth_date,
            age=_compute_age_text(baby.birth_date),
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

    # 上传到 MinIO（使用 httpx + AWS Sig V4）
    object_path = f"avatars/{baby_id}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "image/jpeg"
    headers = _sign_request_headers("PUT", settings.MINIO_BUCKET, object_path)
    headers["Content-Type"] = content_type
    headers["Content-Length"] = str(len(content))
    import httpx
    resp = httpx.put(
        f"http://{settings.MINIO_ENDPOINT}/{settings.MINIO_BUCKET}/{object_path}",
        content=content,
        headers=headers,
        timeout=30.0,
    )
    if resp.status_code not in (200, 204):
        raise HTTPException(500, f"MinIO upload failed: {resp.status_code}")

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