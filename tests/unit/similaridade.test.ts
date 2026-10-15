import { LIMITE_SUGESTOES, sugerirItens } from '@/utils/similaridade'

const catalogo = [
  { id: 'cenoura', descricao: 'Cenoura' },
  { id: 'banana', descricao: 'Banana' },
  { id: 'banana-prata', descricao: 'Banana Prata' },
  { id: 'feijao', descricao: 'Feijão' },
  { id: 'leite', descricao: 'Leite' },
  { id: 'alface', descricao: 'Alface' },
  { id: 'sal', descricao: 'Sal' },
  { id: 'salsicha', descricao: 'Salsicha' },
]

const ids = (itens: { id: string }[]) => itens.map(i => i.id)

describe('sugerirItens', () => {
  it('pré-seleciona quando o nome é idêntico ignorando caixa e unidade', () => {
    expect(sugerirItens('CENOURA KG', catalogo).automatico?.id).toBe('cenoura')
  })

  it('ignora acentos', () => {
    expect(sugerirItens('Feijao Kg', catalogo).automatico?.id).toBe('feijao')
  })

  it('reconhece abreviação da nota e ordena pela semelhança', () => {
    const { automatico, sugestoes } = sugerirItens('BAN PRATA KG', catalogo)
    expect(automatico?.id).toBe('banana-prata')
    expect(ids(sugestoes)).toEqual(['banana-prata', 'banana'])
  })

  it('só sugere quando sobram palavras sem correspondência', () => {
    for (const nota of ['DOCE DE LEITE 400G', 'Alface Hidroponica Unidade']) {
      expect(sugerirItens(nota, catalogo).automatico).toBeNull()
    }
    expect(ids(sugerirItens('DOCE DE LEITE 400G', catalogo).sugestoes)).toEqual(['leite'])
    expect(ids(sugerirItens('Alface Hidroponica Unidade', catalogo).sugestoes)).toEqual(['alface'])
  })

  it('não pré-seleciona quando mais de um item é idêntico', () => {
    const { automatico, sugestoes } = sugerirItens('SAL 1KG', catalogo)
    expect(automatico).toBeNull()
    expect(ids(sugestoes)).toEqual(['sal', 'salsicha'])
  })

  it('não sugere nada sem palavra em comum', () => {
    expect(sugerirItens('DETERGENTE NEUTRO 500ML', catalogo)).toEqual({ automatico: null, sugestoes: [] })
  })

  it('limita a quantidade de sugestões', () => {
    const arrozes = ['Branco', 'Integral', 'Parboilizado', 'Arbóreo'].map(tipo => ({
      id: tipo, descricao: `Arroz ${tipo}`,
    }))
    expect(sugerirItens('ARROZ 5KG', arrozes).sugestoes).toHaveLength(LIMITE_SUGESTOES)
  })
})
