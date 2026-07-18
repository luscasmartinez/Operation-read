import { useFiltrosStore } from "../../store/filtrosStore";

export function SmartSearch() {
  const { filtros, setFiltro } = useFiltrosStore();

  return (
    <div className="pointer-events-auto w-80 max-w-[70vw]">
      <div className="flex items-center gap-2 rounded-lg border border-panel-border bg-panel-light/95 px-3 py-2 shadow-panel backdrop-blur">
        <span className="text-slate-500">🔎</span>
        <input
          value={filtros.busca}
          onChange={(e) => setFiltro("busca", e.target.value)}
          placeholder="Buscar por matrícula, colaborador, ocorrência..."
          className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
        />
        {filtros.busca && (
          <button
            onClick={() => setFiltro("busca", "")}
            className="text-slate-500 hover:text-slate-300"
            title="Limpar busca"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
