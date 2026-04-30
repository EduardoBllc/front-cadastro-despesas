import { client } from './client'
import type { UnidadeMedida } from '@/types/api'

export function listarUnidadesMedida(): Promise<UnidadeMedida[]> {
  return client.get('/unidades-medida')
}

export function criarUnidadeMedida(descricao: string): Promise<UnidadeMedida> {
  return client.post('/unidades-medida', { descricao })
}

export function atualizarUnidadeMedida(id: string, descricao: string): Promise<UnidadeMedida> {
  return client.put(`/unidades-medida/${id}`, { descricao })
}

export function deletarUnidadeMedida(id: string): Promise<void> {
  return client.delete(`/unidades-medida/${id}`)
}
