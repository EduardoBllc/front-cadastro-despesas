<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed, nextTick } from 'vue'
import { criarDespesa, atualizarDespesa, atualizarAbastecimento } from '@/api/despesas'
import { listarCategoriasDespesa, listarCategoriasItem, criarCategoriaDespesa, criarCategoriaItem } from '@/api/categorias'
import { listarEstabelecimentos, criarEstabelecimento, listarTiposEstabelecimento, criarTipoEstabelecimento } from '@/api/estabelecimentos'
import { listarItens, criarItem } from '@/api/itens'
import { listarUnidadesMedida, criarUnidadeMedida } from '@/api/unidades'
import { listarCarros } from '@/api/carros'
import { listarConfiguracoes } from '@/api/configuracoes'
import { sugerirCategoriaDespesa, sugerirCategoriaItem } from '@/api/sugestoes'
import { formatCnpj, getCurrentISODate } from '@/utils/format'
import { MensagemNfce } from '@/api/nfce'
import ImportarNfceModal from './ImportarNfceModal.vue'
import ItemFormRow from './ItemFormRow.vue'
import AppCombobox from './AppCombobox.vue'
import type {
  Carro, CategoriaDespesa, CategoriaItem, CriarDespesaPayload, CriarItemPayload,
  DespesaDetalhe, Estabelecimento, Item, ItemDespesaParaAtualizar, ItemFormState,
  OrigemNfce, RascunhoNfce, TipoEstabelecimento, UnidadeMedida,
} from '@/types/api'

const props = defineProps<{ despesa?: DespesaDetalhe }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const categoriasDespesa = ref<CategoriaDespesa[]>([])
const categoriasItem = ref<CategoriaItem[]>([])
const unidadesMedida = ref<UnidadeMedida[]>([])
const itensDisponiveis = ref<Item[]>([])
const estabelecimentos = ref<Estabelecimento[]>([])
const tiposEstabelecimento = ref<TipoEstabelecimento[]>([])
const carros = ref<Carro[]>([])

const categoriaAbastecimentoId = ref('')
const tipoEstabelecimentoPostoId = ref('')
const medidaUnitarioId = ref('')
const valorPadraoUnitario = ref('')
const autopreencheUnitarioQuantidade = ref(false)
const autopreencheUnitarioItem = ref(false)
const configsCarregadas = ref(false)

const eAbastecimento = ref(false)
const inicializando = ref(false)

const loading = ref(false)
const error = ref<string | null>(null)

// Modal de criação rápida de estabelecimento
const mostrandoModalEstabelecimento = ref(false)
const novoEstabelecimento = reactive({ descricao: '', tipo_id: '' })
const salvandoEstabelecimento = ref(false)

// Modal de criação rápida de item
const mostrandoModalItem = ref(false)
const novoItem = reactive({ descricao: '', categoria_item_id: '', unidade_medida_id: '' })
const salvandoItem = ref(false)
const indiceItemPendente = ref(-1)

// Importação de NFC-e
const mostrandoModalNfce = ref(false)
const origemNfce = ref<OrigemNfce | null>(null)
const avisoEstabelecimentoNfce = ref<string | null>(null)

let timeoutSugestaoCategoriaDespesa: ReturnType<typeof setTimeout> | null = null
let timeoutSugestaoItem: ReturnType<typeof setTimeout> | null = null

const form = reactive({
  estabelecimento_id: '',
  categoria_despesa_id: '',
  valor_total: '',
  data_despesa: getCurrentISODate(),
  observacao: '',
})

const abastecimento = reactive({
  carro_id: '',
  quilometragem: '',
  litros: '',
  observacao: '',
})

// Só mostra postos quando for abastecimento, caso contrário mostra todos
const opcoesEstabelecimentos = computed(() => {
  const lista = eAbastecimento.value && tipoEstabelecimentoPostoId.value
    ? estabelecimentos.value.filter(e => e.tipo_id === tipoEstabelecimentoPostoId.value)
    : estabelecimentos.value
  return lista.map(e => ({ id: e.id, descricao: e.descricao }))
})

const opcoesCarros = computed(() =>
  carros.value
    .filter(c => c.ativo)
    .map(c => ({ id: c.id, descricao: c.placa ? `${c.nome} (${c.placa})` : c.nome }))
)

