import json
import os
from pathlib import Path

SETTINGS_FILE = Path(__file__).resolve().parent.parent / "data" / "settings.json"

DEFAULT_SETTINGS = {
    "gmail_connected": False,
    "gmail_email": "",
    "local_pc_connected": False,
    "watch_folder": "",
    "auto_accept_timesheets": True,
    "selective_ai_parsing": True
}

def load_settings() -> dict:
    """Load settings from settings.json."""
    if not SETTINGS_FILE.exists():
        SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_SETTINGS, f, indent=2)
        return DEFAULT_SETTINGS
    
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure all default keys exist
            updated = False
            for k, v in DEFAULT_SETTINGS.items():
                if k not in data:
                    data[k] = v
                    updated = True
            if updated:
                save_settings(data)
            return data
    except Exception:
        return DEFAULT_SETTINGS

def save_settings(settings: dict) -> None:
    """Save settings to settings.json."""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
