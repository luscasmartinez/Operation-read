import type {
  Estatisticas,
  FiltrosDisponiveis,
  LeituraDetalhe,
  LeituraMapa,
} from "../types/leitura";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Falha na requisição ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  leiturasMapa: () => getJson<LeituraMapa[]>("/leituras/mapa"),
  leituraDetalhe: (id: number) => getJson<LeituraDetalhe>(`/leituras/${id}`),
  estatisticas: () => getJson<Estatisticas>("/estatisticas"),
  filtros: () => getJson<FiltrosDisponiveis>("/filtros"),
};
