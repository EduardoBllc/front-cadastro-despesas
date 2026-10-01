/**
 * Formata uma string de data (YYYY-MM-DD) para o padrão brasileiro (DD/MM/YYYY).
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  // Adiciona o horário para evitar problemas de fuso horário ao criar o objeto Date
  const date = new Date(dateString + 'T00:00:00')
  return new Intl.DateTimeFormat('pt-BR').format(date)
}

/**
 * Formata um valor monetário (string ou número) para o padrão de Real Brasileiro (R$).
 */
export function formatCurrency(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue)
}

/**
 * Retorna a data atual no formato ISO (YYYY-MM-DD) respeitando o fuso horário local.
 */
export function getCurrentISODate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formata um CNPJ com 14 dígitos para 00.000.000/0000-00.
 */
export function formatCnpj(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}
