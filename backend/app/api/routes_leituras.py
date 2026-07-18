from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import ORJSONResponse

from app.models.leitura import (
    ContagemResponse,
    LeituraDetalhe,
    MAX_REGISTROS_SEM_CONFIRMACAO,
)

router = APIRouter(tags=["leituras"])

MAPA_COLUMNS = [
    "lat", "lon", "cidade", "micro", "grupo", "colaborador",
    "ocorrencia", "indicador", "referencia", "matricula", "data_leitura",
]

# ---------------------------------------------------------------------------
# Parâmetros de filtro compartilhados
# ---------------------------------------------------------------------------

class FiltrosParams:
    """Parâmetros de query recebidos por /leituras/contagem e /leituras/mapa."""

    def __init__(
        self,
        referencia:   Annotated[list[str], Query()] = [],
        cidade:       Annotated[list[str], Query()] = [],
        micro:        Annotated[list[str], Query()] = [],
        grupo:        Annotated[list[str], Query()] = [],
        colaborador:  Annotated[list[str], Query()] = [],
        ocorrencia:   Annotated[list[str], Query()] = [],
        indicador:    Annotated[list[str], Query()] = [],
        matricula:    str | None = None,
        data_inicial: str | None = None,
        data_final:   str | None = None,
        busca:        str | None = None,
    ):
        self.referencia   = referencia
        self.cidade       = cidade
        self.micro        = micro
        self.grupo        = grupo
        self.colaborador  = colaborador
        self.ocorrencia   = ocorrencia
        self.indicador    = indicador
        self.matricula    = matricula
        self.data_inicial = data_inicial
        self.data_final   = data_final
        self.busca        = busca


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_native(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def _clean_records(df: pd.DataFrame) -> list[dict]:
    return df.where(pd.notna(df), None).to_dict(orient="records")


def _validar_filtros(filtros: FiltrosParams) -> None:
    if not filtros.referencia or not (filtros.cidade or filtros.micro):
        raise HTTPException(
            status_code=400,
            detail={"erro": "É obrigatório informar pelo menos uma Referência e uma Cidade ou Micro."},
        )


def aplicar_filtros(df: pd.DataFrame, filtros: FiltrosParams) -> pd.DataFrame:
    """Aplica todos os filtros ativos usando operações vetorizadas do Pandas."""
    if filtros.referencia and "referencia" in df.columns:
        df = df[df["referencia"].isin(filtros.referencia)]
    if filtros.cidade and "cidade" in df.columns:
        df = df[df["cidade"].isin(filtros.cidade)]
    if filtros.micro and "micro" in df.columns:
        df = df[df["micro"].isin(filtros.micro)]
    if filtros.grupo and "grupo" in df.columns:
        df = df[df["grupo"].isin(filtros.grupo)]
    if filtros.colaborador and "colaborador" in df.columns:
        df = df[df["colaborador"].isin(filtros.colaborador)]
    if filtros.ocorrencia and "ocorrencia" in df.columns:
        df = df[df["ocorrencia"].isin(filtros.ocorrencia)]
    if filtros.indicador and "indicador" in df.columns:
        df = df[df["indicador"].isin(filtros.indicador)]
    if filtros.matricula and "matricula" in df.columns:
        df = df[df["matricula"] == filtros.matricula]
    if filtros.data_inicial and "data_leitura" in df.columns:
        df = df[df["data_leitura"].astype(str) >= filtros.data_inicial]
    if filtros.data_final and "data_leitura" in df.columns:
        df = df[df["data_leitura"].astype(str) <= filtros.data_final]
    if filtros.busca:
        termo = filtros.busca.strip().lower()
        BUSCA_COLS = ["matricula", "colaborador", "ocorrencia", "indicador", "cidade", "micro", "referencia"]
        mask = pd.Series(False, index=df.index)
        for col in BUSCA_COLS:
            if col in df.columns:
                mask |= df[col].astype(str).str.lower().str.contains(termo, na=False)
        df = df[mask]
    return df


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/leituras/contagem", response_model=ContagemResponse)
def contar_leituras(request: Request, filtros: FiltrosParams = Depends()):
    """Retorna apenas a contagem de registros. Rápido — sem geometria."""
    _validar_filtros(filtros)
    df = request.app.state.data_store.get_dataframe()
    if df.empty:
        return ContagemResponse(total=0, necessita_confirmacao=False)
    filtrado = aplicar_filtros(df, filtros)
    total = len(filtrado)
    return ContagemResponse(
        total=total,
        necessita_confirmacao=total > MAX_REGISTROS_SEM_CONFIRMACAO,
    )


@router.get("/leituras/mapa", response_class=ORJSONResponse)
def listar_leituras_mapa(request: Request, filtros: FiltrosParams = Depends()):
    """Retorna apenas os registros filtrados. Nunca retorna o dataset completo."""
    _validar_filtros(filtros)
    df = request.app.state.data_store.get_dataframe()
    if df.empty:
        return ORJSONResponse([])

    df = df.reset_index().rename(columns={"index": "id", "latitude": "lat", "longitude": "lon"})
    filtrado = aplicar_filtros(df, filtros)
    # Remove coordenadas inválidas (lat=0, lon=0)
    filtrado = filtrado[(filtrado["lat"] != 0) | (filtrado["lon"] != 0)]
    available = ["id"] + [c for c in MAPA_COLUMNS if c in filtrado.columns]
    return ORJSONResponse(_clean_records(filtrado[available]))


@router.get("/leituras/{leitura_id}", response_model=LeituraDetalhe)
def obter_leitura(leitura_id: int, request: Request):
    """Retorna todas as colunas de uma leitura específica (para o popup do marcador)."""
    df = request.app.state.data_store.get_dataframe()
    if leitura_id < 0 or leitura_id >= len(df):
        raise HTTPException(status_code=404, detail="Leitura não encontrada")
    row = df.iloc[leitura_id]
    campos = {k: _to_native(v) for k, v in row.items()}
    return LeituraDetalhe(id=leitura_id, campos=campos)
