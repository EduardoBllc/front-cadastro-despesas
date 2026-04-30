import { mount } from '@vue/test-utils'
import AppCombobox from '@/components/AppCombobox.vue'

describe('AppCombobox.vue', () => {
  const options = [
    { id: '1', descricao: 'Alimentação' },
    { id: '2', descricao: 'Transporte' },
  ]

  it('deve renderizar o placeholder e as opções ao focar', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: '',
        options,
        placeholder: 'Busque algo'
      }
    })

    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Busque algo')

    await input.trigger('focus')
    const listItems = wrapper.findAll('li')
    expect(listItems).toHaveLength(2)
    expect(listItems[0].text()).toBe('Alimentação')
  })

  it('deve filtrar opções ao digitar', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: '',
        options
      }
    })

    const input = wrapper.find('input')
    await input.setValue('Trans')
    
    const listItems = wrapper.findAll('li')
    // Deve mostrar a opção filtrada + a opção de criar (pois "Trans" não existe exatamente)
    expect(listItems.some(li => li.text().includes('Transporte'))).toBe(true)
    expect(listItems.some(li => li.text().includes('Criar "Trans"'))).toBe(true)
  })

  it('deve emitir update:modelValue ao selecionar uma opção', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: '',
        options
      }
    })

    await wrapper.find('input').trigger('focus')
    await wrapper.findAll('li').find(li => li.text() === 'Alimentação')?.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['1'])
  })

  it('deve emitir create ao clicar na opção de criação', async () => {
    const wrapper = mount(AppCombobox, {
      props: {
        modelValue: '',
        options
      }
    })

    const input = wrapper.find('input')
    await input.setValue('Nova Categoria')
    
    const createOption = wrapper.findAll('li').find(li => li.text().includes('Criar "Nova Categoria"'))
    await createOption?.trigger('click')

    expect(wrapper.emitted('create')?.[0]).toEqual(['Nova Categoria'])
  })
})
