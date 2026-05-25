import { client } from './client'
import type {
  AbastecimentoDetalhe, AtualizarAbastecimentoPayload, AtualizarDespesaPayload,
  CriarDespesaPayload, DespesaDetalhe, DespesaLista, PaginatedResponse,
} from '@/types/api'

export function listarDespesas(page = 1, pageSize = 20): Promise<PaginatedResponse<DespesaLista>> {
  return client.get(`/despesas?page=${page}&page_size=${pageSize}`)
}

export function criarDespesa(payload: CriarDespesaPayload): Promise<DespesaDetalhe> {
  return client.post('/despesas', payload)
}

export function atualizarDespesa(id: string, payload: AtualizarDespesaPayload): Promise<DespesaDetalhe> {
  return client.put(`/despesas/${id}`, payload)
}

export function atualizarAbastecimento(id: string, payload: AtualizarAbastecimentoPayload): Promise<AbastecimentoDetalhe> {
  return client.put(`/despesas/${id}/abastecimento`, payload)
}

export function deletarDespesa(id: string): Promise<void> {
  return client.delete(`/despesas/${id}`)
}

export function obterDespesa(id: string): Promise<DespesaDetalhe> {
  return client.get(`/despesas/${id}`)
}
