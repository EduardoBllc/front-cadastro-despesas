import { client } from './client'
import type { CriarDespesaPayload, DespesaDetalhe, DespesaLista, PaginatedResponse } from '@/types/api'

export function listarDespesas(page = 1, pageSize = 20): Promise<PaginatedResponse<DespesaLista>> {
  return client.get(`/despesas?page=${page}&page_size=${pageSize}`)
}

export function criarDespesa(payload: CriarDespesaPayload): Promise<DespesaDetalhe> {
  return client.post('/despesas', payload)
}

export function deletarDespesa(id: string): Promise<void> {
  return client.delete(`/despesas/${id}`)
}

export function obterDespesa(id: string): Promise<DespesaDetalhe> {
  return client.get(`/despesas/${id}`)
}
