import logging

import orjson
import pandas as pd
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.models.leitura import SyncStatusResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sync"])

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
