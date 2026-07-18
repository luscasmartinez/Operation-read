import { create } from "zustand";
import type { AtributoCor, FiltrosAtivos } from "../types/leitura";
import { filtrosVazios } from "../types/leitura";

interface FiltrosState {
  filtros: FiltrosAtivos;
  atributoCor: AtributoCor;
  sidebarAberta: boolean;
  /** true quando o usuário clicou "Carregar Mapa" para os filtros atuais */
  mapaAtivo: boolean;
  /** snapshot dos filtros com que o mapa foi carregado */
  filtrosCarregados: FiltrosAtivos | null;

  setFiltro: <K extends keyof FiltrosAtivos>(chave: K, valor: FiltrosAtivos[K]) => void;
  limparFiltros: () => void;
  setAtributoCor: (attr: AtributoCor) => void;
  toggleSidebar: () => void;
  /** Confirma o carregamento, gravando o snapshot dos filtros atuais */
  carregarMapa: () => void;
  resetMapa: () => void;
}

export const useFiltrosStore = create<FiltrosState>((set, get) => ({
  filtros: filtrosVazios,
  atributoCor: "indicador",
  sidebarAberta: true,
  mapaAtivo: false,
  filtrosCarregados: null,

  setFiltro: (chave, valor) =>
    set((state) => ({
      filtros: { ...state.filtros, [chave]: valor },
      // Qualquer mudança de filtro invalida o mapa atual
      mapaAtivo: false,
    })),

  limparFiltros: () =>
    set({ filtros: filtrosVazios, mapaAtivo: false, filtrosCarregados: null }),

  setAtributoCor: (attr) => set({ atributoCor: attr }),

  toggleSidebar: () =>
    set((state) => ({ sidebarAberta: !state.sidebarAberta })),

  carregarMapa: () =>
    set((state) => ({
      mapaAtivo: true,
      filtrosCarregados: state.filtros,
    })),

  resetMapa: () => set({ mapaAtivo: false, filtrosCarregados: null }),
}));
