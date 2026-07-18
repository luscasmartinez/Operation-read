import { useMemo, useState } from "react";
import { useFiltrosStore } from "../../store/filtrosStore";
import type { AtributoCor, LeituraMapa } from "../../types/leitura";
import { corParaCategoria } from "../../utils/colorHash";

interface LegendPanelProps {
  dados: LeituraMapa[];
}

export function LegendPanel({ dados }: LegendPanelProps) {
  const { atributoCor, setAtributoCor } = useFiltrosStore();
  const [aberta, setAberta] = useState(true);

  const categorias = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const item of dados) {
      const valor = item[atributoCor] ?? "Não informado";
      contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
    }
    return Array.from(contagem.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
  }, [dados, atributoCor]);

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-[1000] w-56 overflow-hidden rounded-lg border border-panel-border bg-panel-light/95 shadow-panel backdrop-blur">
      <button
        onClick={() => setAberta((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-slate-200"
      >
        Legenda
        <span className="text-slate-500">{aberta ? "︿" : "﹀"}</span>
      </button>

      {aberta && (
        <div className="animate-fade-in space-y-2 border-t border-panel-border px-3 py-2">
          <div className="flex gap-1">
            {(["indicador", "ocorrencia"] as AtributoCor[]).map((attr) => (
              <button
                key={attr}
                onClick={() => setAtributoCor(attr)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize ${
                  atributoCor === attr
                    ? "bg-accent text-panel"
                    : "bg-panel text-slate-400 hover:bg-panel-border"
                }`}
              >
                {attr}
              </button>
            ))}
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {categorias.map(([nome, qtd]) => (
              <div key={nome} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: corParaCategoria(nome) }}
                />
                <span className="flex-1 truncate text-slate-300">{nome}</span>
                <span className="text-slate-500">{qtd.toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {categorias.length === 0 && (
              <p className="text-xs text-slate-500">Sem dados para o filtro atual</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
