import Dexie, { type Table } from "dexie";

/** Um registro completo armazenado localmente. */
export interface RegistroLocal {
  /** ID numérico sequencial (definido pelo backend via reset_index). */
  id: number;
  lat: number;
  lon: number;
  matricula: string | null;
  referencia: string | null;
  cidade: string | null;
  micro: string | null;
  grupo: string | null;
  indicador: string | null;
  ocorrencia: string | null;
  colaborador: string | null;
  hora_leitura: string | null;
  data_leitura: string | null;
  /** Campos extras não mapeados (preservados tal qual). */
  [key: string]: unknown;
}

/** Metadados da última sincronização. Existe sempre exatamente 1 registro (id = 1). */
export interface MetadataLocal {
  id: 1;
  ultimaAtualizacao: string | null;
  totalRegistros: number;
  arquivoModificadoEm: string | null;
  ultimaSincronizacao: string | null;
  versao: number;
}

class AegeaMapaDB extends Dexie {
  registros!: Table<RegistroLocal, number>;
  metadata!: Table<MetadataLocal, number>;

  constructor() {
    super("AegeaMapaDB");
    this.version(1).stores({
      /**
       * Índices criados: referencia, cidade, micro, grupo, indicador,
       * ocorrencia, colaborador, matricula, data_leitura.
       * Esses índices permitem que as queries de filtro usem o B-tree
       * do IndexedDB em vez de fazer table scan.
       */
      registros:
        "id, referencia, cidade, micro, grupo, indicador, ocorrencia, colaborador, matricula, data_leitura",
      metadata: "id",
    });
  }
}

export const db = new AegeaMapaDB();
