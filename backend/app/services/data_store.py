"""
Estado central da aplicação: mantém o DataFrame consolidado de todas
as leituras em memória, e coordena a sincronização com o Google Drive.

É um singleton (uma instância por processo) protegido por lock, para
ser seguro sob os workers assíncronos do FastAPI e o job de refresh
periódico.
"""
import logging
import threading
from datetime import datetime, timezone

import pandas as pd

from app.services.cache_service import CacheService
from app.services.drive_service import DriveService
from app.services.excel_loader import load_excel

logger = logging.getLogger(__name__)


class DataStore:
    def __init__(self, drive_service: DriveService, cache_service: CacheService):
        self._drive = drive_service
        self._cache = cache_service
        self._lock = threading.RLock()
        self._df: pd.DataFrame = pd.DataFrame()
        self._last_sync: datetime | None = None
        self._files_loaded: int = 0

    def sync(self) -> None:
        """
        Sincroniza com o Drive: baixa apenas arquivos novos/alterados,
        remove do cache arquivos que não existem mais na pasta, e
        reconstrói o DataFrame consolidado.
        """
        try:
            remote_files = self._drive.list_excel_files()
        except Exception:
            logger.exception("Falha ao listar arquivos do Drive — mantendo dados atuais.")
            return

        remote_ids = {f.file_id for f in remote_files}
        for stale_id in self._cache.known_file_ids() - remote_ids:
            logger.info("Removendo do cache arquivo que não existe mais no Drive: %s", stale_id)
            self._cache.evict(stale_id)

        frames = []
        for f in remote_files:
            if self._cache.is_up_to_date(f.file_id, f.modified_time):
                content = self._cache.read_cached(f.file_id)
            else:
                logger.info("Baixando arquivo atualizado: %s", f.name)
                try:
                    content = self._drive.download_file(f.file_id)
                except Exception:
                    logger.exception("Falha ao baixar %s — pulando.", f.name)
                    continue
                self._cache.store(f.file_id, f.modified_time, content)

            df = load_excel(content, f.name)
            if not df.empty:
                frames.append(df)

        with self._lock:
            self._df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
            self._last_sync = datetime.now(timezone.utc)
            self._files_loaded = len(frames)

        logger.info(
            "Sincronização concluída: %d arquivos, %d registros.",
            self._files_loaded,
            len(self._df),
        )

    def get_dataframe(self) -> pd.DataFrame:
        """Retorna uma cópia rasa segura para leitura concorrente."""
        with self._lock:
            return self._df.copy()

    def get_status(self) -> dict:
        with self._lock:
            return {
                "last_sync": self._last_sync.isoformat() if self._last_sync else None,
                "files_loaded": self._files_loaded,
                "total_records": len(self._df),
            }
