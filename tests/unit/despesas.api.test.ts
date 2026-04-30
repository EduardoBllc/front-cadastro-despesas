import { listarDespesas, criarDespesa } from '@/api/despesas'

function mockFetch(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response)
}

const listaPaginada = { total: 2, page: 1, page_size: 20, items: [] }

describe('API: listarDespesas', () => {
  it('chama o endpoint correto com parâmetros padrão', async () => {
    mockFetch(listaPaginada)
    await listarDespesas()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/despesas?page=1&page_size=20',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
    )
  })

  it('passa o número de página correto', async () => {
    mockFetch(listaPaginada)
    await listarDespesas(3)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/despesas?page=3&page_size=20',
      expect.any(Object)
    )
  })

  it('lança erro com a mensagem da API quando a resposta não é ok', async () => {
    mockFetch({ detail: 'Serviço indisponível' }, 503)
    await expect(listarDespesas()).rejects.toThrow('Serviço indisponível')
  })

  it('retorna os dados da resposta', async () => {
    const dados = { total: 1, page: 1, page_size: 20, items: [{ id: 'abc' }] }
    mockFetch(dados)
    const result = await listarDespesas()
    expect(result).toEqual(dados)
  })
})

describe('API: criarDespesa', () => {
  const payload = {
    estabelecimento_id: 'est-uuid',
    categoria_despesa_id: 'cat-uuid',
    valor_total: '200.00',
    itens: [
      { item_id: 'item-uuid', quantidade: '2', valor_unitario: '25.00' },
    ],
  }

  it('faz POST para o endpoint correto com o payload serializado', async () => {
    mockFetch({ id: 'novo-uuid', ...payload, abastecimento: null }, 201)
    await criarDespesa(payload)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/despesas',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('retorna a despesa criada com os itens', async () => {
    const resposta = { id: 'novo-uuid', ...payload, itens: payload.itens, abastecimento: null }
    mockFetch(resposta, 201)
    const result = await criarDespesa(payload)
    expect(result.id).toBe('novo-uuid')
  })

  it('lança erro com mensagem da API em caso de falha', async () => {
    mockFetch({ detail: 'Operação não permitida: registro relacionado não encontrado ou em uso.' }, 400)
    await expect(criarDespesa(payload)).rejects.toThrow(
      'Operação não permitida: registro relacionado não encontrado ou em uso.'
    )
  })
})
