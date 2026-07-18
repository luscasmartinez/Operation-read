import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { LeituraMapa } from "../../types/leitura";

const LABELS: Record<string, string> = {
  matricula: "Matrícula",
  colaborador: "Colaborador",
  ocorrencia: "Ocorrência",
  indicador: "Indicador",
  grupo: "Grupo",
  cidade: "Cidade",
  micro: "Micro",
  referencia: "Referência",
  hora_leitura: "Hora da leitura",
  data_leitura: "Data",
};

function formatarLabel(chave: string): string {
  return (
    LABELS[chave] ??
    chave
      .replace(/_/g, " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export function MarkerPopup({ resumo }: { resumo: LeituraMapa }) {
  const [campos, setCampos] = useState<Record<string, unknown> | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    api
      .leituraDetalhe(resumo.id)
      .then((res) => {
        if (!cancelado) setCampos(res.campos);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [resumo.id]);

  const entradas = campos
    ? Object.entries(campos).filter(([k]) => k !== "latitude" && k !== "longitude" && k !== "_arquivo_origem")
    : [];

  return (
    <div className="min-w-[240px] text-sm">
      <div className="mb-2 border-b border-panel-border pb-2">
        <p className="font-semibold text-accent">{resumo.ocorrencia ?? "Leitura"}</p>
        <p className="text-xs text-slate-400">{resumo.colaborador}</p>
      </div>

      {carregando ? (
        <p className="text-xs text-slate-400">Carregando detalhes…</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {entradas.map(([chave, valor]) => (
            <div key={chave} className="contents">
              <dt className="text-xs font-medium text-slate-400">{formatarLabel(chave)}</dt>
              <dd className="text-xs text-slate-100">{valor === null ? "—" : String(valor)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
