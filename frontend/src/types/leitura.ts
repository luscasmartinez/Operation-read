export interface LeituraMapa {
  id: number;
  lat: number;
  lon: number;
  cidade: string | null;
  micro: string | null;
  grupo: string | null;
  colaborador: string | null;
  ocorrencia: string | null;
  indicador: string | null;
  referencia: string | null;
  matricula: string | null;
  data_leitura: string | null;
}

export interface LeituraDetalhe {
  id: number;
  campos: Record<string, unknown>;
}

export interface Estatisticas {
  total_leituras: number;
  total_colaboradores: number;
  total_ocorrencias: number;
  total_cidades: number;
  total_micros: number;
  total_matriculas: number;
}

export interface FiltrosDisponiveis {
  cidade: string[];
  micro: string[];
  grupo: string[];
  colaborador: string[];
  ocorrencia: string[];
  indicador: string[];
  referencia: string[];
}

export type AtributoCor = "indicador" | "ocorrencia";

export interface FiltrosAtivos {
  cidade: string[];
  micro: string[];
  grupo: string[];
  colaborador: string[];
  ocorrencia: string[];
  indicador: string[];
  referencia: string[];
  matricula: string;
  busca: string;
  dataInicial: string | null;
  dataFinal: string | null;
}

export const filtrosVazios: FiltrosAtivos = {
  cidade: [],
  micro: [],
  grupo: [],
  colaborador: [],
  ocorrencia: [],
  referencia: [],
  indicador: [],
  matricula: "",
  busca: "",
  dataInicial: null,
  dataFinal: null,
};

export interface ContagemResponse {
  total: number;
  necessita_confirmacao: boolean;
}
