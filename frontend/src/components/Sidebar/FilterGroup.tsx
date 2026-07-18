import { useState } from "react";

interface FilterGroupProps {
  titulo: React.ReactNode;
  opcoes: string[];
  selecionados: string[];
  onChange: (novos: string[]) => void;
}

export function FilterGroup({ titulo, opcoes, selecionados, onChange }: FilterGroupProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const opcoesFiltradas = busca
    ? opcoes.filter((o) => o.toLowerCase().includes(busca.toLowerCase()))
    : opcoes;

  function toggle(valor: string) {
    if (selecionados.includes(valor)) {
      onChange(selecionados.filter((v) => v !== valor));
    } else {
      onChange([...selecionados, valor]);
    }
  }

  return (
    <div className="border-b border-panel-border py-2">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-left text-sm font-medium text-slate-200"
      >
        <span className="flex items-center gap-2">
          {titulo}
          {selecionados.length > 0 && (
            <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              {selecionados.length}
            </span>
          )}
        </span>
        <span className="text-slate-500">{aberto ? "︿" : "﹀"}</span>
      </button>

      {aberto && (
        <div className="mt-1 animate-fade-in space-y-1 px-1">
          {opcoes.length > 8 && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="mb-1 w-full rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-slate-200 outline-none focus:border-accent"
            />
          )}
          <div className="max-h-40 overflow-y-auto pr-1">
            {opcoesFiltradas.length === 0 && (
              <p className="px-1 py-1 text-xs text-slate-500">Nenhuma opção</p>
            )}
            {opcoesFiltradas.map((opcao) => (
              <label
                key={opcao}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-300 hover:bg-panel-border"
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(opcao)}
                  onChange={() => toggle(opcao)}
                  className="h-3.5 w-3.5 rounded border-panel-border accent-accent"
                />
                <span className="truncate">{opcao}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
