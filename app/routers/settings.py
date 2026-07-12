from fastapi import APIRouter, HTTPException

from app.schemas.settings import SettingsOut, SettingsUpdate
from app.services.settings_service import settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=SettingsOut)
def get_settings():
    return settings_service.get_settings()


@router.put("", response_model=SettingsOut)
def update_settings(settings: SettingsUpdate):
    updated = settings_service.update_settings(settings)
    if not updated:
        raise HTTPException(status_code=404, detail="Settings not found")
    return updated
