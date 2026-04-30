import { client } from './client'
import type { CategoriaDespesa, CategoriaItem } from '@/types/api'

export function listarCategoriasDespesa(): Promise<CategoriaDespesa[]> {
  return client.get('/categorias-despesa')
}

export function criarCategoriaDespesa(descricao: string): Promise<CategoriaDespesa> {
  return client.post('/categorias-despesa', { descricao })
}

export function atualizarCategoriaDespesa(id: string, descricao: string): Promise<CategoriaDespesa> {
  return client.put(`/categorias-despesa/${id}`, { descricao })
}

export function deletarCategoriaDespesa(id: string): Promise<void> {
  return client.delete(`/categorias-despesa/${id}`)
}

export function listarCategoriasItem(): Promise<CategoriaItem[]> {
  return client.get('/categorias-item')
}

export function criarCategoriaItem(descricao: string): Promise<CategoriaItem> {
  return client.post('/categorias-item', { descricao })
}

export function atualizarCategoriaItem(id: string, descricao: string): Promise<CategoriaItem> {
  return client.put(`/categorias-item/${id}`, { descricao })
}

export function deletarCategoriaItem(id: string): Promise<void> {
  return client.delete(`/categorias-item/${id}`)
}
