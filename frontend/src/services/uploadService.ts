const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8080"
).replace(/\/+$/, "");

export interface UploadExcelResponse {
  arquivoNoDriveId: string;
  arquivoNoDriveNome: string;
  arquivoNoDriveModificadoEm: string;
  totalRegistrosArquivo: number;
  totalRegistrosAtual: number;
  ultimaAtualizacao: string | null;
}

function construirErroHttp(status: number, detalhe: string): Error {
  const msg = detalhe.trim().slice(0, 300);
  return new Error(msg || `Falha no upload (${status}).`);
}

export function substituirExcelNoDrive(
  file: File,
  onProgress: (percentual: number) => void
): Promise<UploadExcelResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.open("POST", `${BASE_URL}/sync/upload`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const percentual = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(percentual);
    };

    xhr.onerror = () => {
      reject(new Error("Erro de rede durante o upload do arquivo."));
    };

    xhr.onload = () => {
      const respostaJson = xhr.response as Partial<UploadExcelResponse> | null;

      if (xhr.status < 200 || xhr.status >= 300) {
        const detalhe =
          (respostaJson as { detail?: string } | null)?.detail ?? xhr.responseText ?? "";
        reject(construirErroHttp(xhr.status, detalhe));
        return;
      }

      if (!respostaJson) {
        reject(new Error("O servidor retornou uma resposta vazia."));
        return;
      }

      resolve(respostaJson as UploadExcelResponse);
    };

    xhr.send(formData);
  });
}