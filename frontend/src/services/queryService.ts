/**
 * queryService.ts
 *
 * Camada de acesso ao IndexedDB via Dexie.
 * Substitui completamente as chamadas à API para filtros e marcadores do mapa.
 * Toda filtragem acontece localmente, sem consultas de rede.
 */

import { db, type RegistroLocal } from "../database/db";
import type { FiltrosAtivos, FiltrosDisponiveis, LeituraMapa } from "../types/leitura";

export const MAX_SEM_CONFIRMACAO = 50_000;

// ── Utilitários ───────────────────────────────────────────────────────────────

function uniqueSorted(arr: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of arr) {
    if (v && v.trim()) set.add(v.trim());
  }
  return [...set].sort();
}

/** Aplica todos os filtros ativos em um array já carregado (filtragem em memória). */
function filtrarEmMemoria(
  registros: RegistroLocal[],
  filtros: FiltrosAtivos
): RegistroLocal[] {
  let r = registros;

  if (filtros.cidade.length) {
    const s = new Set(filtros.cidade);
    r = r.filter((x) => x.cidade != null && s.has(x.cidade));
  }
  if (filtros.micro.length) {
    const s = new Set(filtros.micro);
    r = r.filter((x) => x.micro != null && s.has(x.micro));
  }
  if (filtros.grupo.length) {
    const s = new Set(filtros.grupo);
    r = r.filter((x) => x.grupo != null && s.has(x.grupo));
  }
  if (filtros.colaborador.length) {
    const s = new Set(filtros.colaborador);
    r = r.filter((x) => x.colaborador != null && s.has(x.colaborador));
  }
  if (filtros.ocorrencia.length) {
    const s = new Set(filtros.ocorrencia);
    r = r.filter((x) => x.ocorrencia != null && s.has(x.ocorrencia));
  }
  if (filtros.indicador.length) {
    const s = new Set(filtros.indicador);
    r = r.filter((x) => x.indicador != null && s.has(x.indicador));
  }
  if (filtros.matricula) {
    r = r.filter((x) => x.matricula === filtros.matricula);
  }
  if (filtros.dataInicial) {
    r = r.filter(
      (x) => x.data_leitura != null && x.data_leitura >= filtros.dataInicial!
    );
  }
  if (filtros.dataFinal) {
    r = r.filter(
      (x) => x.data_leitura != null && x.data_leitura <= filtros.dataFinal!
    );
  }

  return r;
}

