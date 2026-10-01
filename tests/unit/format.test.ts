import { formatDate, formatCurrency, getCurrentISODate, formatCnpj } from '@/utils/format'

describe('format utils', () => {
  describe('formatDate', () => {
    it('deve formatar data ISO para padrão brasileiro', () => {
      expect(formatDate('2026-04-28')).toBe('28/04/2026')
    })

    it('deve retornar traço para data nula ou vazia', () => {
      expect(formatDate(null)).toBe('—')
      expect(formatDate('')).toBe('—')
    })
  })

  describe('formatCurrency', () => {
    it('deve formatar valor string para moeda BRL', () => {
      // Usamos regex porque o formatador do Intl pode colocar espaços inquebráveis ou outros caracteres
      const formatted = formatCurrency('1250.50')
      expect(formatted).toMatch(/R\$\s*1\.250,50/)
    })

    it('deve formatar valor numérico para moeda BRL', () => {
      const formatted = formatCurrency(50.5)
      expect(formatted).toMatch(/R\$\s*50,50/)
    })

    it('deve retornar traço para valor inválido', () => {
      expect(formatCurrency(null)).toBe('—')
    })
  })

  describe('getCurrentISODate', () => {
    it('deve retornar uma data no formato YYYY-MM-DD', () => {
      const date = getCurrentISODate()
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('formatCnpj', () => {
    it('deve formatar CNPJ só com dígitos', () => {
      expect(formatCnpj('01132478002343')).toBe('01.132.478/0023-43')
    })
  })
})
