import { mount, flushPromises } from '@vue/test-utils'
import ImportarNfceModal from '@/components/ImportarNfceModal.vue'
import LeitorQrCode from '@/components/LeitorQrCode.vue'
import { importarNfce, MensagemNfce } from '@/api/nfce'
import type { RascunhoNfce } from '@/types/api'

jest.mock('@/api/nfce', () => ({
  ...jest.requireActual('@/api/nfce'),
  importarNfce: jest.fn(),
}))

const URL_NOTA = 'https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=43|2|1|2|ABC'
const ERRO_SEFAZ = 'SEFAZ indisponível, tente novamente'

const rascunho: RascunhoNfce = {
  chave: '43' + '0'.repeat(41) + '1',
  data_emissao: '2026-08-19',
  cnpj: '01132478002343',
  razao_social: 'Irmaos Andreazza Ltda',
  endereco: 'Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS',
  estabelecimento_id: null,
  valor_pago: '5.00',
  desconto_total: '0.00',
  itens: [],
}

describe('ImportarNfceModal', () => {
  beforeEach(() => jest.mocked(importarNfce).mockReset())

  it('importa o link colado e emite o rascunho', async () => {
    jest.mocked(importarNfce).mockResolvedValue(rascunho)
    const wrapper = mount(ImportarNfceModal)

    await wrapper.find('[data-cy=input-nfce-url]').setValue(`  ${URL_NOTA}  `)
    await wrapper.find('[data-cy=form-importar-nfce]').trigger('submit')
    await flushPromises()

    expect(importarNfce).toHaveBeenCalledWith(URL_NOTA)
    expect(wrapper.emitted('importado')?.[0]).toEqual([rascunho])
  })

  it('mostra o erro da API no modal', async () => {
    jest.mocked(importarNfce).mockRejectedValue(new Error(ERRO_SEFAZ))
    const wrapper = mount(ImportarNfceModal)

    await wrapper.find('[data-cy=input-nfce-url]').setValue(URL_NOTA)
    await wrapper.find('[data-cy=form-importar-nfce]').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-cy=nfce-erro]').text()).toBe(ERRO_SEFAZ)
    expect(wrapper.emitted('importado')).toBeUndefined()
  })

  it('importa automaticamente o link lido pela webcam', async () => {
    jest.mocked(importarNfce).mockResolvedValue(rascunho)
    const wrapper = mount(ImportarNfceModal, { global: { stubs: { LeitorQrCode: true } } })

    await wrapper.find('[data-cy=btn-ler-webcam]').trigger('click')
    wrapper.findComponent(LeitorQrCode).vm.$emit('lido', URL_NOTA)
    await flushPromises()

    expect(importarNfce).toHaveBeenCalledWith(URL_NOTA)
    expect(wrapper.findComponent(LeitorQrCode).exists()).toBe(false)
  })

  it('mostra o erro da câmera', async () => {
    const wrapper = mount(ImportarNfceModal, { global: { stubs: { LeitorQrCode: true } } })

    await wrapper.find('[data-cy=btn-ler-webcam]').trigger('click')
    wrapper.findComponent(LeitorQrCode).vm.$emit('erro', MensagemNfce.CAMERA_INDISPONIVEL)
    await flushPromises()

    expect(wrapper.find('[data-cy=nfce-erro]').text()).toBe(MensagemNfce.CAMERA_INDISPONIVEL)
  })

  it('emite fechar ao cancelar', async () => {
    const wrapper = mount(ImportarNfceModal)
    await wrapper.find('[data-cy=btn-cancelar-nfce]').trigger('click')
    expect(wrapper.emitted('fechar')).toBeTruthy()
  })
})
