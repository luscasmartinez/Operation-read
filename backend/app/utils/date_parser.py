"""
Converte datas no formato retornado pelo Excel/Google Sheets em pt-BR,
ex: "quinta-feira, jul 16, 2026", para ISO 8601 (YYYY-MM-DD).

Também é tolerante a valores já vindos como datetime do pandas
(quando o Excel armazena a célula como data nativa em vez de texto).
"""
import re
from datetime import datetime

import pandas as pd

_MESES_PT = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
}

_DATA_TEXTO_RE = re.compile(
    r"(?P<mes>[A-Za-zçÇ]{3,})\.?\s+(?P<dia>\d{1,2}),?\s+(?P<ano>\d{4})",
    re.IGNORECASE,
)


def parse_data_leitura(value) -> str | None:
    """Retorna a data no formato ISO 'YYYY-MM-DD', ou None se não for parseável."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%Y-%m-%d")

    text = str(value).strip()
    if not text:
        return None

    match = _DATA_TEXTO_RE.search(text)
    if match:
        mes_raw = match.group("mes").lower()[:3]
        mes = _MESES_PT.get(mes_raw)
        if mes:
            dia = int(match.group("dia"))
            ano = int(match.group("ano"))
            try:
                return datetime(ano, mes, dia).strftime("%Y-%m-%d")
            except ValueError:
                return None

    # fallback: deixa o pandas tentar interpretar formatos comuns (dd/mm/yyyy etc.)
    try:
        parsed = pd.to_datetime(text, dayfirst=True, errors="coerce")
        if pd.notna(parsed):
            return parsed.strftime("%Y-%m-%d")
    except Exception:
        pass

    return None


def parse_hora_leitura(value) -> str | None:
    """Retorna a hora no formato 'HH:MM:SS', tolerando formato AM/PM."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None

    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%H:%M:%S")

    text = str(value).strip()
    if not text:
        return None

    for fmt in ("%I:%M:%S %p", "%H:%M:%S", "%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M:%S")
        except ValueError:
            continue
    return None
