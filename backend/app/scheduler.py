import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.services.data_store import DataStore

logger = logging.getLogger(__name__)


def start_scheduler(data_store: DataStore, interval_seconds: int) -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        data_store.sync,
        "interval",
        seconds=interval_seconds,
        id="drive_sync",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("Scheduler de sincronização iniciado (a cada %ds).", interval_seconds)
    return scheduler
