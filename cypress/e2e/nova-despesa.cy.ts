const despesaCriada = {
  id: 'created-uuid',
  data_despesa: '2026-04-27',
  estabelecimento: 'Mercadão Teste',
  categoria_despesa_id: 'cat-uuid-1',
  valor_total: '200.00',
  observacao: null,
  data_cadastro: '2026-04-27T10:00:00',
  data_alteracao: '2026-04-27T10:00:00',
  itens: [
    {
      id: 'item-uuid-1',
      despesa_id: 'created-uuid',
      descricao: 'Arroz 5kg',
      categoria_item_id: 'cat-item-uuid-1',
      quantidade: '2',
      valor_unitario: '25.00',
      valor_total: '50.00',
      data_cadastro: '2026-04-27T10:00:00',
      data_alteracao: '2026-04-27T10:00:00',
    },
  ],
  abastecimento: null,
}

describe('Cadastro de Nova Despesa', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/despesas*', { fixture: 'despesas-list.json' }).as('listaDespesas')
    cy.intercept('GET', '/api/categorias-despesa', { fixture: 'categorias-despesa.json' }).as('categorias')
    cy.intercept('GET', '/api/categorias-item', { fixture: 'categorias-item.json' }).as('categoriasItem')
    cy.intercept('POST', '/api/despesas', { statusCode: 201, body: despesaCriada }).as('criarDespesa')

    cy.visit('/')
    cy.get('[data-cy=btn-nova-despesa]').click()
    cy.wait('@categorias')
    cy.wait('@categoriasItem')
  })

  it('exibe o formulário com todos os campos', () => {
    cy.get('[data-cy=despesa-form]').should('be.visible')
    cy.get('[data-cy=input-estabelecimento]').should('be.visible')
    cy.get('[data-cy=input-data]').should('be.visible')
    cy.get('[data-cy=select-categoria]').should('be.visible')
    cy.get('[data-cy=input-valor-total]').should('be.visible')
    cy.get('[data-cy=btn-add-item]').should('be.visible')
    cy.get('[data-cy=btn-submit]').should('be.visible')
  })

  it('popula o select de categoria com as opções da API', () => {
    cy.get('[data-cy=select-categoria] option').should('have.length.gte', 3)
    cy.get('[data-cy=select-categoria]').contains('Alimentação')
    cy.get('[data-cy=select-categoria]').contains('Saúde')
  })

  it('cadastra uma despesa simples sem itens', () => {
    cy.get('[data-cy=input-estabelecimento]').type('Mercadão Teste')
    cy.get('[data-cy=select-categoria]').select('Alimentação')
    cy.get('[data-cy=input-valor-total]').type('200')

    cy.get('[data-cy=btn-submit]').click()

    cy.wait('@criarDespesa').then((interception) => {
      expect(interception.request.body.estabelecimento).to.eq('Mercadão Teste')
      expect(interception.request.body.itens).to.have.length(0)
    })

    cy.get('[data-cy=despesa-form]').should('not.exist')
    cy.get('[data-cy=btn-nova-despesa]').should('be.visible')
  })

  it('cadastra uma despesa com itens embutidos', () => {
    cy.get('[data-cy=input-estabelecimento]').type('Mercadão Teste')
    cy.get('[data-cy=select-categoria]').select('Alimentação')
    cy.get('[data-cy=input-valor-total]').type('200')

    cy.get('[data-cy=btn-add-item]').click()
    cy.get('[data-cy=item-row]').within(() => {
      cy.get('[data-cy=item-descricao]').type('Arroz 5kg')
      cy.get('[data-cy=item-categoria]').select('Alimento')
      cy.get('[data-cy=item-quantidade]').type('2')
      cy.get('[data-cy=item-valor-unitario]').type('25')
    })

    cy.get('[data-cy=btn-submit]').click()

    cy.wait('@criarDespesa').then((interception) => {
      const { itens } = interception.request.body
      expect(itens).to.have.length(1)
      expect(itens[0].descricao).to.eq('Arroz 5kg')
      expect(itens[0].quantidade).to.eq('2')
    })

    cy.get('[data-cy=despesa-form]').should('not.exist')
  })

  it('adiciona e remove itens do formulário', () => {
    cy.get('[data-cy=item-row]').should('have.length', 0)

    cy.get('[data-cy=btn-add-item]').click()
    cy.get('[data-cy=btn-add-item]').click()
    cy.get('[data-cy=item-row]').should('have.length', 2)

    cy.get('[data-cy=item-remove]').first().click()
    cy.get('[data-cy=item-row]').should('have.length', 1)
  })

  it('volta para a lista ao clicar em Cancelar', () => {
    cy.contains('Cancelar').click()
    cy.get('[data-cy=despesa-form]').should('not.exist')
    cy.get('[data-cy=btn-nova-despesa]').should('be.visible')
  })

  it('volta para a lista ao clicar na seta de voltar', () => {
    cy.contains('← Voltar').click()
    cy.get('[data-cy=despesa-form]').should('not.exist')
  })

  it('exibe erro quando a API retorna falha', () => {
    cy.intercept('POST', '/api/despesas', {
      statusCode: 400,
      body: { detail: 'Operação não permitida: registro relacionado não encontrado ou em uso.' },
    }).as('criarDespesaErro')

    cy.get('[data-cy=input-estabelecimento]').type('Loja X')
    cy.get('[data-cy=select-categoria]').select('Alimentação')
    cy.get('[data-cy=input-valor-total]').type('50')
    cy.get('[data-cy=btn-submit]').click()

    cy.wait('@criarDespesaErro')
    cy.contains('Operação não permitida').should('be.visible')
    cy.get('[data-cy=despesa-form]').should('be.visible')
  })
})
