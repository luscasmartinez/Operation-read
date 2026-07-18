"""
Camada de acesso ao Google Drive.

Responsável exclusivamente por:
- autenticar via Service Account
- listar arquivos .xlsx da pasta configurada
- baixar o conteúdo de um arquivo

Não faz parsing de dados — isso é responsabilidade do ExcelLoader.
"""
import io
import logging
from dataclasses import dataclass

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

EXCEL_MIME_TYPES = (
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "application/vnd.ms-excel",  # .xls (legado, por segurança)
)


@dataclass(frozen=True)
class DriveFile:
    file_id: str
    name: str
    modified_time: str  # RFC3339, ex: "2026-07-16T14:22:00.000Z"
    size: int | None


class DriveService:
    def __init__(self, credentials_path: str, folder_id: str):
        self._folder_id = folder_id
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path, scopes=SCOPES
        )
        self._client = build("drive", "v3", credentials=credentials, cache_discovery=False)

    def list_excel_files(self) -> list[DriveFile]:
        """Lista todos os arquivos Excel na pasta configurada (não recursivo)."""
        mime_filter = " or ".join(f"mimeType='{m}'" for m in EXCEL_MIME_TYPES)
        query = f"'{self._folder_id}' in parents and ({mime_filter}) and trashed = false"

        files: list[DriveFile] = []
        page_token = None
        while True:
            response = (
                self._client.files()
                .list(
                    q=query,
                    fields="nextPageToken, files(id, name, modifiedTime, size)",
                    pageToken=page_token,
                    pageSize=200,
                )
                .execute()
            )
            for f in response.get("files", []):
                files.append(
                    DriveFile(
                        file_id=f["id"],
                        name=f["name"],
                        modified_time=f["modifiedTime"],
                        size=int(f["size"]) if f.get("size") else None,
                    )
                )
            page_token = response.get("nextPageToken")
            if not page_token:
                break

        logger.info("Encontrados %d arquivos Excel na pasta do Drive.", len(files))
        return files

    def download_file(self, file_id: str) -> bytes:
        """Baixa o conteúdo binário de um arquivo do Drive."""
        request = self._client.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buffer.getvalue()
