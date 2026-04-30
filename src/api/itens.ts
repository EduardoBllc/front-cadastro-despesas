import { client } from './client'
import type { Item, CriarItemCatalogoPayload, AtualizarItemCatalogoPayload } from '@/types/api'

export function listarItens(ativo?: boolean): Promise<Item[]> {
  const params = ativo !== undefined ? `?ativo=${ativo}` : ''
  return client.get(`/itens${params}`)
}

export function criarItem(payload: CriarItemCatalogoPayload): Promise<Item> {
  return client.post('/itens', payload)
}

export function atualizarItem(id: string, payload: AtualizarItemCatalogoPayload): Promise<Item> {
  return client.put(`/itens/${id}`, payload)
}

export function deletarItem(id: string): Promise<void> {
  return client.delete(`/itens/${id}`)
}
