// Paleta com boa distinção visual sobre fundo escuro.
const PALETTE = [
  "#3ea6ff", "#51cf66", "#ffd43b", "#cc5de8",
  "#ff922b", "#22b8cf", "#f06595", "#94d82d", "#845ef7",
  "#ff8787", "#69db7c", "#4dabf7", "#ffa94d", "#e599f7",
];

// Cores fixas para categorias especiais
const COR_IMPEDITIVA = "#ef4444"; // vermelho
const COR_NAO_INFORMADO = "#1e3a8a"; // azul escuro

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const cache = new Map<string, string>();

/** Retorna sempre a mesma cor para o mesmo valor de categoria. */
export function corParaCategoria(valor: string | null): string {
  if (valor === null || valor === undefined || valor.trim() === "") return COR_NAO_INFORMADO;
  if (valor.toUpperCase().includes("IMPEDITIVA")) return COR_IMPEDITIVA;

  const existente = cache.get(valor);
  if (existente) return existente;

  const cor = PALETTE[hashString(valor) % PALETTE.length];
  cache.set(valor, cor);
  return cor;
}

export function categoriasConhecidas(): [string, string][] {
  return Array.from(cache.entries());
}
