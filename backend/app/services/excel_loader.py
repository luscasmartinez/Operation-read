"""
Lê um arquivo Excel (bytes) e retorna um DataFrame com colunas
normalizadas e tipadas corretamente.
"""
import io
import logging

import pandas as pd

from app.utils.column_mapper import map_columns
from app.utils.date_parser import parse_data_leitura, parse_hora_leitura

logger = logging.getLogger(__name__)

REQUIRED_COLUMNS = {"latitude", "longitude"}


def load_excel(content: bytes, source_file_name: str) -> pd.DataFrame:
    """Converte os bytes de um .xlsx em um DataFrame normalizado."""
    try:
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    except Exception:
        logger.exception("Falha ao ler o arquivo %s", source_file_name)
        return pd.DataFrame()

    if df.empty:
        return df

    column_map = map_columns(list(df.columns))
    df = df.rename(columns=column_map)

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        logger.warning(
            "Arquivo %s não possui as colunas obrigatórias %s — ignorando arquivo.",
            source_file_name,
            missing,
        )
        return pd.DataFrame()

    # Coordenadas: descarta linhas sem lat/lon válidas (não renderizáveis no mapa)
    df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")
    df = df.dropna(subset=["latitude", "longitude"])

    if "data_leitura" in df.columns:
        df["data_leitura"] = df["data_leitura"].apply(parse_data_leitura)
    if "hora_leitura" in df.columns:
        df["hora_leitura"] = df["hora_leitura"].apply(parse_hora_leitura)

    if "matricula" in df.columns:
        df["matricula"] = df["matricula"].astype(str).str.strip()

    for text_col in ("colaborador", "ocorrencia", "indicador", "grupo", "cidade", "micro", "referencia"):
        if text_col in df.columns:
            df[text_col] = df[text_col].astype(str).str.strip()

    df["_arquivo_origem"] = source_file_name
    df = df.reset_index(drop=True)
    return df
