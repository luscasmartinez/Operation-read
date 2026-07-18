import { useQuery } from "@tanstack/react-query";
import { mapaService } from "../services/mapaService";
import type { FiltrosAtivos, FiltrosDisponiveis } from "../types/leitura";

const vazio: FiltrosDisponiveis = {
  cidade: [], micro: [], grupo: [], colaborador: [],
  ocorrencia: [], indicador: [], referencia: [],
};

/**
 * Retorna os valores disponíveis para cada filtro em cascata.
 * O backend estreita as opções downstream com base nos filtros upstream selecionados.
 */
export function useFiltrosDisponiveis(filtros: FiltrosAtivos): FiltrosDisponiveis {
  const { data } = useQuery({
    queryKey: [
      "filtros",
      filtros.referencia,
      filtros.cidade,
      filtros.micro,
      filtros.grupo,
      filtros.colaborador,
      filtros.ocorrencia,
    ],
    queryFn: () => mapaService.buscarFiltros(filtros),
    staleTime: 60_000,
  });
  return data ?? vazio;
}
