"""
Cache local em disco.

Guarda um manifesto {file_id: modified_time} e os bytes originais de
cada arquivo já baixado, para não baixar de novo do Drive um arquivo
que não mudou. Isso é o que a spec pede: "Não baixar novamente
arquivos que não sofreram alterações. Utilizar modifiedTime."

Nota sobre Cloud Run: o filesystem local de uma instância é efêmero
entre deploys/reinícios, mas persiste enquanto a instância está viva.
Com min-instances >= 1, o cache permanece quente na prática. Se no
futuro forem usadas múltiplas instâncias simultâneas, este cache
deveria migrar para Cloud Storage — deixado como ponto de evolução.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, cache_dir: str):
        self._dir = Path(cache_dir)
        self._files_dir = self._dir / "files"
        self._manifest_path = self._dir / "manifest.json"
        self._files_dir.mkdir(parents=True, exist_ok=True)
        self._manifest = self._load_manifest()

    def _load_manifest(self) -> dict[str, str]:
        if self._manifest_path.exists():
            try:
                return json.loads(self._manifest_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                logger.warning("Manifesto de cache corrompido, recriando.")
        return {}

    def _save_manifest(self) -> None:
        self._manifest_path.write_text(
            json.dumps(self._manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def is_up_to_date(self, file_id: str, modified_time: str) -> bool:
        local_path = self._files_dir / f"{file_id}.xlsx"
        return self._manifest.get(file_id) == modified_time and local_path.exists()

    def read_cached(self, file_id: str) -> bytes:
        return (self._files_dir / f"{file_id}.xlsx").read_bytes()

    def store(self, file_id: str, modified_time: str, content: bytes) -> None:
        (self._files_dir / f"{file_id}.xlsx").write_bytes(content)
        self._manifest[file_id] = modified_time
        self._save_manifest()

    def known_file_ids(self) -> set[str]:
        return set(self._manifest.keys())

    def evict(self, file_id: str) -> None:
        """Remove do cache arquivos que não existem mais na pasta do Drive."""
        path = self._files_dir / f"{file_id}.xlsx"
        if path.exists():
            path.unlink()
        self._manifest.pop(file_id, None)
        self._save_manifest()
