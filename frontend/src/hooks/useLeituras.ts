import { useQuery } from "@tanstack/react-query";
import {
  consultarMarcadores,
  contarRegistrosFiltrados,
} from "../services/queryService";
import type { FiltrosAtivos } from "../types/leitura";

export function filtrosObrigatoriosValidos(filtros: FiltrosAtivos): boolean {
  return (
    filtros.referencia.length > 0 &&
    (filtros.cidade.length > 0 || filtros.micro.length > 0)
  );
}

/**
 * Conta os registros que correspondem aos filtros ativos consultando o IndexedDB.
 * Nunca realiza chamadas à API.
 */
export function useContagem(filtros: FiltrosAtivos) {
  return useQuery({
    queryKey: ["contagem-local", filtros],
    queryFn: () => contarRegistrosFiltrados(filtros),
    enabled: filtrosObrigatoriosValidos(filtros),
    staleTime: Infinity,
    retry: 0,
  });
}

/**
 * Retorna os marcadores do mapa consultando exclusivamente o IndexedDB.
 * Nunca realiza chamadas à API.
 */
export function useMapa(filtros: FiltrosAtivos | null, enabled: boolean) {
  return useQuery({
    queryKey: ["mapa-local", filtros],
    queryFn: () => consultarMarcadores(filtros!),
    enabled: enabled && filtros !== null,
    staleTime: Infinity,
    retry: 0,
  });
}
