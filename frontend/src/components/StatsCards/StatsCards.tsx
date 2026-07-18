import { useMemo } from "react";
import type { LeituraMapa } from "../../types/leitura";

interface StatsCardsProps {
  dados: LeituraMapa[];
}

function contarUnicos(dados: LeituraMapa[], chave: keyof LeituraMapa): number {
  const set = new Set<string>();
  for (const item of dados) {
    const valor = item[chave];
    if (valor) set.add(String(valor));
  }
  return set.size;
}

const CARDS: { chave: keyof LeituraMapa | "total"; label: string; icone: string }[] = [
  { chave: "total", label: "Total de Leituras", icone: "📋" },
  { chave: "colaborador", label: "Colaboradores", icone: "👷" },
  { chave: "ocorrencia", label: "Ocorrências", icone: "⚠️" },
  { chave: "cidade", label: "Cidades", icone: "🏙️" },
  { chave: "micro", label: "Micros", icone: "🗺️" },
  { chave: "matricula", label: "Matrículas", icone: "🔢" },
];

export function StatsCards({ dados }: StatsCardsProps) {
  const valores = useMemo(() => {
    return CARDS.map((card) => ({
      ...card,
      valor: card.chave === "total" ? dados.length : contarUnicos(dados, card.chave),
    }));
  }, [dados]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 gap-2 px-2">
      {valores.map((card) => (
        <div
          key={card.label}
          className="pointer-events-auto flex min-w-[104px] flex-col items-center rounded-lg border border-panel-border bg-panel-light/95 px-3 py-2 text-center shadow-panel backdrop-blur"
        >
          <span className="text-[10px] uppercase tracking-wide text-slate-400">{card.label}</span>
          <span className="text-lg font-semibold text-slate-50">
            {card.valor.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}
