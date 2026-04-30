describe('Listagem de Despesas', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/despesas*', { fixture: 'despesas-list.json' }).as('listaDespesas')
    cy.intercept('GET', '/api/categorias-despesa', { fixture: 'categorias-despesa.json' })
    cy.intercept('GET', '/api/categorias-item', { fixture: 'categorias-item.json' })
    cy.visit('/')
  })

  it('exibe o título da aplicação', () => {
    cy.contains('Cadastro de Despesas').should('be.visible')
  })

  it('exibe a lista de despesas após carregar', () => {
    cy.wait('@listaDespesas')
    cy.get('[data-cy=despesa-item]').should('have.length', 2)
  })

  it('exibe os dados corretos de cada despesa', () => {
    cy.wait('@listaDespesas')
    cy.get('[data-cy=despesa-item]').first().within(() => {
      cy.contains('Supermercado Teste').should('be.visible')
      cy.contains('R$').should('be.visible')
    })
    cy.get('[data-cy=despesa-item]').last().within(() => {
      cy.contains('Farmácia Central').should('be.visible')
    })
  })

  it('exibe o botão Nova Despesa', () => {
    cy.get('[data-cy=btn-nova-despesa]').should('be.visible')
  })

  it('navega para o formulário ao clicar em Nova Despesa', () => {
    cy.get('[data-cy=btn-nova-despesa]').click()
    cy.get('[data-cy=despesa-form]').should('be.visible')
    cy.get('[data-cy=btn-nova-despesa]').should('not.exist')
  })

  it('exibe tela vazia quando não há despesas', () => {
    cy.intercept('GET', '/api/despesas*', {
      body: { total: 0, page: 1, page_size: 20, items: [] },
    }).as('listaDespesasVazia')
    cy.visit('/')
    cy.wait('@listaDespesasVazia')
    cy.contains('Nenhuma despesa cadastrada').should('be.visible')
  })

  it('não exibe paginação quando há menos de 20 despesas', () => {
    cy.wait('@listaDespesas')
    cy.contains('Anterior').should('not.exist')
  })
})
