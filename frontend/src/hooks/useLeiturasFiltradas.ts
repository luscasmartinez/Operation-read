import { useMemo } from "react";
import type { FiltrosAtivos, LeituraMapa } from "../types/leitura";

/**
 * Filtra client-side apenas pelo campo `busca` (texto livre).
 * Toda a filtragem por Referência, Cidade, etc. já foi feita no backend.
 */
export function useLeiturasFiltradas(
  dados: LeituraMapa[],
  filtros: FiltrosAtivos
): LeituraMapa[] {
  return useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    if (!termo) return dados;
    return dados.filter(
      (item) =>
        (item.matricula?.toLowerCase().includes(termo)    ?? false) ||
        (item.colaborador?.toLowerCase().includes(termo)  ?? false) ||
        (item.ocorrencia?.toLowerCase().includes(termo)   ?? false) ||
        (item.indicador?.toLowerCase().includes(termo)    ?? false) ||
        (item.cidade?.toLowerCase().includes(termo)       ?? false) ||
        (item.micro?.toLowerCase().includes(termo)        ?? false) ||
        (item.referencia?.toLowerCase().includes(termo)   ?? false)
    );
  }, [dados, filtros.busca]);
}
