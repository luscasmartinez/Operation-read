import type { LeituraMapa } from "../types/leitura";

export function exportarParaCsv(dados: LeituraMapa[], nomeArquivo = "leituras_filtradas.csv") {
  if (dados.length === 0) return;

  const colunas = Object.keys(dados[0]) as (keyof LeituraMapa)[];
  const linhas = [
    colunas.join(";"),
    ...dados.map((item) =>
      colunas
        .map((col) => {
          const valor = item[col];
          return valor === null || valor === undefined ? "" : String(valor).replace(/;/g, ",");
        })
        .join(";")
    ),
  ];

  const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
