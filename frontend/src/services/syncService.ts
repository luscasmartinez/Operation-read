import { db, type MetadataLocal, type RegistroLocal } from "../database/db";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface SyncStatusRemoto {
  ultimaAtualizacao: string | null;
  arquivoModificadoEm: string | null;
  totalRegistros: number;
}

export type FaseSinc =
  | "verificando"
  | "baixando"
  | "salvando"
  | "concluido"
  | "erro";

export interface ProgressoSync {
  fase: FaseSinc;
  porcentagem: number;
  registrosProcessados: number;
  totalRegistros: number;
  /** Registros por segundo (estimado). */
  velocidade: number;
  /** Segundos restantes estimados (null quando não calculável). */
  tempoRestante: number | null;
  erro?: string;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Erro ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Retorna true se o banco local já contém registros. */
export async function verificarBaseLocal(): Promise<boolean> {
  const count = await db.registros.count();
  return count > 0;
}

/** Retorna o registro de metadados local (pode ser undefined se nunca sincronizou). */
export async function obterMetadata(): Promise<MetadataLocal | undefined> {
  return db.metadata.get(1);
}

/** Retorna a data/hora da última sincronização local ou null. */
export async function obterUltimaAtualizacao(): Promise<string | null> {
  const meta = await obterMetadata();
  return meta?.ultimaSincronizacao ?? null;
}

/** Consulta o endpoint /sync/status no backend. */
export async function verificarStatusRemoto(): Promise<SyncStatusRemoto> {
  return fetchJson<SyncStatusRemoto>("/sync/status");
}

/**
 * Verifica se os dados locais já estão atualizados em relação ao Drive.
 * Retorna true quando o arquivo remoto não foi alterado desde a última sync.
 */
export async function dadosJaAtualizados(): Promise<boolean> {
  const meta = await obterMetadata();
  if (!meta?.arquivoModificadoEm) return false;
  try {
    const remoto = await verificarStatusRemoto();
    if (!remoto.arquivoModificadoEm) return false;
    return meta.arquivoModificadoEm >= remoto.arquivoModificadoEm;
  } catch {
    return false;
  }
}

/**
 * Executa a sincronização completa de forma segura:
 *
 * 1. Verifica o status remoto.
 * 2. Baixa os registros via streaming NDJSON.
 * 3. Salva em transação atômica (clear + bulkAdd + metadata).
 *    Se qualquer etapa falhar, o banco anterior é preservado.
 *
 * @returns true se a sincronização foi executada; false se os dados já estavam atualizados.
 */
export async function sincronizarDados(
  onProgresso: (p: ProgressoSync) => void
): Promise<boolean> {
  // ── 1. Verificar status ───────────────────────────────────────────────────
  onProgresso({
    fase: "verificando",
    porcentagem: 0,
    registrosProcessados: 0,
    totalRegistros: 0,
    velocidade: 0,
    tempoRestante: null,
  });

  let statusRemoto: SyncStatusRemoto;
  try {
    statusRemoto = await verificarStatusRemoto();
  } catch {
    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: 0,
      totalRegistros: 0,
      velocidade: 0,
      tempoRestante: null,
      erro: "Não foi possível conectar ao servidor. Verifique sua conexão.",
    });
    throw new Error("Falha ao conectar ao servidor.");
  }

  // Verificar se já está atualizado
  const meta = await obterMetadata();
  if (
    meta?.arquivoModificadoEm &&
    statusRemoto.arquivoModificadoEm &&
    meta.arquivoModificadoEm >= statusRemoto.arquivoModificadoEm
  ) {
    return false; // Já atualizado
  }

  const totalEsperado = statusRemoto.totalRegistros;

  // ── 2. Baixar via NDJSON streaming ────────────────────────────────────────
  const registros: RegistroLocal[] = [];
  let totalStream = totalEsperado;
  const inicioDownload = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/sync`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao baixar dados.`);

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let primeiraLinha = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const linhas = buffer.split("\n");
      buffer = linhas.pop() ?? "";

      for (const linha of linhas) {
        const trimmed = linha.trim();
        if (!trimmed) continue;

        const obj = JSON.parse(trimmed) as Record<string, unknown>;

        if (primeiraLinha) {
          // Primeira linha: cabeçalho {"total": N}
          totalStream = (obj.total as number) ?? totalEsperado;
          primeiraLinha = false;
          continue;
        }

        registros.push(obj as unknown as RegistroLocal);

        // Notificar a cada 500 registros para não travar a thread de UI
        if (registros.length % 500 === 0) {
          const elapsed = (Date.now() - inicioDownload) / 1000;
          const velocidade =
            elapsed > 0 ? Math.round(registros.length / elapsed) : 0;
          const restante =
            velocidade > 0 && totalStream > 0
              ? Math.round((totalStream - registros.length) / velocidade)
              : null;
          const pct =
            totalStream > 0 ? (registros.length / totalStream) * 70 : 0;

          onProgresso({
            fase: "baixando",
            porcentagem: 5 + pct, // 5% → 75%
            registrosProcessados: registros.length,
            totalRegistros: totalStream,
            velocidade,
            tempoRestante: restante,
          });
        }
      }
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Falha ao baixar os dados.";
    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: 0,
      totalRegistros: totalStream,
      velocidade: 0,
      tempoRestante: null,
      erro: msg,
    });
    throw err;
  }

  // ── 3. Salvar no IndexedDB de forma atômica ───────────────────────────────
  const totalReal = registros.length;
  const CHUNK = 5_000;
  const inicioSalvamento = Date.now();

  onProgresso({
    fase: "salvando",
    porcentagem: 75,
    registrosProcessados: 0,
    totalRegistros: totalReal,
    velocidade: 0,
    tempoRestante: null,
  });

  try {
    await db.transaction("rw", db.registros, db.metadata, async () => {
      // Limpa a tabela existente dentro da transação
      await db.registros.clear();

      // Insere em lotes para controle de progresso
      for (let i = 0; i < registros.length; i += CHUNK) {
        await db.registros.bulkAdd(registros.slice(i, i + CHUNK));

        const salvos = Math.min(i + CHUNK, totalReal);
        const elapsed = (Date.now() - inicioSalvamento) / 1000;
        const velocidade =
          elapsed > 0 ? Math.round(salvos / elapsed) : 0;
        const restante =
          velocidade > 0
            ? Math.round((totalReal - salvos) / velocidade)
            : null;

        onProgresso({
          fase: "salvando",
          porcentagem: 75 + (salvos / totalReal) * 24, // 75% → 99%
          registrosProcessados: salvos,
          totalRegistros: totalReal,
          velocidade,
          tempoRestante: restante,
        });
      }

      // Atualiza metadados dentro da mesma transação
      await db.metadata.put({
        id: 1,
        ultimaAtualizacao: statusRemoto.ultimaAtualizacao,
        totalRegistros: totalReal,
        arquivoModificadoEm: statusRemoto.arquivoModificadoEm,
        ultimaSincronizacao: new Date().toISOString(),
        versao: 1,
      });
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Falha ao salvar os dados localmente.";
    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: 0,
      totalRegistros: totalReal,
      velocidade: 0,
      tempoRestante: null,
      erro: msg,
    });
    throw err;
  }

  onProgresso({
    fase: "concluido",
    porcentagem: 100,
    registrosProcessados: totalReal,
    totalRegistros: totalReal,
    velocidade: 0,
    tempoRestante: 0,
  });

  return true;
}
