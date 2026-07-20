"""
Schemas de resposta da API.

Existem dois níveis de detalhe, propositalmente:
- LeituraMapa: payload leve (só o necessário para desenhar o marcador
  e alimentar os filtros no client), usado para carregar o mapa
  inteiro de uma vez, mesmo com centenas de milhares de registros.
- LeituraDetalhe: todas as colunas, buscado sob demanda quando o
  usuário clica em um marcador (endpoint /leituras/{id}).
"""
from typing import Any

from pydantic import BaseModel


class LeituraMapa(BaseModel):
    id: int
    lat: float
    lon: float
    cidade: str | None = None
    micro: str | None = None
    grupo: str | None = None
    colaborador: str | None = None
    ocorrencia: str | None = None
    indicador: str | None = None
    referencia: str | None = None
    matricula: str | None = None
    data_leitura: str | None = None


class LeituraDetalhe(BaseModel):
    id: int
    campos: dict[str, Any]


class Estatisticas(BaseModel):
    total_leituras: int
    total_colaboradores: int
    total_ocorrencias: int
    total_cidades: int
    total_micros: int
    total_matriculas: int


class FiltrosDisponiveis(BaseModel):
    cidade: list[str]
    micro: list[str]
    grupo: list[str]
    colaborador: list[str]
    ocorrencia: list[str]
    indicador: list[str]
    referencia: list[str]


class StatusSincronizacao(BaseModel):
    last_sync: str | None
    files_loaded: int
    total_records: int


class ContagemResponse(BaseModel):
    total: int
    necessita_confirmacao: bool


class SyncStatusResponse(BaseModel):
    ultimaAtualizacao: str | None
    arquivoModificadoEm: str | None
    totalRegistros: int


MAX_REGISTROS_SEM_CONFIRMACAO: int = 50_000
