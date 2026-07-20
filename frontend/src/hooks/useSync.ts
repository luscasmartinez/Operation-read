import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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

  /** Progresso em tempo real. */
  progresso: ProgressoSync | null;

  /** Mensagem de erro da última tentativa. */
  erro: string | null;

  /**
   * null  = não verificado
   * true  = dados locais atualizados
   * false = atualização disponível ou falha na verificação
   */
  dadosAtualizados: boolean | null;

  /** true enquanto o IndexedDB está sendo verificado. */
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

  /**
   * Evita múltiplas sincronizações simultâneas.
   * useRef é usado porque o estado React pode ainda não ter sido atualizado
   * quando dois cliques acontecem rapidamente.
   */
  const sincronizacaoEmAndamento = useRef(false);

  /**
   * Evita atualizações de estado após o componente ser desmontado.
   */
  const componenteMontado = useRef(true);

  useEffect(() => {
    componenteMontado.current = true;

    return () => {
      componenteMontado.current = false;
    };
  }, []);

  // Verifica o estado local ao montar.
  useEffect(() => {
    let cancelado = false;

    async function verificarLocal() {
      try {
        const temDados = await verificarBaseLocal();

        if (cancelado || !componenteMontado.current) {
          return;
        }

        if (temDados) {
          const meta = await obterMetadata();

          if (cancelado || !componenteMontado.current) {
            return;
          }

          setEstado((estadoAtual) => ({
            ...estadoAtual,
            temDadosLocais: true,
            ultimaSincronizacao:
              meta?.ultimaSincronizacao ?? null,
            totalRegistros:
              meta?.totalRegistros ?? 0,
            inicializando: false,
          }));

          return;
        }

        setEstado((estadoAtual) => ({
          ...estadoAtual,
          temDadosLocais: false,
          ultimaSincronizacao: null,
          totalRegistros: 0,
          inicializando: false,
        }));
      } catch (erro) {
        if (cancelado || !componenteMontado.current) {
          return;
        }

        const mensagem =
          erro instanceof Error
            ? erro.message
            : "Não foi possível acessar o banco local.";

        setEstado((estadoAtual) => ({
          ...estadoAtual,
          temDadosLocais: false,
          inicializando: false,
          erro: mensagem,
        }));
      }
    }

    void verificarLocal();

    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * Verifica se existe atualização no Google Drive.
   * Não inicia o download.
   */
  const verificarAtualizacao = useCallback(async () => {
    try {
      const [meta, remoto] = await Promise.all([
        obterMetadata(),
        verificarStatusRemoto(),
      ]);

      const atualizado =
        Boolean(meta?.arquivoModificadoEm) &&
        Boolean(remoto.arquivoModificadoEm) &&
        meta!.arquivoModificadoEm! >= remoto.arquivoModificadoEm!;

      if (!componenteMontado.current) {
        return;
      }

      setEstado((estadoAtual) => ({
        ...estadoAtual,
        dadosAtualizados: atualizado,
      }));
    } catch {
      if (!componenteMontado.current) {
        return;
      }

      setEstado((estadoAtual) => ({
        ...estadoAtual,
        dadosAtualizados: false,
      }));
    }
  }, []);

  /**
   * Inicia a sincronização completa.
   *
   * Proteções:
   * - ignora chamadas duplicadas;
   * - não permite duas conexões /sync simultâneas;
   * - mantém os dados anteriores se ocorrer erro;
   * - atualiza o estado somente se o componente continuar montado.
   */
  const iniciarSincronizacao = useCallback(async () => {
    if (sincronizacaoEmAndamento.current) {
      console.warn(
        "Uma sincronização já está em andamento. A nova solicitação foi ignorada."
      );
      return;
    }

    sincronizacaoEmAndamento.current = true;

    if (componenteMontado.current) {
      setEstado((estadoAtual) => ({
        ...estadoAtual,
        sincronizando: true,
        erro: null,
        progresso: null,
        dadosAtualizados: null,
      }));
    }

    try {
      const precisouSincronizar = await sincronizarDados(
        (progresso) => {
          if (!componenteMontado.current) {
            return;
          }

          setEstado((estadoAtual) => ({
            ...estadoAtual,
            progresso,
          }));
        }
      );

      const meta = await obterMetadata();
      const totalReal = await verificarBaseLocal();

      if (!componenteMontado.current) {
        return;
      }

      setEstado((estadoAtual) => ({
        ...estadoAtual,
        sincronizando: false,
        progresso: null,
        temDadosLocais: totalReal,
        ultimaSincronizacao:
          meta?.ultimaSincronizacao ?? null,
        totalRegistros:
          meta?.totalRegistros ?? 0,
        dadosAtualizados: true,
        erro: precisouSincronizar
          ? null
          : "__ja_atualizado__",
      }));
    } catch (erro) {
      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Erro desconhecido ao sincronizar.";

      if (!componenteMontado.current) {
        return;
      }

      /*
       * Não altera temDadosLocais nem totalRegistros aqui.
       * Assim, caso uma atualização falhe, o banco anterior continua sendo
       * considerado válido.
       */
      setEstado((estadoAtual) => ({
        ...estadoAtual,
        sincronizando: false,
        erro: mensagem,
        progresso: null,
        dadosAtualizados: false,
      }));
    } finally {
      sincronizacaoEmAndamento.current = false;
    }
  }, []);

  return {
    ...estado,
    verificarAtualizacao,
    iniciarSincronizacao,
  };
}