import { client } from './client'
import type { Configuracao } from '@/types/api'

export function listarConfiguracoes(): Promise<Configuracao[]> {
  return client.get('/configuracoes')
}

export function atualizarConfiguracao(chave: string, valor: string | null): Promise<Configuracao> {
  return client.put(`/configuracoes/${chave}`, { valor })
}
