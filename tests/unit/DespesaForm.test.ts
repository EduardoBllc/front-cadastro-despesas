import { mount, flushPromises } from '@vue/test-utils'
import DespesaForm from '@/components/DespesaForm.vue'
import ImportarNfceModal from '@/components/ImportarNfceModal.vue'
import ItemFormRow from '@/components/ItemFormRow.vue'
import AppCombobox from '@/components/AppCombobox.vue'
import { criarDespesa } from '@/api/despesas'
import { MensagemNfce } from '@/api/nfce'
import type { DespesaDetalhe, RascunhoNfce } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'

jest.mock('@/api/despesas', () => ({
  criarDespesa: jest.fn().mockResolvedValue({
    id: 'uuid-criado',
    estabelecimento_id: 'est-1',
    valor_total: '100.00',
    itens: [],
    abastecimento: null,
  }),
}))

jest.mock('@/api/categorias', () => ({
  listarCategoriasDespesa: jest.fn().mockResolvedValue([
    { id: 'cat-1', descricao: 'Alimentação' },
    { id: 'cat-2', descricao: 'Saúde' },
  ]),
  listarCategoriasItem: jest.fn().mockResolvedValue([
    { id: 'item-cat-1', descricao: 'Alimento' },
    { id: 'item-cat-2', descricao: 'Bebida' },
  ]),
  criarCategoriaDespesa: jest.fn(),
  criarCategoriaItem: jest.fn(),
}))

jest.mock('@/api/estabelecimentos', () => ({
  listarEstabelecimentos: jest.fn().mockResolvedValue([
    { id: 'est-1', descricao: 'Supermercado', tipo_id: 'tipo-1' },
  ]),
  criarEstabelecimento: jest.fn(),
  listarTiposEstabelecimento: jest.fn().mockResolvedValue([
    { id: 'tipo-1', descricao: 'Supermercado' },
  ]),
}))

jest.mock('@/api/itens', () => ({
  listarItens: jest.fn().mockResolvedValue([
    { id: 'item-1', descricao: 'Arroz', unidade_medida: 'kg', valor_referencia: '5.00', ativo: true, categoria_item_id: 'item-cat-1' },
    { id: 'item-2', descricao: 'Feijão', unidade_medida: 'kg', valor_referencia: '8.00', ativo: true, categoria_item_id: 'item-cat-1' },
  ]),
  criarItem: jest.fn(),
}))

jest.mock('@/api/unidades', () => ({
  listarUnidadesMedida: jest.fn().mockResolvedValue([{ id: 'und-kg', descricao: 'Kg' }]),
  criarUnidadeMedida: jest.fn(),
}))

jest.mock('@/api/nfce', () => ({
  ...jest.requireActual('@/api/nfce'),
  importarNfce: jest.fn(),
}))

jest.mock('@/api/carros', () => ({
  listarCarros: jest.fn().mockResolvedValue([
    { id: 'carro-1', nome: 'Gol', placa: 'ABC-1234', ativo: true },
  ]),
}))

jest.mock('@/api/configuracoes', () => ({
  listarConfiguracoes: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/api/sugestoes', () => ({
  sugerirCategoriaDespesa: jest.fn().mockResolvedValue({ sugestoes: [] }),
  sugerirCategoriaItem: jest.fn().mockResolvedValue({ sugestoes: [] }),
}))

describe('DespesaForm', () => {
  it('renderiza todos os campos obrigatórios', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    expect(wrapper.find('[data-cy=select-estabelecimento]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=input-data]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=select-categoria]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=input-valor-total]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=btn-submit]').exists()).toBe(true)
  })

  it('inicia com uma linha de item vazia', () => {
    const wrapper = mount(DespesaForm)
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(1)
  })

  it('adiciona uma nova linha vazia ao preencher a última', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    await wrapper.find('[data-cy=item-quantidade]').setValue('2')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(2)
  })

  it('remove item ao clicar no botão de remover', async () => {
    const wrapper = mount(DespesaForm)
    await flushPromises()
    await wrapper.find('[data-cy=item-quantidade]').setValue('2')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(2)

    await wrapper.find('[data-cy=item-remove]').trigger('click')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(1)
  })

  it('emite evento cancel ao clicar em Cancelar', async () => {
    const wrapper = mount(DespesaForm)
    await wrapper.find('[data-cy=btn-cancel]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('exibe mensagem de erro quando a API falha', async () => {
    const { criarDespesa } = await import('@/api/despesas')
    ;(criarDespesa as jest.Mock).mockRejectedValueOnce(new Error('Categoria não encontrada'))

    const wrapper = mount(DespesaForm)
    await flushPromises()

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Categoria não encontrada')
  })
})

