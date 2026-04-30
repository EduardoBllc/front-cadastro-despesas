import { client } from './client'
import type { Estabelecimento, CriarEstabelecimentoPayload, TipoEstabelecimento } from '@/types/api'

export function listarEstabelecimentos(): Promise<Estabelecimento[]> {
  return client.get('/estabelecimentos')
}

export function criarEstabelecimento(payload: CriarEstabelecimentoPayload): Promise<Estabelecimento> {
  return client.post('/estabelecimentos', payload)
}

export function atualizarEstabelecimento(id: string, payload: Partial<CriarEstabelecimentoPayload>): Promise<Estabelecimento> {
  return client.put(`/estabelecimentos/${id}`, payload)
}

export function excluirEstabelecimento(id: string): Promise<void> {
  return client.delete(`/estabelecimentos/${id}`)
}

export function listarTiposEstabelecimento(): Promise<TipoEstabelecimento[]> {
  return client.get('/tipos-estabelecimento')
}

export function criarTipoEstabelecimento(descricao: string): Promise<TipoEstabelecimento> {
  return client.post('/tipos-estabelecimento', { descricao })
}

export function atualizarTipoEstabelecimento(id: string, descricao: string): Promise<TipoEstabelecimento> {
  return client.put(`/tipos-estabelecimento/${id}`, { descricao })
}

export function excluirTipoEstabelecimento(id: string): Promise<void> {
  return client.delete(`/tipos-estabelecimento/${id}`)
}
