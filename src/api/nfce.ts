import { client } from './client'
import type { RascunhoNfce } from '@/types/api'

export enum MensagemNfce {
  CAMERA_INDISPONIVEL = 'Não foi possível acessar a câmera',
  VINCULE_ITENS = 'Vincule todos os itens da nota',
  ERRO_IMPORTACAO = 'Erro ao importar a nota',
}

export function importarNfce(url: string): Promise<RascunhoNfce> {
  return client.post('/nfce/importar', { url })
}
