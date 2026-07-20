import { db, type MetadataLocal, type RegistroLocal } from "../database/db";

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

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
  /** Registros por segundo estimados. */
  velocidade: number;
  /** Segundos restantes estimados. */
  tempoRestante: number | null;
  erro?: string;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

function formatarQuantidade(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

function criarErroHttp(
  status: number,
  path: string,
  respostaTexto?: string
): Error {
  const detalhe = respostaTexto?.trim()
    ? ` Resposta: ${respostaTexto.trim().slice(0, 300)}`
    : "";

  return new Error(`Erro HTTP ${status} em ${path}.${detalhe}`);
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    throw criarErroHttp(res.status, path, texto);
  }

  return (await res.json()) as T;
}

function calcularMetricas(
  registrosProcessados: number,
  totalRegistros: number,
  inicio: number
): {
  velocidade: number;
  tempoRestante: number | null;
} {
  const segundos = Math.max((Date.now() - inicio) / 1000, 0.001);
  const velocidade = Math.round(registrosProcessados / segundos);

  const tempoRestante =
    velocidade > 0 && totalRegistros > registrosProcessados
      ? Math.round((totalRegistros - registrosProcessados) / velocidade)
      : 0;

  return {
    velocidade,
    tempoRestante,
  };
}

function processarLinhaNdjson(
  linha: string,
  primeiraLinha: boolean,
  totalEsperado: number
): {
  registro?: RegistroLocal;
  totalStream?: number;
  primeiraLinha: boolean;
} {
  const trimmed = linha.trim();

  if (!trimmed) {
    return { primeiraLinha };
  }

  let objeto: Record<string, unknown>;

  try {
    objeto = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(
      `O servidor enviou uma linha NDJSON inválida: ${trimmed.slice(0, 200)}`
    );
  }

  if (primeiraLinha) {
    const totalInformado = Number(objeto.total ?? totalEsperado);

    if (!Number.isFinite(totalInformado) || totalInformado < 0) {
      throw new Error("O cabeçalho do stream possui um total inválido.");
    }

    return {
      totalStream: totalInformado,
      primeiraLinha: false,
    };
  }

  return {
    registro: objeto as unknown as RegistroLocal,
    primeiraLinha: false,
  };
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Retorna true se o banco local já contém registros. */
export async function verificarBaseLocal(): Promise<boolean> {
  const count = await db.registros.count();
  return count > 0;
}

/** Retorna o registro de metadados local. */
export async function obterMetadata(): Promise<MetadataLocal | undefined> {
  return db.metadata.get(1);
}

/** Retorna a data/hora da última sincronização local. */
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
 */
export async function dadosJaAtualizados(): Promise<boolean> {
  const meta = await obterMetadata();

  if (!meta?.arquivoModificadoEm) {
    return false;
  }

  try {
    const remoto = await verificarStatusRemoto();

    if (!remoto.arquivoModificadoEm) {
      return false;
    }

    return meta.arquivoModificadoEm >= remoto.arquivoModificadoEm;
  } catch {
    return false;
  }
}

/**
 * Executa a sincronização completa.
 *
 * Regras:
 * - não substitui o banco local se o stream terminar incompleto;
 * - valida o total recebido contra /sync/status e contra o cabeçalho NDJSON;
 * - valida o total efetivamente salvo no IndexedDB;
 * - somente grava metadata após uma sincronização integral.
 */
export async function sincronizarDados(
  onProgresso: (progresso: ProgressoSync) => void
): Promise<boolean> {
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
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Não foi possível conectar ao servidor.";

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: 0,
      totalRegistros: 0,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  const metaAtual = await obterMetadata();

  if (
    metaAtual?.arquivoModificadoEm &&
    statusRemoto.arquivoModificadoEm &&
    metaAtual.arquivoModificadoEm >= statusRemoto.arquivoModificadoEm
  ) {
    return false;
  }

  const totalEsperado = Number(statusRemoto.totalRegistros);

  if (!Number.isFinite(totalEsperado) || totalEsperado <= 0) {
    throw new Error(
      `O servidor informou um total inválido: ${statusRemoto.totalRegistros}.`
    );
  }

  // ── Download do NDJSON ─────────────────────────────────────────────────────

  const registros: RegistroLocal[] = [];
  const inicioDownload = Date.now();

  let totalStream = totalEsperado;
  let primeiraLinha = true;
  let buffer = "";

  onProgresso({
    fase: "baixando",
    porcentagem: 0,
    registrosProcessados: 0,
    totalRegistros: totalEsperado,
    velocidade: 0,
    tempoRestante: null,
  });

  try {
    const res = await fetch(`${BASE_URL}/sync`, {
      method: "GET",
      headers: {
        Accept: "application/x-ndjson, application/ndjson, text/plain",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      throw criarErroHttp(res.status, "/sync", texto);
    }

    if (!res.body) {
      throw new Error("O servidor não forneceu um fluxo de dados.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: !done });

        const linhas = buffer.split("\n");
        buffer = linhas.pop() ?? "";

        for (const linha of linhas) {
          const resultado = processarLinhaNdjson(
            linha,
            primeiraLinha,
            totalEsperado
          );

          primeiraLinha = resultado.primeiraLinha;

          if (resultado.totalStream !== undefined) {
            totalStream = resultado.totalStream;
          }

          if (resultado.registro) {
            registros.push(resultado.registro);
          }

          if (
            registros.length > 0 &&
            registros.length % 500 === 0
          ) {
            const { velocidade, tempoRestante } = calcularMetricas(
              registros.length,
              totalStream,
              inicioDownload
            );

            const porcentagem =
              totalStream > 0
                ? Math.min(100, (registros.length / totalStream) * 100)
                : 0;

            onProgresso({
              fase: "baixando",
              porcentagem,
              registrosProcessados: registros.length,
              totalRegistros: totalStream,
              velocidade,
              tempoRestante,
            });
          }
        }
      }

      if (done) {
        break;
      }
    }

    buffer += decoder.decode();

    const linhaFinal = buffer.trim();

    if (linhaFinal) {
      const resultado = processarLinhaNdjson(
        linhaFinal,
        primeiraLinha,
        totalEsperado
      );

      primeiraLinha = resultado.primeiraLinha;

      if (resultado.totalStream !== undefined) {
        totalStream = resultado.totalStream;
      }

      if (resultado.registro) {
        registros.push(resultado.registro);
      }
    }
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Falha ao baixar os dados.";

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: registros.length,
      totalRegistros: totalStream,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  // ── Validações obrigatórias do stream ─────────────────────────────────────

  if (primeiraLinha) {
    const mensagem =
      "O servidor encerrou a conexão sem enviar o cabeçalho do stream.";

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: registros.length,
      totalRegistros: totalEsperado,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  const totalRecebido = registros.length;

  if (totalRecebido !== totalStream) {
    const mensagem =
      `Sincronização incompleta. O servidor informou ` +
      `${formatarQuantidade(totalStream)} registros, mas foram recebidos ` +
      `apenas ${formatarQuantidade(totalRecebido)}.`;

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: totalRecebido,
      totalRegistros: totalStream,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  if (totalRecebido !== totalEsperado) {
    const mensagem =
      `Quantidade divergente. O endpoint /sync/status informou ` +
      `${formatarQuantidade(totalEsperado)} registros, mas o stream entregou ` +
      `${formatarQuantidade(totalRecebido)}.`;

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: totalRecebido,
      totalRegistros: totalEsperado,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  // ── Salvamento no IndexedDB ────────────────────────────────────────────────

  const CHUNK = 5_000;
  const inicioSalvamento = Date.now();

  onProgresso({
    fase: "salvando",
    porcentagem: 0,
    registrosProcessados: 0,
    totalRegistros: totalRecebido,
    velocidade: 0,
    tempoRestante: null,
  });

  try {
    await db.transaction("rw", db.registros, db.metadata, async () => {
      await db.registros.clear();

      for (let i = 0; i < registros.length; i += CHUNK) {
        const lote = registros.slice(i, i + CHUNK);

        await db.registros.bulkAdd(lote);

        const salvos = Math.min(i + lote.length, totalRecebido);
        const { velocidade, tempoRestante } = calcularMetricas(
          salvos,
          totalRecebido,
          inicioSalvamento
        );

        const porcentagem =
          totalRecebido > 0
            ? Math.min(100, (salvos / totalRecebido) * 100)
            : 0;

        onProgresso({
          fase: "salvando",
          porcentagem,
          registrosProcessados: salvos,
          totalRegistros: totalRecebido,
          velocidade,
          tempoRestante,
        });
      }

      const totalSalvo = await db.registros.count();

      if (totalSalvo !== totalRecebido) {
        throw new Error(
          `Falha ao salvar os dados. Foram recebidos ` +
            `${formatarQuantidade(totalRecebido)} registros, mas somente ` +
            `${formatarQuantidade(totalSalvo)} foram salvos no IndexedDB.`
        );
      }

      await db.metadata.put({
        id: 1,
        ultimaAtualizacao: statusRemoto.ultimaAtualizacao,
        totalRegistros: totalSalvo,
        arquivoModificadoEm: statusRemoto.arquivoModificadoEm,
        ultimaSincronizacao: new Date().toISOString(),
        versao: 1,
      });
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error
        ? erro.message
        : "Falha ao salvar os dados localmente.";

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: 0,
      totalRegistros: totalRecebido,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  const totalFinal = await db.registros.count();

  if (totalFinal !== totalRecebido) {
    const mensagem =
      `Validação final falhou. Esperado: ` +
      `${formatarQuantidade(totalRecebido)}; salvo: ` +
      `${formatarQuantidade(totalFinal)}.`;

    onProgresso({
      fase: "erro",
      porcentagem: 0,
      registrosProcessados: totalFinal,
      totalRegistros: totalRecebido,
      velocidade: 0,
      tempoRestante: null,
      erro: mensagem,
    });

    throw new Error(mensagem);
  }

  onProgresso({
    fase: "concluido",
    porcentagem: 100,
    registrosProcessados: totalFinal,
    totalRegistros: totalFinal,
    velocidade: 0,
    tempoRestante: 0,
  });

  return true;
}