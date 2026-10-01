import { importarNfce } from '@/api/nfce'

function mockFetch(data: unknown, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response)
}

const URL_NOTA = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43|2|1|2|ABC'

describe('API: importarNfce', () => {
  it('faz POST para /nfce/importar com a url', async () => {
    mockFetch({ chave: 'x', itens: [] })
    await importarNfce(URL_NOTA)
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/nfce/importar',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: URL_NOTA }) })
    )
  })

  it('propaga a mensagem de erro da API', async () => {
    mockFetch({ detail: 'SEFAZ indisponível, tente novamente' }, 502)
    await expect(importarNfce(URL_NOTA)).rejects.toThrow('SEFAZ indisponível, tente novamente')
  })
})
