"""
Configurações centrais da aplicação, carregadas do .env.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Google Drive
    google_application_credentials: str = "credentials/service-account.json"
    google_drive_folder_id: str

    # Servidor
    port: int = 8080
    environment: str = "development"

    # CORS - domínios autorizados a consumir a API (frontend na Vercel)
    cors_allowed_origins: str = "http://localhost:5173"

    # Cache / refresh
    refresh_interval_seconds: int = 60
    cache_dir: str = ".cache"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
