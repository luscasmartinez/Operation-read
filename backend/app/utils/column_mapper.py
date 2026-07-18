"""
Normaliza nomes de colunas vindos do Excel para um schema interno estável.

Isso protege a aplicação contra pequenas variações entre planilhas
(espaços extras, maiúsculas/minúsculas, acentuação, nomes com
underscores/parênteses como "SumROTA__CADASTRO_").
"""
import re
import unicodedata

# Mapeia variações conhecidas -> nome canônico interno
CANONICAL_COLUMNS = {
    "DATA_LEITURA": "data_leitura",
    "DSC_COLABORADOR": "colaborador",
    "OCORRENCIA": "ocorrencia",
    "INDICADOR": "indicador",
    "MATRICULA": "matricula",
    "LONGITUDE REAL": "longitude",
    "LATITUDE REAL": "latitude",
    "GRUPO": "grupo",
    "HORA_LEITURA": "hora_leitura",
    "REFERENCIA": "referencia",
    "MICRO": "micro",
    "CIDADE": "cidade",
    "SUMROTA__CADASTRO_": "sum_rota_cadastro",
}


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def normalize_column_name(raw_name: str) -> str:
    """Converte um nome de coluna bruto do Excel para a chave de busca no mapa."""
    cleaned = _strip_accents(str(raw_name)).strip().upper()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def map_columns(columns: list[str]) -> dict[str, str]:
    """
    Retorna um dicionário {nome_original_no_excel: nome_canonico}.
    Colunas não mapeadas mantêm um nome canônico "slugificado" próprio,
    para que continuem disponíveis (requisito: "todas as demais colunas
    disponíveis" no popup).
    """
    result = {}
    for col in columns:
        key = normalize_column_name(col)
        if key in CANONICAL_COLUMNS:
            result[col] = CANONICAL_COLUMNS[key]
        else:
            slug = re.sub(r"[^a-z0-9]+", "_", _strip_accents(str(col)).lower()).strip("_")
            result[col] = slug or f"col_{abs(hash(col)) % 10000}"
    return result
