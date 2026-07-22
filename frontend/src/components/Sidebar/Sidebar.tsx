import { useFiltrosDisponiveis } from "../../hooks/useFiltrosDisponiveis";
import { useFiltrosStore } from "../../store/filtrosStore";
import type { ContagemResponse, LeituraMapa } from "../../types/leitura";
import { exportarParaCsv } from "../../utils/exportCsv";
import { UploadReplacePanel } from "../Sync/UploadReplacePanel";
import { FilterGroup } from "./FilterGroup";
import type { EstadoSync } from "../../hooks/useSync";

interface SidebarProps {
  dadosFiltrados: LeituraMapa[];
  contagem: ContagemResponse | null;
  contando: boolean;
  filtrosValidos: boolean;
  onCarregarMapa: () => void;
  mapaAtivo: boolean;
  sync: EstadoSync & { iniciarSincronizacao: () => Promise<void> | void };
}

export function Sidebar({
  dadosFiltrados,
  contagem,
  contando,
  filtrosValidos,
  onCarregarMapa,
  mapaAtivo,
  sync,
}: SidebarProps) {
  const disponiveis = useFiltrosDisponiveis(useFiltrosStore((s) => s.filtros));
  const { filtros, setFiltro, limparFiltros, sidebarAberta, toggleSidebar } = useFiltrosStore();

  const faltaReferencia = filtros.referencia.length === 0;
  const faltaCidadeMicro = filtros.cidade.length === 0 && filtros.micro.length === 0;

  const totalFiltrosAtivos =
    filtros.cidade.length + filtros.micro.length + filtros.grupo.length +
    filtros.colaborador.length + filtros.ocorrencia.length + filtros.indicador.length +
    filtros.referencia.length + (filtros.matricula ? 1 : 0) +
    (filtros.dataInicial ? 1 : 0) + (filtros.dataFinal ? 1 : 0);

  // Texto do botão de contagem
  const textoContagem = (() => {
    if (!filtrosValidos) return null;
    if (contando) return "Verificando...";
    if (contagem) return `${contagem.total.toLocaleString("pt-BR")} registros encontrados`;
    return null;
  })();

  if (!sidebarAberta) {
    return (
      <button
        onClick={toggleSidebar}
        className="absolute left-3 top-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-panel-border bg-panel-light text-slate-300 shadow-panel hover:bg-panel-border"
        title="Abrir filtros"
      >
        ☰
      </button>
    );
  }

  const inputBorder = "border border-panel-border bg-panel-light px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-accent";

  return (
    <aside className="animate-slide-in flex h-full w-80 flex-col border-r border-panel-border bg-panel shadow-panel">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">
          Filtros
          {totalFiltrosAtivos > 0 && (
            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-[11px] text-accent">
              {totalFiltrosAtivos}
            </span>
          )}
        </h2>
        <button onClick={toggleSidebar} className="text-slate-400 hover:text-slate-200" title="Recolher">
          ⟨⟨
        </button>
      </div>

      {/* Mensagem de orientação quando filtros obrigatórios faltam */}
      {!filtrosValidos && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300">
          Selecione pelo menos uma <strong>Referência</strong> e uma <strong>Cidade ou Micro</strong> para visualizar o mapa.
        </div>
      )}

      {/* Filtros */}
      <div className="flex-1 overflow-y-auto px-3 py-2">

        {/* Referência — OBRIGATÓRIO */}
        <div className={`rounded-md ${faltaReferencia ? "ring-1 ring-red-500/60" : ""}`}>
          <FilterGroup
            titulo={<span className="flex items-center gap-1">Referência {faltaReferencia && <span className="text-[10px] text-red-400">*obrigatório</span>}</span>}
            opcoes={disponiveis.referencia}
            selecionados={filtros.referencia}
            onChange={(v) => setFiltro("referencia", v)}
          />
        </div>

        {/* Cidade — OBRIGATÓRIO (ou Micro) */}
        <div className={`rounded-md ${faltaCidadeMicro ? "ring-1 ring-red-500/40" : ""}`}>
          <FilterGroup
            titulo={<span className="flex items-center gap-1">Cidade {faltaCidadeMicro && <span className="text-[10px] text-red-400">*</span>}</span>}
            opcoes={disponiveis.cidade}
            selecionados={filtros.cidade}
            onChange={(v) => setFiltro("cidade", v)}
          />
        </div>

        {/* Micro — OBRIGATÓRIO (ou Cidade) */}
        <div className={`rounded-md ${faltaCidadeMicro ? "ring-1 ring-red-500/40" : ""}`}>
          <FilterGroup
            titulo={<span className="flex items-center gap-1">Micro {faltaCidadeMicro && <span className="text-[10px] text-red-400">*</span>}</span>}
            opcoes={disponiveis.micro}
            selecionados={filtros.micro}
            onChange={(v) => setFiltro("micro", v)}
          />
        </div>

        <FilterGroup titulo="Grupo" opcoes={disponiveis.grupo} selecionados={filtros.grupo} onChange={(v) => setFiltro("grupo", v)} />
        <FilterGroup titulo="Colaborador" opcoes={disponiveis.colaborador} selecionados={filtros.colaborador} onChange={(v) => setFiltro("colaborador", v)} />
        <FilterGroup titulo="Ocorrência" opcoes={disponiveis.ocorrencia} selecionados={filtros.ocorrencia} onChange={(v) => setFiltro("ocorrencia", v)} />
        <FilterGroup titulo="Indicador" opcoes={disponiveis.indicador} selecionados={filtros.indicador} onChange={(v) => setFiltro("indicador", v)} />

        <div className="space-y-2 border-b border-panel-border pb-3">
          <label className="text-xs font-medium text-slate-400">Matrícula</label>
          <input
            value={filtros.matricula}
            onChange={(e) => setFiltro("matricula", e.target.value)}
            placeholder="Ex: 1753085"
            className={`w-full rounded-md ${inputBorder}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-panel-border py-3">
          <div>
            <label className="text-xs font-medium text-slate-400">Data inicial</label>
            <input type="date" value={filtros.dataInicial ?? ""} onChange={(e) => setFiltro("dataInicial", e.target.value || null)} className={`mt-1 w-full rounded-md ${inputBorder} text-xs`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-400">Data final</label>
            <input type="date" value={filtros.dataFinal ?? ""} onChange={(e) => setFiltro("dataFinal", e.target.value || null)} className={`mt-1 w-full rounded-md ${inputBorder} text-xs`} />
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div className="flex flex-col gap-2 border-t border-panel-border p-3">

        {/* Banner de última sincronização */}
        {sync.ultimaSincronizacao && !sync.sincronizando && !sync.erro && sync.erro !== "__ja_atualizado__" && (
          <div className="flex items-center justify-between rounded-md border border-panel-border bg-panel px-2 py-1.5">
            <div className="text-[10px] text-slate-500 leading-tight">
              <p className="font-medium text-slate-400">Última atualização</p>
              <p>
                {new Date(sync.ultimaSincronizacao).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </p>
              <p>{sync.totalRegistros.toLocaleString("pt-BR")} registros</p>
            </div>
            <button
              onClick={sync.iniciarSincronizacao}
              title="Sincronizar com Google Drive"
              className="ml-2 flex-shrink-0 rounded-md border border-panel-border px-2 py-1 text-[10px] text-slate-400 hover:bg-panel-border hover:text-slate-200"
            >
              ↻
            </button>
          </div>
        )}

        {/* Progresso inline de sync (quando já há dados) */}
        {sync.sincronizando && sync.progresso && (
          <div className="rounded-md border border-panel-border bg-panel p-2 space-y-1.5">
            <p className="text-[10px] font-medium text-slate-400">
              Sincronizando... {Math.round(sync.progresso.porcentagem)}%
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200"
                style={{ width: `${Math.round(sync.progresso.porcentagem)}%` }}
              />
            </div>
            {sync.progresso.totalRegistros > 0 && (
              <p className="text-[10px] text-slate-500">
                {sync.progresso.registrosProcessados.toLocaleString("pt-BR")} /{" "}
                {sync.progresso.totalRegistros.toLocaleString("pt-BR")} reg
              </p>
            )}
          </div>
        )}

        {/* "Já atualizado" */}
        {sync.erro === "__ja_atualizado__" && sync.ultimaSincronizacao && (
          <div className="flex items-center justify-between rounded-md border border-panel-border bg-panel px-2 py-1.5">
            <div className="text-[10px] text-slate-500 leading-tight">
              <p className="font-medium text-green-400">✓ Dados atualizados</p>
              <p>
                {new Date(sync.ultimaSincronizacao).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </p>
              <p>{sync.totalRegistros.toLocaleString("pt-BR")} registros</p>
            </div>
            <button
              onClick={sync.iniciarSincronizacao}
              title="Sincronizar novamente"
              className="ml-2 flex-shrink-0 rounded-md border border-panel-border px-2 py-1 text-[10px] text-slate-400 hover:bg-panel-border hover:text-slate-200"
            >
              ↻
            </button>
          </div>
        )}

        {/* Erro de sync (sem perder o app) */}
        {sync.erro && sync.erro !== "__ja_atualizado__" && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[10px] text-red-300">
            <p className="font-medium">Falha na sincronização</p>
            <p className="mt-0.5">{sync.erro}</p>
            <button
              onClick={sync.iniciarSincronizacao}
              className="mt-1 rounded border border-red-500/40 px-2 py-0.5 text-[10px] hover:bg-red-500/20"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <UploadReplacePanel
          disabled={sync.sincronizando}
          onUploadConcluido={async () => {
            await sync.iniciarSincronizacao();
          }}
        />

        {/* Contagem */}
        {textoContagem && (
          <div className={`text-center text-[11px] font-medium ${contando ? "text-slate-500" : "text-accent"}`}>
            {contagem?.necessita_confirmacao && !contando && (
              <span className="mr-1 text-amber-400">⚠</span>
            )}
            {textoContagem}
          </div>
        )}

        {/* Botão Carregar Mapa */}
        <button
          onClick={onCarregarMapa}
          disabled={!filtrosValidos || contando || !contagem}
          className="w-full rounded-md bg-accent py-2 text-sm font-semibold text-panel transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-accent/80"
        >
          {mapaAtivo ? "Atualizar Mapa" : "Carregar Mapa"}
        </button>

        <div className="flex gap-2">
          <button onClick={limparFiltros} className="flex-1 rounded-md border border-panel-border py-1.5 text-xs font-medium text-slate-300 hover:bg-panel-border">
            Limpar filtros
          </button>
          {mapaAtivo && dadosFiltrados.length > 0 && (
            <button onClick={() => exportarParaCsv(dadosFiltrados)} className="flex-1 rounded-md bg-accent/20 py-1.5 text-xs font-medium text-accent hover:bg-accent/30">
              Exportar CSV
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
