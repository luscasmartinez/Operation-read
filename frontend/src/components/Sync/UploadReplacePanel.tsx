import { useState } from "react";

import {
  substituirExcelNoDrive,
  type UploadExcelResponse,
} from "../../services/uploadService";

interface UploadReplacePanelProps {
  disabled?: boolean;
  onUploadConcluido?: (resposta: UploadExcelResponse) => Promise<void> | void;
}

export function UploadReplacePanel({
  disabled = false,
  onUploadConcluido,
}: UploadReplacePanelProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const bloqueado = disabled || enviando;
  const percentual = Math.max(0, Math.min(100, progresso));

  async function handleUpload() {
    if (!arquivo) {
      setErro("Selecione um arquivo .xlsx ou .xls antes de enviar.");
      return;
    }

    setErro(null);
    setSucesso(null);
    setEnviando(true);
    setProgresso(0);

    try {
      const resposta = await substituirExcelNoDrive(arquivo, (pct) => {
        setProgresso(pct);
      });

      setProgresso(100);
      setSucesso(
        `Upload concluído: ${resposta.totalRegistrosArquivo.toLocaleString("pt-BR")} registros válidos.`
      );

      if (onUploadConcluido) {
        await onUploadConcluido(resposta);
      }
    } catch (uploadError) {
      const mensagem =
        uploadError instanceof Error
          ? uploadError.message
          : "Falha ao enviar arquivo.";
      setErro(mensagem);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-md border border-panel-border bg-panel p-2.5">
      <h3 className="text-[11px] font-semibold text-slate-300">Substituir Excel no Drive</h3>

      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
        Envie um novo Excel para substituir o arquivo atual no Google Drive.
      </p>

      <div className="mt-2 space-y-2">
        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={bloqueado}
          onChange={(event) => {
            const selecionado = event.target.files?.[0] ?? null;
            setArquivo(selecionado);
            setErro(null);
            setSucesso(null);
            setProgresso(0);
          }}
          className="block w-full cursor-pointer rounded border border-panel-border bg-panel-light px-2 py-1.5 text-[10px] text-slate-300 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-accent/20 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-accent"
        />

        {arquivo && (
          <p className="text-[10px] text-slate-400">
            {arquivo.name} • {(arquivo.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        )}

        {(enviando || percentual > 0) && (
          <div className="space-y-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border">
              <div
                className="h-full rounded-full bg-accent transition-all duration-150"
                style={{ width: `${percentual}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>
                {enviando && percentual < 100 ? "Enviando arquivo..." : "Processando arquivo..."}
              </span>
              <span className="font-medium text-slate-400">{percentual}%</span>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            void handleUpload();
          }}
          disabled={bloqueado || !arquivo}
          className="w-full rounded-md bg-accent py-1.5 text-xs font-semibold text-panel transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:bg-accent/80"
        >
          {enviando ? "Enviando..." : "Substituir arquivo no Drive"}
        </button>

        {sucesso && (
          <p className="rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-[10px] text-green-300">
            {sucesso}
          </p>
        )}

        {erro && (
          <p className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
            {erro}
          </p>
        )}
      </div>
    </section>
  );
}