const valorPorLitro = computed(() => {
  const total = parseFloat(form.valor_total) || 0
  const litros = parseFloat(abastecimento.litros) || 0
  if (total <= 0 || litros <= 0) return null
  return (total / litros).toFixed(3)
})

watch(eAbastecimento, (isAbast) => {
  if (inicializando.value) return
  if (isAbast) {
    form.categoria_despesa_id = categoriaAbastecimentoId.value
    // Se o estabelecimento atual não é um posto, limpa
    if (tipoEstabelecimentoPostoId.value) {
      const est = estabelecimentos.value.find(e => e.id === form.estabelecimento_id)
      if (est && est.tipo_id !== tipoEstabelecimentoPostoId.value) {
        form.estabelecimento_id = ''
      }
    }
  } else {
    form.categoria_despesa_id = ''
    abastecimento.carro_id = ''
    abastecimento.quilometragem = ''
    abastecimento.litros = ''
    abastecimento.observacao = ''
  }
})

watch(() => form.estabelecimento_id, (id) => {
  if (timeoutSugestaoCategoriaDespesa) clearTimeout(timeoutSugestaoCategoriaDespesa)
  if (inicializando.value || eAbastecimento.value) return  // categoria já foi definida pela config ou inicialização de edição
  const est = estabelecimentos.value.find(e => e.id === id)
  if (est) {
    timeoutSugestaoCategoriaDespesa = setTimeout(async () => {
      try {
        const res = await sugerirCategoriaDespesa(est.descricao)
        if (res.sugestoes.length > 0) {
          if (!form.categoria_despesa_id || res.sugestoes[0].confianca > 0.8) {
            form.categoria_despesa_id = res.sugestoes[0].id
          }
        }
      } catch (e) {
        console.error('Erro ao buscar sugestão:', e)
      }
    }, 300)
  }
})

