import { mount, flushPromises } from '@vue/test-utils'
import DespesaForm from '@/components/DespesaForm.vue'

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
    expect(wrapper.find('[data-cy=btn-add-item]').exists()).toBe(true)
    expect(wrapper.find('[data-cy=btn-submit]').exists()).toBe(true)
  })

  it('inicia sem itens na lista', () => {
    const wrapper = mount(DespesaForm)
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(0)
  })

  it('adiciona uma linha de item ao clicar em Adicionar Item', async () => {
    const wrapper = mount(DespesaForm)
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(1)
  })

  it('adiciona múltiplos itens', async () => {
    const wrapper = mount(DespesaForm)
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
    expect(wrapper.findAll('[data-cy=item-row]')).toHaveLength(3)
  })

  it('remove item ao clicar no botão de remover', async () => {
    const wrapper = mount(DespesaForm)
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
    await wrapper.find('[data-cy=btn-add-item]').trigger('click')
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
