from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


MODEL_CAPABILITIES = {
    "script": "qwen-plus",
    "image": "qwen-image-2.0-pro",
    "voice": "qwen-audio-3.0-tts-flash",
    "video": "wan2.7-i2v-2026-04-25",
}


@dataclass(frozen=True)
class Settings:
    database_path: Path
    dashscope_api_key: str
    bailian_workspace_id: str

    @classmethod
    def from_environment(cls, database_path: str | Path | None = None) -> "Settings":
        resolved_path = Path(
            database_path
            or os.getenv("XINGMU_DATABASE_PATH")
            or Path(__file__).resolve().parents[1] / "data" / "xingmu.db"
        )
        return cls(
            database_path=resolved_path,
            dashscope_api_key=os.getenv("DASHSCOPE_API_KEY", "").strip(),
            bailian_workspace_id=os.getenv("BAILIAN_WORKSPACE_ID", "").strip(),
        )

    def provider_status(self) -> dict[str, object]:
        return {
            "provider": "bailian",
            "region": "beijing",
            "configured": bool(self.dashscope_api_key),
            "workspaceConfigured": bool(self.bailian_workspace_id),
            "models": MODEL_CAPABILITIES,
        }
