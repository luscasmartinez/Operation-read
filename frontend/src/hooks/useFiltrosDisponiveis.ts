import { useQuery } from "@tanstack/react-query";
import { calcularFiltrosDisponiveis } from "../services/queryService";
import type { FiltrosAtivos, FiltrosDisponiveis } from "../types/leitura";

const vazio: FiltrosDisponiveis = {
  cidade: [], micro: [], grupo: [], colaborador: [],
  ocorrencia: [], indicador: [], referencia: [],
};

/**
 * Calcula os filtros disponíveis em cascata consultando exclusivamente o IndexedDB.
 * Nunca realiza chamadas à API.
 */
export function useFiltrosDisponiveis(filtros: FiltrosAtivos): FiltrosDisponiveis {
  const { data } = useQuery({
    queryKey: [
      "filtros-local",
      filtros.referencia,
      filtros.cidade,
      filtros.micro,
      filtros.grupo,
      filtros.colaborador,
      filtros.ocorrencia,
    ],
    queryFn: () => calcularFiltrosDisponiveis(filtros),
    // Dados locais não mudam até a próxima sync; sem necessidade de revalidar
    staleTime: Infinity,
    placeholderData: vazio,
  });
  return data ?? vazio;
}
