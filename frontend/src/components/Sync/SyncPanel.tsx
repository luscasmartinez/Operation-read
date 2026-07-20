import type { EstadoSync } from "../../hooks/useSync";

interface SyncPanelProps {
  estado: EstadoSync;
  onSincronizar: () => void;
}

function formatarTempo(segundos: number): string {
  if (segundos >= 60) return `~${Math.round(segundos / 60)}min restantes`;
  return `~${segundos}s restantes`;
}

export function SyncPanel({ estado, onSincronizar }: SyncPanelProps) {
  const { sincronizando, progresso, erro } = estado;
  const jaAtualizado = erro === "__ja_atualizado__";

  const fase = progresso?.fase;
  const pct = Math.round(progresso?.porcentagem ?? 0);
  const processados = progresso?.registrosProcessados ?? 0;
  const total = progresso?.totalRegistros ?? 0;
  const velocidade = progresso?.velocidade ?? 0;
  const tempoRestante = progresso?.tempoRestante ?? null;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-panel">
      <div className="w-full max-w-md rounded-2xl border border-panel-border bg-panel-light p-8 shadow-panel">
        {/* Logo / Título */}
        <div className="mb-6 text-center">
          <span className="text-4xl">🗺️</span>
          <h1 className="mt-2 text-lg font-bold tracking-wide text-slate-100">
            Aegea — Mapa Operacional
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Acesso offline · Google Drive → IndexedDB
          </p>
        </div>

        {/* Estado: aguardando sync */}
        {!sincronizando && !jaAtualizado && !erro && (
          <>
            <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
              Nenhum dado encontrado.
              <br />
              Clique para baixar os dados do Google Drive.
            </div>
            <button
              onClick={onSincronizar}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-panel transition-opacity hover:bg-accent/80"
            >
              Consultar dados do Google Drive
            </button>
          </>
        )}

        {/* Estado: já atualizado */}
        {jaAtualizado && (
          <>
            <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-sm text-green-300">
              ✓ Os dados já estão atualizados.
            </div>
            <button
              onClick={onSincronizar}
              className="w-full rounded-xl border border-panel-border py-2 text-xs text-slate-400 hover:bg-panel-border"
            >
              Forçar nova sincronização
            </button>
          </>
        )}

        {/* Estado: sincronizando */}
        {sincronizando && (
          <div className="space-y-3">
            <p className="text-center text-sm font-medium text-slate-300">
              Sincronizando dados...
            </p>

            {/* Barra de progresso */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-panel-border">
              <div
                className="h-full rounded-full bg-accent transition-all duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Percentual + contagem */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-accent">{pct}%</span>
              {total > 0 && (
                <span>
                  {processados.toLocaleString("pt-BR")} de{" "}
                  {total.toLocaleString("pt-BR")} registros
                </span>
              )}
            </div>

            {/* Velocidade + tempo restante */}
            {(velocidade > 0 || tempoRestante != null) && (
              <div className="flex justify-between text-[11px] text-slate-500">
                {velocidade > 0 && (
                  <span>{velocidade.toLocaleString("pt-BR")} reg/s</span>
                )}
                {tempoRestante != null && tempoRestante > 0 && (
                  <span>{formatarTempo(tempoRestante)}</span>
                )}
              </div>
            )}

            {/* Fase atual */}
            <p className="text-center text-[11px] text-slate-500">
              {fase === "verificando" && "Verificando servidor..."}
              {fase === "baixando" && "Baixando dados do servidor..."}
              {fase === "salvando" && "Salvando no banco local..."}
              {fase === "concluido" && "Concluído!"}
            </p>
          </div>
        )}

        {/* Estado: erro */}
        {erro && !jaAtualizado && (
          <>
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {erro}
            </div>
            <button
              onClick={onSincronizar}
              className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-panel transition-opacity hover:bg-accent/80"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    </div>
  );
}
