from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, Query, Request

from app.models.leitura import FiltrosDisponiveis

router = APIRouter(tags=["filtros"])


class FiltrosCascataParams:
    """Filtros upstream usados para estreitar as opções downstream."""

    def __init__(
        self,
        referencia:  Annotated[list[str], Query()] = [],
        cidade:      Annotated[list[str], Query()] = [],
        micro:       Annotated[list[str], Query()] = [],
        grupo:       Annotated[list[str], Query()] = [],
        colaborador: Annotated[list[str], Query()] = [],
        ocorrencia:  Annotated[list[str], Query()] = [],
    ):
        self.referencia  = referencia
        self.cidade      = cidade
        self.micro       = micro
        self.grupo       = grupo
        self.colaborador = colaborador
        self.ocorrencia  = ocorrencia


def _unique_sorted(df: pd.DataFrame, col: str) -> list[str]:
    if col not in df.columns:
        return []
    values = df[col].dropna().astype(str).str.strip()
    return sorted(values[values != ""].unique().tolist())


@router.get("/filtros", response_model=FiltrosDisponiveis)
def obter_filtros(request: Request, f: FiltrosCascataParams = Depends()):
    """
    Retorna valores únicos de cada filtro aplicando cascata:
    referencia → cidade → micro → grupo → colaborador → ocorrencia → indicador.
    """
    df = request.app.state.data_store.get_dataframe()
    if df.empty:
        return FiltrosDisponiveis(
            referencia=[], cidade=[], micro=[], grupo=[],
            colaborador=[], ocorrencia=[], indicador=[],
        )

    # referencia — sem filtro upstream
    all_ref = _unique_sorted(df, "referencia")

    # cidade — filtrada por referencia selecionada
    df_r = df[df["referencia"].isin(f.referencia)] if f.referencia else df
    all_cid = _unique_sorted(df_r, "cidade")

    # micro — filtrada por referencia + cidade
    df_rc = df_r[df_r["cidade"].isin(f.cidade)] if f.cidade else df_r
    all_mic = _unique_sorted(df_rc, "micro")

    # grupo — filtrado por referencia + cidade + micro
    df_rcm = df_rc[df_rc["micro"].isin(f.micro)] if f.micro else df_rc
    all_grp = _unique_sorted(df_rcm, "grupo")

    # colaborador — filtrado por todos acima
    df_rcmg = df_rcm[df_rcm["grupo"].isin(f.grupo)] if f.grupo else df_rcm
    all_col = _unique_sorted(df_rcmg, "colaborador")

    # ocorrencia — filtrada por todos acima
    df_rcmgc = df_rcmg[df_rcmg["colaborador"].isin(f.colaborador)] if f.colaborador else df_rcmg
    all_occ = _unique_sorted(df_rcmgc, "ocorrencia")

    # indicador — filtrado por todos acima
    df_full = df_rcmgc[df_rcmgc["ocorrencia"].isin(f.ocorrencia)] if f.ocorrencia else df_rcmgc
    all_ind = _unique_sorted(df_full, "indicador")

    return FiltrosDisponiveis(
        referencia=all_ref,
        cidade=all_cid,
        micro=all_mic,
        grupo=all_grp,
        colaborador=all_col,
        ocorrencia=all_occ,
        indicador=all_ind,
    )
