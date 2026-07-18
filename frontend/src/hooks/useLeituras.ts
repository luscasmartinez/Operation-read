import { useQuery } from "@tanstack/react-query";
import { mapaService } from "../services/mapaService";
import type { FiltrosAtivos } from "../types/leitura";

export function filtrosObrigatoriosValidos(filtros: FiltrosAtivos): boolean {
  return (
    filtros.referencia.length > 0 &&
    (filtros.cidade.length > 0 || filtros.micro.length > 0)
  );
}

/** Consulta somente a contagem — sem payload geográfico. */
export function useContagem(filtros: FiltrosAtivos) {
  return useQuery({
    queryKey: ["contagem", filtros],
    queryFn: () => mapaService.contarRegistros(filtros),
    enabled: filtrosObrigatoriosValidos(filtros),
    staleTime: 30_000,
    retry: 1,
  });
}

/** Carrega os marcadores filtrados. Só ativa quando `enabled` for true. */
export function useMapa(filtros: FiltrosAtivos | null, enabled: boolean) {
  return useQuery({
    queryKey: ["mapa", filtros],
    queryFn: () => mapaService.buscarMarcadores(filtros!),
    enabled: enabled && filtros !== null,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}
