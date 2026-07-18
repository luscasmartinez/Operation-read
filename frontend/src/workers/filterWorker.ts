import type { FiltrosAtivos, LeituraMapa } from "../types/leitura";

export interface FilterWorkerRequest {
  dados: LeituraMapa[];
  filtros: FiltrosAtivos;
}

export interface FilterWorkerResponse {
  ids: number[];
}

function matchesArrayFilter(value: string | null, selected: string[]): boolean {
  if (selected.length === 0) return true;
  return value !== null && selected.includes(value);
}

function matchesBusca(item: LeituraMapa, termo: string): boolean {
  if (!termo) return true;
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return true;

  return (
    (item.matricula?.toLowerCase().includes(alvo) ?? false) ||
    (item.colaborador?.toLowerCase().includes(alvo) ?? false) ||
    (item.ocorrencia?.toLowerCase().includes(alvo) ?? false) ||
    (item.indicador?.toLowerCase().includes(alvo) ?? false) ||
    (item.cidade?.toLowerCase().includes(alvo) ?? false) ||
    (item.micro?.toLowerCase().includes(alvo) ?? false) ||
    (item.referencia?.toLowerCase().includes(alvo) ?? false)
  );
}

self.onmessage = (event: MessageEvent<FilterWorkerRequest>) => {
  const { dados, filtros } = event.data;

  const ids: number[] = [];
  for (const item of dados) {
    if (!matchesArrayFilter(item.cidade, filtros.cidade)) continue;
    if (!matchesArrayFilter(item.micro, filtros.micro)) continue;
    if (!matchesArrayFilter(item.grupo, filtros.grupo)) continue;
    if (!matchesArrayFilter(item.colaborador, filtros.colaborador)) continue;
    if (!matchesArrayFilter(item.ocorrencia, filtros.ocorrencia)) continue;
    if (!matchesArrayFilter(item.indicador, filtros.indicador)) continue;
    if (!matchesArrayFilter(item.referencia, filtros.referencia)) continue;

    if (filtros.matricula && item.matricula !== filtros.matricula) continue;

    if (filtros.dataInicial && (!item.data_leitura || item.data_leitura < filtros.dataInicial)) continue;
    if (filtros.dataFinal && (!item.data_leitura || item.data_leitura > filtros.dataFinal)) continue;

    if (!matchesBusca(item, filtros.busca)) continue;

    ids.push(item.id);
  }

  const response: FilterWorkerResponse = { ids };
  (self as unknown as Worker).postMessage(response);
};