const rascunho: RascunhoNfce = {
  chave: '43' + '0'.repeat(41) + '1',
  data_emissao: '2026-08-19',
  cnpj: '01132478002343',
  razao_social: 'Irmaos Andreazza Ltda',
  endereco: 'Rua Padre Angelo Tronca, 2150, Sao Luiz, Caxias Do Sul, RS',
  estabelecimento_id: null,
  valor_pago: '14.00',
  desconto_total: '0.00',
  itens: [
    { codigo: '111', descricao_nota: 'Arroz Tio 1kg', unidade_nota: 'UN', quantidade: '1.000', valor_unitario: '5.00', valor_desconto: '0.00', item_id: 'item-1' },
    { codigo: '222', descricao_nota: 'Feijao Kg', unidade_nota: 'KG', quantidade: '1.000', valor_unitario: '8.00', valor_desconto: '0.00', item_id: null },
    { codigo: '333', descricao_nota: 'Item Antigo', unidade_nota: 'UN', quantidade: '1.000', valor_unitario: '1.00', valor_desconto: '0.00', item_id: 'item-fora-do-catalogo' },
  ],
}

async function abrirComNota(): Promise<VueWrapper> {
  const wrapper = mount(DespesaForm)
  await flushPromises()
  await wrapper.find('[data-cy=btn-importar-nfce-abrir]').trigger('click')
  wrapper.findComponent(ImportarNfceModal).vm.$emit('importado', rascunho)
  await flushPromises()
  return wrapper
}

async function vincularTudo(wrapper: VueWrapper) {
  wrapper.findAllComponents(AppCombobox)
    .find(c => c.props('dataCy') === 'select-estabelecimento')!
    .vm.$emit('update:modelValue', 'est-1')
  const linhas = wrapper.findAllComponents(ItemFormRow)
  linhas[1].findComponent(AppCombobox).vm.$emit('update:modelValue', 'item-2')
  linhas[2].findComponent(AppCombobox).vm.$emit('update:modelValue', 'item-1')
  await flushPromises()
}

describe('DespesaForm — importação de NFC-e', () => {
  beforeEach(() => jest.clearAllMocks())

  it('preenche o formulário a partir da nota', async () => {
    const wrapper = await abrirComNota()

    expect(wrapper.findComponent(ImportarNfceModal).exists()).toBe(false)
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(rascunho.itens.length + 1)
    expect((wrapper.find('[data-cy=input-data]').element as HTMLInputElement).value).toBe('2026-08-19')
    const aviso = wrapper.find('[data-cy=nfce-estabelecimento-aviso]').text()
    expect(aviso).toContain('Irmaos Andreazza Ltda')
    expect(aviso).toContain('01.132.478/0023-43')

    const dicas = wrapper.findAll('[data-cy=item-descricao-nota]')
    expect(dicas).toHaveLength(rascunho.itens.length)
    expect(dicas[1].text()).toContain('Feijao Kg · KG')

    const linhas = wrapper.findAllComponents(ItemFormRow)
    expect(linhas[0].props('modelValue')).toMatchObject({ item_id: 'item-1', codigo_produto_nfce: '111', valor_unitario: '5.00' })
    expect(linhas[1].props('modelValue')).toMatchObject({ item_id: '', unidade_medida_id: 'und-kg' })
    // vínculo para item fora do catálogo carregado (ex.: inativo) aparece como não vinculado
    expect(linhas[2].props('modelValue')).toMatchObject({ item_id: '' })
  })

  it('bloqueia o salvamento enquanto houver item da nota sem vínculo', async () => {
    const wrapper = await abrirComNota()

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain(MensagemNfce.VINCULE_ITENS)
    expect(criarDespesa).not.toHaveBeenCalled()
  })

  it('envia a origem da nota e os códigos dos produtos ao salvar', async () => {
    const wrapper = await abrirComNota()
    await vincularTudo(wrapper)

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()

    expect(criarDespesa).toHaveBeenCalledWith(expect.objectContaining({
      estabelecimento_id: 'est-1',
      data_despesa: '2026-08-19',
      nfce: { chave: rascunho.chave, cnpj: rascunho.cnpj },
      itens: [
        expect.objectContaining({ item_id: 'item-1', codigo_produto_nfce: '111' }),
        expect.objectContaining({ item_id: 'item-2', codigo_produto_nfce: '222' }),
        expect.objectContaining({ item_id: 'item-1', codigo_produto_nfce: '333' }),
      ],
    }))
  })

  it('"Salvar e começar outra" não leva a nota para a próxima despesa', async () => {
    const wrapper = await abrirComNota()
    await vincularTudo(wrapper)

    await wrapper.find('[data-cy=btn-submit-and-new]').trigger('click')
    await flushPromises()
    expect(jest.mocked(criarDespesa).mock.calls[0][0].nfce).toBeDefined()
    expect(wrapper.findAll('[data-cy=item-descricao-nota]')).toHaveLength(0)
    expect(wrapper.find('[data-cy=nfce-estabelecimento-aviso]').exists()).toBe(false)

    await wrapper.find('[data-cy=despesa-form]').trigger('submit')
    await flushPromises()
    expect(jest.mocked(criarDespesa).mock.calls[1][0].nfce).toBeUndefined()
  })

  it('não oferece importação na edição', async () => {
    const despesa = {
      id: 'd-1', estabelecimento_id: 'est-1', categoria_despesa_id: 'cat-1', valor_total: '10.00',
      data_despesa: '2026-08-19', observacao: null, itens: [], abastecimento: null,
    } as unknown as DespesaDetalhe
    const wrapper = mount(DespesaForm, { props: { despesa } })
    await flushPromises()
    expect(wrapper.find('[data-cy=btn-importar-nfce-abrir]').exists()).toBe(false)
  })
})
