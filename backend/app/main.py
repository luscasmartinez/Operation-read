import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_estatisticas, routes_filtros, routes_health, routes_leituras, routes_sync
from app.config import get_settings
from app.scheduler import start_scheduler
from app.services.cache_service import CacheService
from app.services.data_store import DataStore
from app.services.drive_service import DriveService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()

    drive_service = DriveService(
        credentials_path=settings.google_application_credentials,
        folder_id=settings.google_drive_folder_id,
    )
    cache_service = CacheService(cache_dir=settings.cache_dir)
    data_store = DataStore(drive_service, cache_service)

    logger.info("Carregando dados iniciais do Google Drive...")
    data_store.sync()

    app.state.data_store = data_store
    app.state.scheduler = start_scheduler(data_store, settings.refresh_interval_seconds)

    yield

    app.state.scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Aegea - API de Leituras Operacionais",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(routes_health.router)
    app.include_router(routes_sync.router)
    app.include_router(routes_leituras.router)
    app.include_router(routes_estatisticas.router)
    app.include_router(routes_filtros.router)

    return app


app = create_app()
