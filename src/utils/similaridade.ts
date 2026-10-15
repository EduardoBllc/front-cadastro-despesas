/**
 * Sugestão de itens do catálogo para a descrição de um produto da NFC-e.
 */

export const LIMITE_SUGESTOES = 3
const TAMANHO_MINIMO_PALAVRA = 3

// unidades por extenso; as abreviadas ("kg", "un", "l") já caem pelo tamanho mínimo
enum PalavraIgnorada {
  UND = 'und',
  UNID = 'unid',
  UNIDADE = 'unidade',
  PCT = 'pct',
}
const IGNORADAS = new Set<string>(Object.values(PalavraIgnorada))

function palavras(texto: string): string[] {
  const semAcento = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return Array.from(new Set(semAcento.split(/[^a-z0-9]+/))).filter(
    p => p.length >= TAMANHO_MINIMO_PALAVRA && !/\d/.test(p) && !IGNORADAS.has(p),
  )
}

// a nota abrevia ("ban" → "banana") e o catálogo às vezes também, então vale nos dois sentidos
// ponytail: prefixo confunde palavras curtas ("sal" × "salsicha"); empate não pré-seleciona,
// trocar por trigramas (pg_trgm) se os palpites errados incomodarem
function batem(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a)
}

/**
 * Ordena os itens pela fração de palavras em comum com a nota (contando os dois lados).
 * `automatico` é o único item cujas palavras batem todas com as da nota, e vice-versa.
 */
export function sugerirItens<T extends { descricao: string }>(
  descricaoNota: string,
  itens: T[],
): { automatico: T | null; sugestoes: T[] } {
  const daNota = palavras(descricaoNota)
  const comparacoes = itens.flatMap(item => {
    const doItem = palavras(item.descricao)
    const noItem = doItem.filter(p => daNota.some(n => batem(p, n))).length
    if (!noItem) return []
    const naNota = daNota.filter(n => doItem.some(p => batem(p, n))).length
    return [{
      item,
      pontuacao: (noItem + naNota) / (doItem.length + daNota.length),
      identico: noItem === doItem.length && naNota === daNota.length,
    }]
  })
  comparacoes.sort((a, b) => b.pontuacao - a.pontuacao || a.item.descricao.localeCompare(b.item.descricao))

  const identicos = comparacoes.filter(c => c.identico)
  return {
    automatico: identicos.length === 1 ? identicos[0].item : null,
    sugestoes: comparacoes.slice(0, LIMITE_SUGESTOES).map(c => c.item),
  }
}
