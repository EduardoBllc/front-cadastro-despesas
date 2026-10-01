export interface TipoEstabelecimento {
  id: string
  descricao: string
  data_cadastro: string
  data_alteracao: string
}

export interface Estabelecimento {
  id: string
  descricao: string
  tipo_id: string
  tipo?: TipoEstabelecimento
  data_cadastro: string
  data_alteracao: string
}

export interface CriarEstabelecimentoPayload {
  descricao: string
  tipo_id: string
}

export interface CategoriaDespesa {
  id: string
  descricao: string
  data_cadastro: string
  data_alteracao: string
}

export interface CategoriaItem {
  id: string
  descricao: string
  data_cadastro: string
  data_alteracao: string
}

export interface UnidadeMedida {
  id: string
  descricao: string
  data_cadastro: string
  data_alteracao: string
}

export interface Configuracao {
  chave: string
  tipo: string
  valor: string | null
  data_cadastro: string
  data_alteracao: string
}

export interface Carro {
  id: string
  nome: string
  placa: string | null
  ativo: boolean
  data_cadastro: string
  data_alteracao: string
}

export interface CriarCarroPayload {
  nome: string
  placa?: string
}

export interface AtualizarCarroPayload {
  nome?: string
  placa?: string | null
  ativo?: boolean
}

export interface Item {
  id: string
  descricao: string
  categoria_item_id: string
  unidade_medida_id: string | null
  unidade_medida: UnidadeMedida | null
  valor_referencia: string | null
  ativo: boolean
  data_cadastro: string
  data_alteracao: string
}

export interface CriarItemCatalogoPayload {
  descricao: string
  categoria_item_id: string
  unidade_medida_id?: string | null
}

export interface AtualizarItemCatalogoPayload {
  descricao?: string
  categoria_item_id?: string
  unidade_medida_id?: string | null
  valor_referencia?: string | null
  ativo?: boolean
}

export interface ItemDespesa {
  id: string
  despesa_id: string
  item_id: string | null
  item: Item | null
  quantidade: string
  valor_unitario: string
  valor_desconto: string
  valor_total: string
  data_cadastro: string
  data_alteracao: string
}

export interface AbastecimentoDetalhe {
  id: string
  despesa_id: string
  carro_id: string
  posto_id: string | null
  data_abastecimento: string
  quilometragem: number
  litros: string
  valor_total: string
  valor_por_litro: string
  km_rodados: number | null
  km_por_litro: string | null
  observacao: string | null
  data_cadastro: string
  data_alteracao: string
}

export interface DespesaLista {
  id: string
  data_despesa: string
  estabelecimento_id: string
  estabelecimento: Estabelecimento
  categoria_despesa_id: string
  valor_total: string
  observacao: string | null
  data_cadastro: string
  data_alteracao: string
}

export interface DespesaDetalhe extends DespesaLista {
  itens: ItemDespesa[]
  abastecimento: AbastecimentoDetalhe | null
}

export interface PaginatedResponse<T> {
  total: number
  page: number
  page_size: number
  items: T[]
}

export interface CriarItemPayload {
  item_id: string
  quantidade: string
  valor_unitario: string
  valor_desconto: string
}

export interface ItemFormState {
  id?: string
  item_id: string
  unidade_medida_id: string
  quantidade: string
  valor_unitario: string
  valor_desconto: string
}

export interface ItemDespesaParaAtualizar {
  id?: string
  item_id: string
  quantidade: string
  valor_unitario: string
  valor_desconto: string
}

export interface AtualizarDespesaPayload {
  estabelecimento_id?: string
  categoria_despesa_id?: string
  valor_total?: string
  data_despesa?: string
  observacao?: string
  itens?: ItemDespesaParaAtualizar[]
}

export interface AtualizarAbastecimentoPayload {
  carro_id?: string
  quilometragem?: number
  litros?: string
  observacao?: string
}

export interface CriarAbastecimentoPayload {
  carro_id: string
  quilometragem: number
  litros: string
  observacao?: string
}

export interface CriarDespesaPayload {
  estabelecimento_id: string
  categoria_despesa_id: string
  valor_total: string
  data_despesa?: string
  observacao?: string
  itens: CriarItemPayload[]
  abastecimento?: CriarAbastecimentoPayload
}

export interface GastoMensal {
  mes: number
  total: string
  quantidade: number
  ticket_medio: string | null
}

export interface GastoCategoria {
  categoria_id: string
  categoria_descricao: string
  total: string
  quantidade: number
  percentual: string
}

export interface AbastecimentoMensal {
  mes: number
  total_gasto: string
  total_litros: string
  quantidade: number
}

export interface AbastecimentoEficiencia {
  data_abastecimento: string
  quilometragem: number
  km_rodados: number | null
  km_por_litro: string | null
  valor_por_litro: string
  total_gasto: string
}
