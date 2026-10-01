import { client } from './client'
import type { AbastecimentoEficiencia, AbastecimentoMensal, GastoCategoria, GastoMensal } from '@/types/api'

export function gastosMensais(ano: number): Promise<GastoMensal[]> {
  return client.get(`/relatorios/gastos-mensais?ano=${ano}`)
}

export function gastosPorCategoria(ano: number, mes?: number): Promise<GastoCategoria[]> {
  const q = mes != null ? `&mes=${mes}` : ''
  return client.get(`/relatorios/gastos-por-categoria?ano=${ano}${q}`)
}

export function gastosMensaisPorCategoria(ano: number, categoriaId: string): Promise<GastoMensal[]> {
  return client.get(`/relatorios/gastos-mensais-por-categoria?ano=${ano}&categoria_despesa_id=${categoriaId}`)
}

export function abastecimentosMensais(ano: number, carroId?: string): Promise<AbastecimentoMensal[]> {
  const q = carroId ? `&carro_id=${carroId}` : ''
  return client.get(`/relatorios/abastecimentos-mensais?ano=${ano}${q}`)
}

export function abastecimentosEficiencia(carroId?: string, limite = 20): Promise<AbastecimentoEficiencia[]> {
  const q = carroId ? `&carro_id=${carroId}` : ''
  return client.get(`/relatorios/abastecimentos-eficiencia?limite=${limite}${q}`)
}
