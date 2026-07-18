from fastapi import APIRouter, Request

from app.models.leitura import Estatisticas

router = APIRouter(tags=["estatisticas"])


def _nunique(df, col: str) -> int:
    return int(df[col].nunique()) if col in df.columns else 0


@router.get("/estatisticas", response_model=Estatisticas)
def obter_estatisticas(request: Request):
    """
    Estatísticas globais (não filtradas) do dataset completo.
    As versões "filtradas" mostradas nos cards são recalculadas no
    client a partir do payload de /leituras/mapa, para refletir os
    filtros instantaneamente sem round-trip ao backend.
    """
    df = request.app.state.data_store.get_dataframe()
    if df.empty:
        return Estatisticas(
            total_leituras=0, total_colaboradores=0, total_ocorrencias=0,
            total_cidades=0, total_micros=0, total_matriculas=0,
        )

    return Estatisticas(
        total_leituras=len(df),
        total_colaboradores=_nunique(df, "colaborador"),
        total_ocorrencias=_nunique(df, "ocorrencia"),
        total_cidades=_nunique(df, "cidade"),
        total_micros=_nunique(df, "micro"),
        total_matriculas=_nunique(df, "matricula"),
    )
