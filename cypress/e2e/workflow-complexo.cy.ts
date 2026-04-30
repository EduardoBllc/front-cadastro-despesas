describe('Fluxo Complexo de Despesa', () => {
  beforeEach(() => {
    // Interceptações de APIs
    cy.intercept('GET', '/api/despesas*', { fixture: 'despesas-list.json' }).as('listaDespesas')
    cy.intercept('GET', '/api/categorias-despesa', { fixture: 'categorias-despesa.json' }).as('categorias')
    cy.intercept('GET', '/api/categorias-item', { fixture: 'categorias-item.json' }).as('categoriasItem')
    cy.intercept('GET', '/api/estabelecimentos', { body: [
      { id: 'est-1', descricao: 'Posto Shell', tipo_id: 'tipo-1' }
    ] }).as('estabelecimentos')
    cy.intercept('GET', '/api/tipos-estabelecimento', { body: [
      { id: 'tipo-1', descricao: 'Posto de Combustível' },
      { id: 'tipo-2', descricao: 'Supermercado' }
    ] }).as('tiposEstabelecimento')
    cy.intercept('GET', '/api/sugestoes/categoria-despesa*', { body: { sugestoes: [] } }).as('sugerirCat')
    
    cy.visit('/')
    cy.get('[data-cy=btn-nova-despesa]').click()
  })

  it('deve criar uma nova categoria direto no combobox', () => {
    cy.intercept('POST', '/api/categorias-despesa', { 
      body: { id: 'nova-cat-id', descricao: 'Lazer Novo' } 
    }).as('criarCat')

    // Abre o combobox de categoria e digita
    cy.get('[data-cy=select-categoria]').find('input').type('Lazer Novo')
    
    // Clica na opção de criar
    cy.contains('+ Criar "Lazer Novo"').click()

    cy.wait('@criarCat')
    
    // Verifica se ficou selecionado (o input deve ter o texto da categoria)
    cy.get('[data-cy=select-categoria]').find('input').should('have.value', 'Lazer Novo')
  })

  it('deve criar um novo estabelecimento via modal', () => {
    cy.intercept('POST', '/api/estabelecimentos', { 
      body: { id: 'novo-est-id', descricao: 'Padaria da Esquina', tipo_id: 'tipo-2' } 
    }).as('criarEst')

    // Digita um novo estabelecimento
    cy.get('[data-cy=select-estabelecimento]').find('input').type('Padaria da Esquina')
    cy.contains('+ Criar "Padaria da Esquina"').click()

    // O modal deve aparecer
    cy.contains('Novo Estabelecimento').should('be.visible')
    cy.get('select').select('Supermercado') // Seleciona o tipo no modal
    cy.contains('Confirmar').click()

    cy.wait('@criarEst')

    // Verifica se ficou selecionado no formulário principal
    cy.get('[data-cy=select-estabelecimento]').find('input').should('have.value', 'Padaria da Esquina')
  })

  it('deve disparar sugestão ao selecionar um estabelecimento', () => {
    cy.intercept('GET', '/api/sugestoes/categoria-despesa?termo=Posto%20Shell', { 
      body: { sugestoes: [{ id: 'cat-transporte-id', descricao: 'Combustível', confianca: 0.9 }] } 
    }).as('sugerirCatForte')

    // Seleciona um estabelecimento existente
    cy.get('[data-cy=select-estabelecimento]').find('input').type('Posto')
    cy.contains('Posto Shell').click()

    cy.wait('@sugerirCatForte')

    // A categoria deve ter sido preenchida automaticamente
    cy.get('[data-cy=select-categoria]').find('input').should('have.value', 'Combustível')
  })
})
