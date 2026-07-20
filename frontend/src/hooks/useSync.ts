import { useCallback, useEffect, useState } from "react";
import {
  obterMetadata,
  sincronizarDados,
  verificarBaseLocal,
  verificarStatusRemoto,
  type ProgressoSync,
} from "../services/syncService";

export interface EstadoSync {
  /** true após verificar que há registros no IndexedDB. */
  temDadosLocais: boolean;
  /** ISO string da última sincronização bem-sucedida. */
  ultimaSincronizacao: string | null;
  /** Total de registros armazenados localmente. */
  totalRegistros: number;
  /** true durante o processo de sincronização. */
  sincronizando: boolean;
  /** Progresso em tempo real (apenas durante sincronizando = true). */
  progresso: ProgressoSync | null;
  /** Mensagem de erro da última tentativa, ou null. */
  erro: string | null;
  /**
   * null  = não verificado ainda
   * true  = dados locais estão atualizados em relação ao Drive
   * false = existe atualização disponível (ou erro ao verificar)
   */
  dadosAtualizados: boolean | null;
  /** true enquanto o estado inicial está sendo carregado do IndexedDB. */
  inicializando: boolean;
}

const ESTADO_INICIAL: EstadoSync = {
  temDadosLocais: false,
  ultimaSincronizacao: null,
  totalRegistros: 0,
  sincronizando: false,
  progresso: null,
  erro: null,
  dadosAtualizados: null,
  inicializando: true,
};

export function useSync() {
  const [estado, setEstado] = useState<EstadoSync>(ESTADO_INICIAL);

  // Verifica estado local ao montar
  useEffect(() => {
    let cancelado = false;

    async function verificarLocal() {
      const temDados = await verificarBaseLocal();
      if (cancelado) return;

      if (temDados) {
        const meta = await obterMetadata();
        setEstado((s) => ({
          ...s,
          temDadosLocais: true,
          ultimaSincronizacao: meta?.ultimaSincronizacao ?? null,
          totalRegistros: meta?.totalRegistros ?? 0,
          inicializando: false,
        }));
      } else {
        setEstado((s) => ({ ...s, temDadosLocais: false, inicializando: false }));
      }
    }

    verificarLocal();
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Verifica remotamente se existe uma atualização disponível.
   * Não baixa dados — apenas compara timestamps.
   */
  const verificarAtualizacao = useCallback(async () => {
    try {
      const meta = await obterMetadata();
      const remoto = await verificarStatusRemoto();

      const atualizado =
        !!meta?.arquivoModificadoEm &&
        !!remoto.arquivoModificadoEm &&
        meta.arquivoModificadoEm >= remoto.arquivoModificadoEm;

      setEstado((s) => ({ ...s, dadosAtualizados: atualizado }));
    } catch {
      setEstado((s) => ({ ...s, dadosAtualizados: false }));
    }
  }, []);

  /**
   * Inicia a sincronização completa:
   * verifica → baixa → salva → atualiza estado.
   */
  const iniciarSincronizacao = useCallback(async () => {
    setEstado((s) => ({
      ...s,
      sincronizando: true,
      erro: null,
      progresso: null,
      dadosAtualizados: null,
    }));

    try {
      const precisouSincronizar = await sincronizarDados((progresso) => {
        setEstado((s) => ({ ...s, progresso }));
      });

      const meta = await obterMetadata();

      setEstado((s) => ({
        ...s,
        sincronizando: false,
        progresso: null,
        temDadosLocais: true,
        ultimaSincronizacao: meta?.ultimaSincronizacao ?? null,
        totalRegistros: meta?.totalRegistros ?? 0,
        dadosAtualizados: true,
        // Se não houve download, informa que já estava atualizado
        erro: !precisouSincronizar
          ? "__ja_atualizado__"
          : null,
      }));
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Erro desconhecido ao sincronizar.";
      setEstado((s) => ({
        ...s,
        sincronizando: false,
        erro: msg,
        progresso: null,
      }));
    }
  }, []);

  return {
    ...estado,
    verificarAtualizacao,
    iniciarSincronizacao,
  };
}
