import { useCallback, useMemo, useState } from "react";
import { LegendPanel } from "./components/Legend/LegendPanel";
import { MapView } from "./components/Map/MapView";
import { SmartSearch } from "./components/SearchBar/SmartSearch";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { StatsCards } from "./components/StatsCards/StatsCards";
import { SyncPanel } from "./components/Sync/SyncPanel";
import { useContagem, useMapa, filtrosObrigatoriosValidos } from "./hooks/useLeituras";
import { useLeiturasFiltradas } from "./hooks/useLeiturasFiltradas";
import { useSync } from "./hooks/useSync";
import { useFiltrosStore } from "./store/filtrosStore";

export default function App() {
  // ── Sync ─────────────────────────────────────────────────────────────────
  const sync = useSync();

  // Enquanto verifica o banco local, exibe tela vazia para evitar flash
  if (sync.inicializando) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-panel">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Sem dados locais: exibe painel de sincronização (primeira vez ou banco apagado)
  // Se tiver dados, permanece no app mesmo que haja erro ou sync em andamento.
  if (!sync.temDadosLocais) {
    return <SyncPanel estado={sync} onSincronizar={sync.iniciarSincronizacao} />;
  }

  return <AppComDados sync={sync} />;
}

/** Componente interno renderizado apenas quando há dados locais disponíveis. */
function AppComDados({ sync }: { sync: ReturnType<typeof useSync> }) {
  const { filtros, atributoCor, mapaAtivo, filtrosCarregados, carregarMapa } = useFiltrosStore();
  const [confirmAberto, setConfirmAberto] = useState(false);

  const filtrosValidos = filtrosObrigatoriosValidos(filtros);

  // Conta registros sempre que filtros obrigatórios estiverem preenchidos
  const { data: contagem, isFetching: contando } = useContagem(filtros);

  // Carrega marcadores somente após o usuário clicar "Carregar Mapa"
  const { data: dadosMapa = [], isLoading: carregandoMapa } = useMapa(
    filtrosCarregados,
    mapaAtivo
  );

  // Filtro de busca textual client-side sobre os dados já carregados
  const dadosFiltrados = useLeiturasFiltradas(dadosMapa, filtros);

  const handleCarregarMapa = useCallback(() => {
    if (!filtrosValidos || !contagem) return;
    if (contagem.necessita_confirmacao) {
      setConfirmAberto(true);
    } else {
      carregarMapa();
    }
  }, [filtrosValidos, contagem, carregarMapa]);

  const handleConfirmar = useCallback(() => {
    setConfirmAberto(false);
    carregarMapa();
  }, [carregarMapa]);

  const buscaAtiva = filtros.busca.trim().length > 0;
  const handleSelecionarLeitura = useCallback((_id: number) => {}, []);

  const rodape = useMemo(
    () =>
      dadosMapa.length > 0
        ? `${dadosFiltrados.length.toLocaleString("pt-BR")} de ${dadosMapa.length.toLocaleString("pt-BR")} registros`
        : "Nenhum dado carregado",
    [dadosFiltrados.length, dadosMapa.length]
  );

  return (
    <div className="flex h-screen w-screen bg-panel">
      <Sidebar
        dadosFiltrados={dadosFiltrados}
        contagem={contagem ?? null}
        contando={contando}
        filtrosValidos={filtrosValidos}
        onCarregarMapa={handleCarregarMapa}
        mapaAtivo={mapaAtivo}
        sync={sync}
      />

      <main className="relative flex-1">
        {/* Overlay de carregamento */}
        {carregandoMapa && (
          <div className="absolute inset-0 z-[1500] flex items-center justify-center bg-panel/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              <span className="text-sm">Carregando dados filtrados…</span>
            </div>
          </div>
        )}

        {/* Estado inicial — mapa vazio */}
        {!mapaAtivo && !carregandoMapa && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="text-5xl opacity-30">🗺️</span>
              <p className="max-w-xs text-sm text-slate-500">
                {filtrosValidos
                  ? 'Clique em "Carregar Mapa" para visualizar os dados.'
                  : "Selecione pelo menos uma Referência e uma Cidade ou Micro para visualizar o mapa."}
              </p>
            </div>
          </div>
        )}

        <MapView
          dados={dadosFiltrados}
          atributoCor={atributoCor}
          buscaAtiva={buscaAtiva}
          onSelecionarLeitura={handleSelecionarLeitura}
        />

        {mapaAtivo && dadosMapa.length > 0 && <StatsCards dados={dadosFiltrados} />}

        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-2">
          {mapaAtivo && <SmartSearch />}
          <span className="pointer-events-none text-[11px] text-slate-500">{rodape}</span>
        </div>

        {mapaAtivo && dadosMapa.length > 0 && <LegendPanel dados={dadosFiltrados} />}

        {/* Diálogo de confirmação para volumes grandes */}
        {confirmAberto && contagem && (
          <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60">
            <div className="w-80 rounded-xl border border-panel-border bg-panel-light p-5 shadow-panel">
              <h3 className="mb-2 text-sm font-semibold text-slate-100">
                Volume elevado de dados
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-slate-300">
                Foram encontrados{" "}
                <strong className="text-accent">
                  {contagem.total.toLocaleString("pt-BR")}
                </strong>{" "}
                registros. Carregar um volume muito grande pode deixar o mapa lento.
                Deseja continuar?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmAberto(false)}
                  className="flex-1 rounded-md border border-panel-border py-2 text-xs text-slate-300 hover:bg-panel-border"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmar}
                  className="flex-1 rounded-md bg-accent py-2 text-xs font-medium text-panel"
                >
                  Carregar mesmo assim
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
