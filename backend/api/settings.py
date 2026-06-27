from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.settings_store import load_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    gmail_connected: bool
    gmail_email: str | None = None
    local_pc_connected: bool
    watch_folder: str | None = None
    auto_accept_timesheets: bool
    selective_ai_parsing: bool

@router.get("")
async def get_settings():
    """Retrieve current integration settings."""
    try:
        return load_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def update_settings(payload: SettingsUpdate):
    """Update integration settings."""
    try:
        settings = payload.dict()
        save_settings(settings)
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
