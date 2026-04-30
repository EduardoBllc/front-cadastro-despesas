import { client } from './client'
import type { AtualizarCarroPayload, Carro, CriarCarroPayload } from '@/types/api'

export function listarCarros(): Promise<Carro[]> {
  return client.get('/carros')
}

export function criarCarro(payload: CriarCarroPayload): Promise<Carro> {
  return client.post('/carros', payload)
}

export function atualizarCarro(id: string, payload: AtualizarCarroPayload): Promise<Carro> {
  return client.put(`/carros/${id}`, payload)
}

export function deletarCarro(id: string): Promise<void> {
  return client.delete(`/carros/${id}`)
}
