import { client } from './client'

export interface SugestaoCategoria {
  id: string
  descricao: string
  confianca: number
}

export interface RespostaSugestoes {
  sugestoes: SugestaoCategoria[]
}

export async function sugerirCategoriaDespesa(termo: string): Promise<RespostaSugestoes> {
  if (termo.length < 2) return { sugestoes: [] }
  return client.get(`/sugestoes/categoria-despesa?termo=${encodeURIComponent(termo)}`)
}

export async function sugerirCategoriaItem(termo: string): Promise<RespostaSugestoes> {
  if (termo.length < 2) return { sugestoes: [] }
  return client.get(`/sugestoes/categoria-item?termo=${encodeURIComponent(termo)}`)
}