/** Carrega registros usando o índice mais seletivo disponível. */
async function carregarComIndice(filtros: FiltrosAtivos): Promise<RegistroLocal[]> {
  // Usa o índice de referencia (sempre obrigatório para o mapa) quando disponível
  if (filtros.referencia.length) {
    return db.registros
      .where("referencia")
      .anyOf(filtros.referencia)
      .toArray();
  }
  // Fallback: table scan completo (não deve ocorrer no fluxo normal)
  return db.registros.toArray();
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Calcula os filtros disponíveis em cascata a partir dos filtros ativos.
 *
 * Estratégia:
 * - Sem nenhum filtro ativo → usa orderBy().uniqueKeys() para cada campo
 *   (lê apenas o índice, não os registros completos → muito rápido).
 * - Com filtros ativos → carrega o subconjunto filtrado e extrai valores únicos.
 */
export async function calcularFiltrosDisponiveis(
  filtros: FiltrosAtivos
): Promise<FiltrosDisponiveis> {
  const semFiltros =
    !filtros.referencia.length &&
    !filtros.cidade.length &&
    !filtros.micro.length &&
    !filtros.grupo.length &&
    !filtros.colaborador.length &&
    !filtros.ocorrencia.length;

  if (semFiltros) {
    // Usa apenas os índices — não carrega nenhum registro completo
    const [referencia, cidade, micro, grupo, colaborador, ocorrencia, indicador] =
      await Promise.all([
        db.registros.orderBy("referencia").uniqueKeys(),
        db.registros.orderBy("cidade").uniqueKeys(),
        db.registros.orderBy("micro").uniqueKeys(),
        db.registros.orderBy("grupo").uniqueKeys(),
        db.registros.orderBy("colaborador").uniqueKeys(),
        db.registros.orderBy("ocorrencia").uniqueKeys(),
        db.registros.orderBy("indicador").uniqueKeys(),
      ]);

    return {
      referencia: (referencia as string[]).filter(Boolean).sort(),
      cidade: (cidade as string[]).filter(Boolean).sort(),
      micro: (micro as string[]).filter(Boolean).sort(),
      grupo: (grupo as string[]).filter(Boolean).sort(),
      colaborador: (colaborador as string[]).filter(Boolean).sort(),
      ocorrencia: (ocorrencia as string[]).filter(Boolean).sort(),
      indicador: (indicador as string[]).filter(Boolean).sort(),
    };
  }

  // ── Filtragem em cascata ──────────────────────────────────────────────────
  // Referencia: sempre exibe todas as opções (sem filtro upstream)
  const todasReferencias = (
    (await db.registros.orderBy("referencia").uniqueKeys()) as string[]
  )
    .filter(Boolean)
    .sort();

  // A partir daqui, filtra progressivamente
  let pool = filtros.referencia.length
    ? await db.registros.where("referencia").anyOf(filtros.referencia).toArray()
    : await db.registros.toArray();

  const cidades = uniqueSorted(pool.map((r) => r.cidade));

  if (filtros.cidade.length) {
    const s = new Set(filtros.cidade);
    pool = pool.filter((r) => r.cidade != null && s.has(r.cidade));
  }

  const micros = uniqueSorted(pool.map((r) => r.micro));

  if (filtros.micro.length) {
    const s = new Set(filtros.micro);
    pool = pool.filter((r) => r.micro != null && s.has(r.micro));
  }

  const grupos = uniqueSorted(pool.map((r) => r.grupo));

  if (filtros.grupo.length) {
    const s = new Set(filtros.grupo);
    pool = pool.filter((r) => r.grupo != null && s.has(r.grupo));
  }

  const colaboradores = uniqueSorted(pool.map((r) => r.colaborador));

  if (filtros.colaborador.length) {
    const s = new Set(filtros.colaborador);
    pool = pool.filter((r) => r.colaborador != null && s.has(r.colaborador));
  }

  const ocorrencias = uniqueSorted(pool.map((r) => r.ocorrencia));

  if (filtros.ocorrencia.length) {
    const s = new Set(filtros.ocorrencia);
    pool = pool.filter((r) => r.ocorrencia != null && s.has(r.ocorrencia));
  }

  const indicadores = uniqueSorted(pool.map((r) => r.indicador));

  return {
    referencia: todasReferencias,
    cidade: cidades,
    micro: micros,
    grupo: grupos,
    colaborador: colaboradores,
    ocorrencia: ocorrencias,
    indicador: indicadores,
  };
}

/**
 * Conta os registros que correspondem aos filtros ativos.
 * Usa o índice de referencia para limitar o conjunto inicial.
 */
export async function contarRegistrosFiltrados(
  filtros: FiltrosAtivos
): Promise<{ total: number; necessita_confirmacao: boolean }> {
  const pool = await carregarComIndice(filtros);
  const filtrado = filtrarEmMemoria(pool, filtros);
  return {
    total: filtrado.length,
    necessita_confirmacao: filtrado.length > MAX_SEM_CONFIRMACAO,
  };
}

/**
 * Retorna os marcadores do mapa para os filtros fornecidos.
 * Inclui apenas registros com coordenadas válidas.
 * A busca textual (filtros.busca) é aplicada separadamente no hook useLeiturasFiltradas.
 */
export async function consultarMarcadores(
  filtros: FiltrosAtivos
): Promise<LeituraMapa[]> {
  const pool = await carregarComIndice(filtros);
  const filtrado = filtrarEmMemoria(pool, filtros);

  return filtrado
    .filter((r) => r.lat !== 0 || r.lon !== 0)
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lon: r.lon,
      cidade: r.cidade ?? null,
      micro: r.micro ?? null,
      grupo: r.grupo ?? null,
      colaborador: r.colaborador ?? null,
      ocorrencia: r.ocorrencia ?? null,
      indicador: r.indicador ?? null,
      referencia: r.referencia ?? null,
      matricula: r.matricula ?? null,
      data_leitura: r.data_leitura ?? null,
    }));
}

/**
 * Busca todos os campos de um registro pelo ID para exibição no popup.
 * Substitui a chamada a /leituras/:id da API.
 */
export async function obterDetalheRegistro(
  id: number
): Promise<Record<string, unknown> | null> {
  const registro = await db.registros.get(id);
  if (!registro) return null;
  // Remove campos internos do IndexedDB
  const { id: _id, lat, lon, ...campos } = registro;
  return campos as Record<string, unknown>;
}
