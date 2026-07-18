import type {
  ContagemResponse,
  FiltrosAtivos,
  FiltrosDisponiveis,
  LeituraDetalhe,
  LeituraMapa,
} from "../types/leitura";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filtrosParaParams(filtros: Partial<FiltrosAtivos>): URLSearchParams {
  const p = new URLSearchParams();
  (filtros.referencia  ?? []).forEach((v) => p.append("referencia",  v));
  (filtros.cidade      ?? []).forEach((v) => p.append("cidade",      v));
  (filtros.micro       ?? []).forEach((v) => p.append("micro",       v));
  (filtros.grupo       ?? []).forEach((v) => p.append("grupo",       v));
  (filtros.colaborador ?? []).forEach((v) => p.append("colaborador", v));
  (filtros.ocorrencia  ?? []).forEach((v) => p.append("ocorrencia",  v));
  (filtros.indicador   ?? []).forEach((v) => p.append("indicador",   v));
  if (filtros.matricula)   p.set("matricula",    filtros.matricula);
  if (filtros.dataInicial) p.set("data_inicial", filtros.dataInicial);
  if (filtros.dataFinal)   p.set("data_final",   filtros.dataFinal);
  if (filtros.busca?.trim()) p.set("busca",       filtros.busca.trim());
  return p;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.detail?.erro ?? body?.erro ?? `Erro ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export const mapaService = {
  /** Conta registros filtrados. Rápido — sem payload geográfico. */
  contarRegistros: (filtros: FiltrosAtivos): Promise<ContagemResponse> =>
    getJson(`/leituras/contagem?${filtrosParaParams(filtros)}`),

  /** Carrega os marcadores filtrados para renderizar no mapa. */
  buscarMarcadores: (filtros: FiltrosAtivos): Promise<LeituraMapa[]> =>
    getJson(`/leituras/mapa?${filtrosParaParams(filtros)}`),

  /** Filtros disponíveis em cascata dado o estado atual dos filtros upstream. */
  buscarFiltros: (filtros: Partial<FiltrosAtivos>): Promise<FiltrosDisponiveis> =>
    getJson(`/filtros?${filtrosParaParams(filtros)}`),

  /** Detalhe completo de uma leitura (usado no popup). */
  buscarDetalhe: (id: number): Promise<LeituraDetalhe> =>
    getJson(`/leituras/${id}`),
};
