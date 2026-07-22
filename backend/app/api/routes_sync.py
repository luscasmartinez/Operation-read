import logging
from pathlib import Path

import orjson
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.models.leitura import SyncStatusResponse, UploadExcelResponse
from app.services.excel_loader import load_excel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])

VALID_EXTENSIONS = {".xlsx", ".xls"}

# Colunas que serão incluídas no payload de sincronização
SYNC_COLUMNS = [
    "matricula",
    "referencia",
    "cidade",
    "micro",
    "grupo",
    "indicador",
    "ocorrencia",
    "colaborador",
    "hora_leitura",
    "data_leitura",
]


@router.get("/sync/status", response_model=SyncStatusResponse)
def sync_status(request: Request):
    """Retorna metadados da última sincronização sem transferir dados."""
    status = request.app.state.data_store.get_status()
    return SyncStatusResponse(
        ultimaAtualizacao=status["last_sync"],
        arquivoModificadoEm=status.get("latest_file_modified"),
        totalRegistros=status["total_records"],
    )


def _preparar_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Normaliza o DataFrame para exportação: renomeia colunas e filtra campos."""
    df = df.reset_index(drop=True)
    df = df.reset_index().rename(columns={"index": "id"})

    rename: dict[str, str] = {}
    if "latitude" in df.columns:
        rename["latitude"] = "lat"
    if "longitude" in df.columns:
        rename["longitude"] = "lon"
    if rename:
        df = df.rename(columns=rename)

    # Colunas prioritárias + extras (excluindo internas com underscore)
    keep = ["id", "lat", "lon"] + [c for c in SYNC_COLUMNS if c in df.columns]
    extra = [c for c in df.columns if c not in keep and not c.startswith("_")]
    available = [c for c in keep + extra if c in df.columns]

    return df[available].where(pd.notna(df[available]), None)


def _limpar_valor(val):
    """Converte tipos numpy para Python nativo; NaN → None."""
    if val is None:
        return None
    if isinstance(val, float) and val != val:  # NaN
        return None
    if hasattr(val, "item"):  # numpy scalar
        return val.item()
    return val


def _gerar_ndjson(df: pd.DataFrame):
    """
    Gera stream NDJSON:
      Linha 1  → {"total": N}
      Linhas + → um objeto JSON por registro
    Permite que o frontend rastreie o progresso em tempo real.
    """
    total = len(df)
    yield orjson.dumps({"total": total}) + b"\n"

    cols = list(df.columns)
    for row in df.itertuples(index=False):
        record = {col: _limpar_valor(val) for col, val in zip(cols, row)}
        yield orjson.dumps(record) + b"\n"


@router.get("/sync")
def sync_dados(request: Request):
    """
    Retorna todos os registros como NDJSON (uma linha por registro).
    O cliente pode rastrear o progresso em tempo real via stream.
    """
    df = request.app.state.data_store.get_dataframe()

    if df.empty:
        def _vazio():
            yield orjson.dumps({"total": 0}) + b"\n"

        return StreamingResponse(
            _vazio(),
            media_type="application/x-ndjson",
            headers={"X-Total-Records": "0"},
        )

    df_out = _preparar_dataframe(df)
    total = len(df_out)
    logger.info("Iniciando stream NDJSON de %d registros via GET /sync", total)

    return StreamingResponse(
        _gerar_ndjson(df_out),
        media_type="application/x-ndjson",
        headers={"X-Total-Records": str(total)},
    )


@router.post("/sync/upload", response_model=UploadExcelResponse)
async def upload_e_substituir_excel(
    request: Request,
    file: UploadFile = File(...),
):
    """
    Faz upload de um Excel, substitui o arquivo atual no Drive
    e sincroniza imediatamente o DataStore em memória.
    """
    file_name = file.filename or "leituras.xlsx"
    ext = Path(file_name).suffix.lower()

    if ext not in VALID_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Envie um arquivo .xlsx ou .xls.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")

    df_preview = load_excel(content, file_name)
    total_registros_arquivo = len(df_preview)

    if total_registros_arquivo <= 0:
        raise HTTPException(
            status_code=400,
            detail=(
                "O arquivo não possui registros válidos para o mapa. "
                "Verifique se contém Latitude Real e Longitude Real."
            ),
        )

    try:
        resultado = request.app.state.data_store.replace_excel_and_sync(
            content=content,
            file_name=file_name,
        )
    except Exception as exc:
        logger.exception("Falha ao substituir Excel no Drive")
        raise HTTPException(
            status_code=500,
            detail="Não foi possível substituir o arquivo no Google Drive.",
        ) from exc

    drive_file = resultado["drive_file"]
    status = resultado["status"]

    return UploadExcelResponse(
        arquivoNoDriveId=drive_file.file_id,
        arquivoNoDriveNome=drive_file.name,
        arquivoNoDriveModificadoEm=drive_file.modified_time,
        totalRegistrosArquivo=total_registros_arquivo,
        totalRegistrosAtual=status["total_records"],
        ultimaAtualizacao=status["last_sync"],
    )