const itens = ref<ItemFormState[]>([{ item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' }])

function eItemVazio(item: ItemFormState): boolean {
  return !item.item_id && !item.quantidade && !item.valor_unitario
}

const temItensPreenchidos = computed(() => itens.value.some(i => !eItemVazio(i)))

const totalDosItens = computed(() => {
  return itens.value.reduce((acc, item) => {
    const qtd = parseFloat(item.quantidade) || 0
    const valor = parseFloat(item.valor_unitario) || 0
    const desc = parseFloat(item.valor_desconto) || 0
    return acc + Math.max(0, qtd * (valor - desc))
  }, 0)
})

watch(itens, () => {
  const ultimo = itens.value[itens.value.length - 1]
  if (!ultimo || !eItemVazio(ultimo)) {
    itens.value.push({ item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' })
  }
}, { deep: true })

watch(totalDosItens, (novoTotal) => {
  if (temItensPreenchidos.value) {
    form.valor_total = novoTotal.toFixed(2)
  }
})

watch(temItensPreenchidos, (tem) => {
  if (!tem) form.valor_total = ''
})

function popularFormulario() {
  const d = props.despesa!
  form.estabelecimento_id = d.estabelecimento_id
  form.categoria_despesa_id = d.categoria_despesa_id
  form.valor_total = d.valor_total
  form.data_despesa = d.data_despesa
  form.observacao = d.observacao ?? ''

  itens.value = [
    ...d.itens.map(item => ({
      id: item.id,
      item_id: item.item_id ?? '',
      unidade_medida_id: item.item?.unidade_medida_id ?? '',
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_desconto: item.valor_desconto ?? '',
    })),
    { item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' },
  ]

  if (d.abastecimento) {
    eAbastecimento.value = true
    abastecimento.carro_id = d.abastecimento.carro_id
    abastecimento.quilometragem = String(d.abastecimento.quilometragem)
    abastecimento.litros = d.abastecimento.litros
    abastecimento.observacao = d.abastecimento.observacao ?? ''
  }
}

// Não liga `inicializando`: a sugestão de categoria deve disparar pelo estabelecimento da nota
function popularDeRascunho(r: RascunhoNfce) {
  resetForm()
  mostrandoModalNfce.value = false
  origemNfce.value = { chave: r.chave, cnpj: r.cnpj }
  form.data_despesa = r.data_emissao
  form.estabelecimento_id = r.estabelecimento_id ?? ''
  avisoEstabelecimentoNfce.value = r.estabelecimento_id
    ? null
    : `${r.razao_social} · ${formatCnpj(r.cnpj)} · ${r.endereco}`

  itens.value = [
    ...r.itens.map(item => {
      // vínculo para item ausente do catálogo carregado (ex.: inativo) conta como não vinculado
      const doCatalogo = itensDisponiveis.value.find(i => i.id === item.item_id)
      const unidadeDaNota = unidadesMedida.value.find(
        u => u.descricao.toLowerCase() === item.unidade_nota.toLowerCase()
      )
      return {
        item_id: doCatalogo?.id ?? '',
        unidade_medida_id: doCatalogo ? doCatalogo.unidade_medida_id ?? '' : unidadeDaNota?.id ?? '',
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_desconto: item.valor_desconto,
        codigo_produto_nfce: item.codigo,
        descricao_nota: `${item.descricao_nota} · ${item.unidade_nota}`,
      }
    }),
    { item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' },
  ]
}

function bloqueadoPorNfce(): boolean {
  if (!itens.value.some(i => i.codigo_produto_nfce && !i.item_id)) return false
  error.value = MensagemNfce.VINCULE_ITENS
  return true
}

onMounted(async () => {
  const [cats, catsItem, unds, itensAtivos, ests, tipos, carrosList, configs] = await Promise.all([
    listarCategoriasDespesa(),
    listarCategoriasItem(),
    listarUnidadesMedida(),
    listarItens(true),
    listarEstabelecimentos(),
    listarTiposEstabelecimento(),
    listarCarros(),
    listarConfiguracoes(),
  ])
  categoriasDespesa.value = cats
  categoriasItem.value = catsItem
  unidadesMedida.value = unds
  itensDisponiveis.value = itensAtivos
  estabelecimentos.value = ests
  tiposEstabelecimento.value = tipos
  carros.value = carrosList

  const catConf = configs.find(c => c.chave === 'categoria_abastecimento_id')
  const tipoConf = configs.find(c => c.chave === 'tipo_estabelecimento_posto_id')
  const medidaConf = configs.find(c => c.chave === 'medida_unitario_id')
  const valorConf = configs.find(c => c.chave === 'valor_padrao_unitario')
  const autoQtdConf = configs.find(c => c.chave === 'autopreenche_unitario_quantidade')
  const autoItemConf = configs.find(c => c.chave === 'autopreenche_unitario_item')
  categoriaAbastecimentoId.value = catConf?.valor ?? ''
  tipoEstabelecimentoPostoId.value = tipoConf?.valor ?? ''
  medidaUnitarioId.value = medidaConf?.valor ?? ''
  valorPadraoUnitario.value = valorConf?.valor ?? ''
  autopreencheUnitarioQuantidade.value = String(autoQtdConf?.valor).toLowerCase() === 'true'
  autopreencheUnitarioItem.value = String(autoItemConf?.valor).toLowerCase() === 'true'
  configsCarregadas.value = true

  if (props.despesa) {
    inicializando.value = true
    popularFormulario()
    await nextTick()
    inicializando.value = false
  }
})

function removeItem(index: number) {
  itens.value.splice(index, 1)
}

function iniciarCriacaoEstabelecimento(descricao: string) {
  novoEstabelecimento.descricao = descricao
  // Pré-seleciona o tipo posto quando for abastecimento
  novoEstabelecimento.tipo_id = eAbastecimento.value ? tipoEstabelecimentoPostoId.value : ''
  mostrandoModalEstabelecimento.value = true
}

async function handleConfirmarCriacaoEstabelecimento() {
  if (!novoEstabelecimento.descricao || !novoEstabelecimento.tipo_id) return
  salvandoEstabelecimento.value = true
  try {
    const est = await criarEstabelecimento({
      descricao: novoEstabelecimento.descricao,
      tipo_id: novoEstabelecimento.tipo_id,
    })
    estabelecimentos.value.push(est)
    estabelecimentos.value.sort((a, b) => a.descricao.localeCompare(b.descricao))
    form.estabelecimento_id = est.id
    mostrandoModalEstabelecimento.value = false
  } catch (e) {
    error.value = 'Erro ao criar estabelecimento'
  } finally {
    salvandoEstabelecimento.value = false
  }
}

async function handleCriarTipoEstabelecimentoNoModal(descricao: string) {
  try {
    const nova = await criarTipoEstabelecimento(descricao)
    tiposEstabelecimento.value.push(nova)
    tiposEstabelecimento.value.sort((a, b) => a.descricao.localeCompare(b.descricao))
    novoEstabelecimento.tipo_id = nova.id
  } catch (e) {
    error.value = 'Erro ao criar tipo de estabelecimento'
  }
}

function iniciarCriacaoItem(descricao: string, unidadeMedidaId: string, index: number) {
  novoItem.descricao = descricao
  novoItem.categoria_item_id = ''
  novoItem.unidade_medida_id = autopreencheUnitarioItem.value && medidaUnitarioId.value
    ? medidaUnitarioId.value
    : unidadeMedidaId
  indiceItemPendente.value = index
  mostrandoModalItem.value = true

  if (timeoutSugestaoItem) clearTimeout(timeoutSugestaoItem)
  timeoutSugestaoItem = setTimeout(async () => {
    try {
      const res = await sugerirCategoriaItem(descricao)
      if (res.sugestoes.length > 0 && !novoItem.categoria_item_id) {
        novoItem.categoria_item_id = res.sugestoes[0].id
      }
    } catch (e) {
      console.error('Erro ao buscar sugestão de categoria:', e)
    }
  }, 300)
}

async function handleConfirmarCriacaoItem() {
  if (!novoItem.descricao || !novoItem.categoria_item_id) return
  salvandoItem.value = true
  try {
    const item = await criarItem({
      descricao: novoItem.descricao,
      categoria_item_id: novoItem.categoria_item_id,
      unidade_medida_id: novoItem.unidade_medida_id || null,
    })
    itensDisponiveis.value.push(item)
    itensDisponiveis.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    if (indiceItemPendente.value >= 0) {
      itens.value[indiceItemPendente.value].item_id = item.id
    }
    mostrandoModalItem.value = false
  } catch (e) {
    error.value = 'Erro ao criar item'
  } finally {
    salvandoItem.value = false
  }
}

async function handleCriarUnidadeNoModal(descricao: string) {
  try {
    const nova = await criarUnidadeMedida(descricao)
    unidadesMedida.value.push(nova)
    unidadesMedida.value.sort((a, b) => a.descricao.localeCompare(b.descricao))
    novoItem.unidade_medida_id = nova.id
  } catch (e) {
    error.value = 'Erro ao criar unidade de medida'
  }
}

async function handleCreateCategoria(descricao: string) {
  try {
    const nova = await criarCategoriaDespesa(descricao)
    categoriasDespesa.value.push(nova)
    categoriasDespesa.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    form.categoria_despesa_id = nova.id
  } catch (e) {
    error.value = 'Erro ao criar categoria de despesa'
  }
}

async function handleCreateCategoriaNoModal(descricao: string) {
  try {
    const nova = await criarCategoriaItem(descricao)
    categoriasItem.value.push(nova)
    categoriasItem.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    novoItem.categoria_item_id = nova.id
  } catch (e) {
    error.value = 'Erro ao criar categoria de item'
  }
}

async function resolveItemId(formItem: ItemFormState): Promise<string> {
  const selectedItem = itensDisponiveis.value.find(i => i.id === formItem.item_id)
  if (!selectedItem) return formItem.item_id

  const unitEqual = (selectedItem.unidade_medida_id ?? '') === (formItem.unidade_medida_id ?? '')
  if (unitEqual) return formItem.item_id

  const variant = itensDisponiveis.value.find(
    i => i.descricao.toLowerCase() === selectedItem.descricao.toLowerCase() &&
         (i.unidade_medida_id ?? '') === (formItem.unidade_medida_id ?? '') &&
         i.id !== selectedItem.id
  )
  if (variant) return variant.id

  const newItem = await criarItem({
    descricao: selectedItem.descricao,
    categoria_item_id: selectedItem.categoria_item_id,
    unidade_medida_id: formItem.unidade_medida_id || null,
  })
  itensDisponiveis.value.push(newItem)
  return newItem.id
}

async function resolveItens(): Promise<CriarItemPayload[]> {
  const result: CriarItemPayload[] = []
  for (const formItem of itens.value.filter(i => !eItemVazio(i))) {
    result.push({ item_id: await resolveItemId(formItem), quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario, valor_desconto: formItem.valor_desconto || '0', codigo_produto_nfce: formItem.codigo_produto_nfce })
  }
  return result
}

async function resolveItensParaEdicao(): Promise<ItemDespesaParaAtualizar[]> {
  const result: ItemDespesaParaAtualizar[] = []
  for (const formItem of itens.value.filter(i => !eItemVazio(i))) {
    result.push({ id: formItem.id, item_id: await resolveItemId(formItem), quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario, valor_desconto: formItem.valor_desconto || '0' })
  }
  return result
}

function resetForm() {
  form.estabelecimento_id = ''
  form.categoria_despesa_id = ''
  form.valor_total = ''
  form.data_despesa = getCurrentISODate()
  form.observacao = ''
  eAbastecimento.value = false
  abastecimento.carro_id = ''
  abastecimento.quilometragem = ''
  abastecimento.litros = ''
  abastecimento.observacao = ''
  itens.value = [{ item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '', valor_desconto: '' }]
  origemNfce.value = null
  avisoEstabelecimentoNfce.value = null
  error.value = null
}

async function montarPayloadCriacao(): Promise<CriarDespesaPayload> {
  return {
    estabelecimento_id: form.estabelecimento_id,
    categoria_despesa_id: form.categoria_despesa_id,
    valor_total: form.valor_total,
    data_despesa: form.data_despesa,
    observacao: form.observacao || undefined,
    itens: await resolveItens(),
    abastecimento: eAbastecimento.value ? {
      carro_id: abastecimento.carro_id,
      quilometragem: parseInt(abastecimento.quilometragem),
      litros: abastecimento.litros,
      observacao: abastecimento.observacao || undefined,
    } : undefined,
    nfce: origemNfce.value ?? undefined,
  }
}

async function handleSubmit() {
  if (!props.despesa && bloqueadoPorNfce()) return
  loading.value = true
  error.value = null
  try {
    if (props.despesa) {
      const resolvedItens = await resolveItensParaEdicao()
      await atualizarDespesa(props.despesa.id, {
        estabelecimento_id: form.estabelecimento_id,
        categoria_despesa_id: form.categoria_despesa_id,
        valor_total: form.valor_total,
        data_despesa: form.data_despesa,
        observacao: form.observacao || undefined,
        itens: resolvedItens,
      })
      if (props.despesa.abastecimento && eAbastecimento.value) {
        await atualizarAbastecimento(props.despesa.id, {
          carro_id: abastecimento.carro_id,
          quilometragem: parseInt(abastecimento.quilometragem),
          litros: abastecimento.litros,
          observacao: abastecimento.observacao || undefined,
        })
      }
    } else {
      await criarDespesa(await montarPayloadCriacao())
    }
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar despesa'
  } finally {
    loading.value = false
  }
}

async function handleSalvarEComecarOutra() {
  if (bloqueadoPorNfce()) return
  loading.value = true
  error.value = null
  try {
    await criarDespesa(await montarPayloadCriacao())
    resetForm()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar despesa'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative">
    <!-- Modal de Estabelecimento -->
    <div v-if="mostrandoModalEstabelecimento" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <form @submit.prevent="handleConfirmarCriacaoEstabelecimento" class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 border border-gray-100">
        <h4 class="text-lg font-bold text-gray-800">Novo Estabelecimento</h4>
        <p class="text-sm text-gray-500">
          {{ eAbastecimento ? 'Cadastrando posto de combustível.' : 'Qual o tipo de estabelecimento para' }}
          <strong v-if="!eAbastecimento">{{ novoEstabelecimento.descricao }}</strong>?
        </p>
        <AppCombobox
          v-model="novoEstabelecimento.tipo_id"
          :options="tiposEstabelecimento"
          label="Tipo"
          required
          placeholder="Selecione um tipo..."
          @create="handleCriarTipoEstabelecimentoNoModal"
        />
        <div class="flex gap-3 pt-2">
          <button type="button" @click="mostrandoModalEstabelecimento = false"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit"
            :disabled="!novoEstabelecimento.tipo_id || salvandoEstabelecimento"
            class="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {{ salvandoEstabelecimento ? 'Salvando...' : 'Confirmar' }}
          </button>
        </div>
      </form>
    </div>

    <!-- Modal de Item -->
    <div v-if="mostrandoModalItem" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4 border border-gray-100">
        <h4 class="text-lg font-bold text-gray-800">Novo Item</h4>
        <p class="text-sm text-gray-500">Criando <strong>{{ novoItem.descricao }}</strong> no catálogo.</p>
        <div class="space-y-3">
          <AppCombobox
            v-model="novoItem.categoria_item_id"
            :options="categoriasItem"
            label="Categoria"
            required
            placeholder="Selecione ou crie uma categoria..."
            @create="handleCreateCategoriaNoModal"
          />
          <AppCombobox
            v-model="novoItem.unidade_medida_id"
            :options="unidadesMedida"
            label="Unidade de Medida"
            placeholder="Selecione ou crie..."
            @create="handleCriarUnidadeNoModal"
          />
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" @click="mostrandoModalItem = false"
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="button" @click="handleConfirmarCriacaoItem"
            :disabled="!novoItem.categoria_item_id || salvandoItem"
            class="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {{ salvandoItem ? 'Salvando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de importação de NFC-e -->
    <ImportarNfceModal
      v-if="mostrandoModalNfce"
      @importado="popularDeRascunho"
      @fechar="mostrandoModalNfce = false"
    />

    <div class="flex flex-wrap items-center gap-3 mb-6">
      <button @click="emit('cancel')" class="whitespace-nowrap text-gray-400 hover:text-gray-600 transition-colors text-sm">
        ← Voltar
      </button>
      <h2 class="text-2xl font-bold text-gray-800">{{ props.despesa ? 'Editar Despesa' : 'Nova Despesa' }}</h2>
      <button
        v-if="!props.despesa"
        type="button"
        data-cy="btn-importar-nfce-abrir"
        class="ml-auto whitespace-nowrap px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        @click="mostrandoModalNfce = true"
      >
        Importar NFC-e
      </button>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6" data-cy="despesa-form">
      <!-- Toggle abastecimento (apenas em criação) -->
      <div
        v-if="!props.despesa && configsCarregadas && categoriaAbastecimentoId && tipoEstabelecimentoPostoId"
        class="bg-white rounded-xl shadow-sm px-6 py-4 flex items-center justify-between"
      >
        <div>
          <p class="text-sm font-medium text-gray-700">Abastecimento</p>
          <p class="text-xs text-gray-400">Filtra postos e preenche a categoria automaticamente</p>
        </div>
        <button
          type="button"
          @click="eAbastecimento = !eAbastecimento"
          :class="[
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none',
            eAbastecimento ? 'bg-blue-600' : 'bg-gray-200'
          ]"
        >
          <span
            :class="[
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              eAbastecimento ? 'translate-x-6' : 'translate-x-1'
            ]"
          />
        </button>
      </div>

      <!-- Dados principais -->
      <div class="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h3 class="font-semibold text-gray-700 text-sm uppercase tracking-wide">Dados da despesa</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <AppCombobox
              v-model="form.estabelecimento_id"
              :options="opcoesEstabelecimentos"
              :label="eAbastecimento ? 'Posto de Combustível' : 'Estabelecimento'"
              :placeholder="eAbastecimento ? 'Busque ou crie um posto...' : 'Busque ou crie um estabelecimento...'"
              required
              data-cy="select-estabelecimento"
              @create="iniciarCriacaoEstabelecimento"
            />
            <p
              v-if="avisoEstabelecimentoNfce && !form.estabelecimento_id"
              data-cy="nfce-estabelecimento-aviso"
              class="mt-1 text-xs text-amber-700"
            >
              Na nota: {{ avisoEstabelecimentoNfce }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Data *</label>
            <input
              v-model="form.data_despesa"
              data-cy="input-data"
              type="date"
              required
              class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <AppCombobox
              v-model="form.categoria_despesa_id"
              :options="categoriasDespesa"
              label="Categoria"
              placeholder="Selecione ou busque..."
              required
              :disabled="eAbastecimento"
              data-cy="select-categoria"
              @create="handleCreateCategoria"
            />
            <p v-if="eAbastecimento" class="mt-1 text-[10px] text-gray-400 uppercase tracking-wider">
              Definida automaticamente pela configuração
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Valor Total (R$) *</label>
            <input
              v-model="form.valor_total"
              data-cy="input-valor-total"
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0,00"
              :readonly="temItensPreenchidos"
              :class="[
                'block w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500',
                temItensPreenchidos ? 'bg-gray-100 cursor-not-allowed font-semibold text-gray-600' : 'bg-gray-50/30'
              ]"
            />
            <p v-if="temItensPreenchidos" class="mt-1 text-[10px] text-gray-400 uppercase tracking-wider">
              Calculado automaticamente pelos itens
            </p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-600 mb-1">Observação</label>
          <textarea
            v-model="form.observacao"
            data-cy="input-observacao"
            rows="2"
            placeholder="Observação opcional..."
            class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      <!-- Campos de abastecimento -->
      <div v-if="eAbastecimento" class="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h3 class="font-semibold text-gray-700 text-sm uppercase tracking-wide">Dados do Abastecimento</h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="sm:col-span-2">
            <AppCombobox
              v-model="abastecimento.carro_id"
              :options="opcoesCarros"
              label="Veículo"
              placeholder="Selecione o veículo..."
              required
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Quilometragem atual *</label>
            <input
              v-model="abastecimento.quilometragem"
              type="number"
              required
              min="1"
              step="1"
              placeholder="Ex: 45230"
              class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Litros abastecidos *</label>
            <div class="relative">
              <input
                v-model="abastecimento.litros"
                type="number"
                required
                min="0.001"
                step="0.001"
                placeholder="Ex: 40.000"
                class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <span
                v-if="valorPorLitro"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600 pointer-events-none"
              >
                R$ {{ valorPorLitro }}/L
              </span>
            </div>
          </div>

          <div class="sm:col-span-2">
            <label class="block text-sm font-medium text-gray-600 mb-1">Observação</label>
            <input
              v-model="abastecimento.observacao"
              maxlength="200"
              placeholder="Observação opcional..."
              class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <!-- Itens -->
      <div class="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-gray-700 text-sm uppercase tracking-wide">Itens</h3>
        </div>

        <div class="hidden lg:grid grid-cols-12 gap-2 px-3 text-xs font-medium text-gray-500">
          <span class="col-span-3">Item</span>
          <span class="col-span-1">Unidade</span>
          <span class="col-span-2">Quantidade</span>
          <span class="col-span-2">Valor Unit.</span>
          <span class="col-span-1">Desc.</span>
          <span class="col-span-2">Valor Total</span>
          <span class="col-span-1"></span>
        </div>

        <div class="space-y-2">
          <ItemFormRow
            v-for="(_, index) in itens"
            :key="index"
            v-model="itens[index]"
            :itens="itensDisponiveis"
            :unidades="unidadesMedida"
            :removable="index < itens.length - 1"
            :medida-unitario-id="medidaUnitarioId"
            :valor-padrao-unitario="valorPadraoUnitario"
            :autopreenche-unitario-quantidade="autopreencheUnitarioQuantidade"
            @remove="removeItem(index)"
            @create-item="(desc, unit) => iniciarCriacaoItem(desc, unit, index)"
            @create-unidade="handleCriarUnidadeNoModal"
          />
        </div>
      </div>

      <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{{ error }}</div>

      <div class="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button type="button" data-cy="btn-cancel" @click="emit('cancel')"
          class="px-6 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button
          v-if="!props.despesa"
          type="button"
          data-cy="btn-submit-and-new"
          :disabled="loading"
          @click="handleSalvarEComecarOutra"
          class="px-6 py-2 text-sm bg-white hover:bg-gray-50 text-blue-600 border border-blue-300 rounded-lg font-medium disabled:opacity-50 transition-colors">
          {{ loading ? 'Salvando...' : 'Salvar e Começar Outra' }}
        </button>
        <button type="submit" data-cy="btn-submit" :disabled="loading"
          class="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
          {{ loading ? 'Salvando...' : props.despesa ? 'Salvar Alterações' : 'Salvar Despesa' }}
        </button>
      </div>
    </form>
  </div>
</template>
