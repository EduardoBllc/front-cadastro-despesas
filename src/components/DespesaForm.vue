<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue'
import { criarDespesa } from '@/api/despesas'
import { listarCategoriasDespesa, listarCategoriasItem, criarCategoriaDespesa, criarCategoriaItem } from '@/api/categorias'
import { listarEstabelecimentos, criarEstabelecimento, listarTiposEstabelecimento, criarTipoEstabelecimento } from '@/api/estabelecimentos'
import { listarItens, criarItem } from '@/api/itens'
import { listarUnidadesMedida, criarUnidadeMedida } from '@/api/unidades'
import { listarCarros } from '@/api/carros'
import { listarConfiguracoes } from '@/api/configuracoes'
import { sugerirCategoriaDespesa, sugerirCategoriaItem } from '@/api/sugestoes'
import { getCurrentISODate } from '@/utils/format'
import ItemFormRow from './ItemFormRow.vue'
import AppCombobox from './AppCombobox.vue'
import type {
  Carro, CategoriaDespesa, CategoriaItem, CriarDespesaPayload, CriarItemPayload,
  Estabelecimento, Item, ItemFormState, TipoEstabelecimento, UnidadeMedida
} from '@/types/api'

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
const configsCarregadas = ref(false)

const eAbastecimento = ref(false)

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
  if (eAbastecimento.value) return  // categoria já foi definida pela config
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

const itens = ref<ItemFormState[]>([])

const totalDosItens = computed(() => {
  return itens.value.reduce((acc, item) => {
    const qtd = parseFloat(item.quantidade) || 0
    const valor = parseFloat(item.valor_unitario) || 0
    return acc + qtd * valor
  }, 0)
})

watch(totalDosItens, (novoTotal) => {
  if (itens.value.length > 0) {
    form.valor_total = novoTotal.toFixed(2)
  }
})

watch(() => itens.value.length, (novaQuantidade) => {
  if (novaQuantidade === 0) {
    form.valor_total = ''
  }
})

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
  categoriaAbastecimentoId.value = catConf?.valor ?? ''
  tipoEstabelecimentoPostoId.value = tipoConf?.valor ?? ''
  configsCarregadas.value = true
})

function addItem() {
  itens.value.push({ item_id: '', unidade_medida_id: '', quantidade: '', valor_unitario: '' })
}

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
  novoItem.unidade_medida_id = unidadeMedidaId
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

async function resolveItens(): Promise<CriarItemPayload[]> {
  const result: CriarItemPayload[] = []
  for (const formItem of itens.value) {
    const selectedItem = itensDisponiveis.value.find(i => i.id === formItem.item_id)
    if (!selectedItem) {
      result.push({ item_id: formItem.item_id, quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario })
      continue
    }
    const unitEqual = (selectedItem.unidade_medida_id ?? '') === (formItem.unidade_medida_id ?? '')
    if (unitEqual) {
      result.push({ item_id: formItem.item_id, quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario })
    } else {
      const variant = itensDisponiveis.value.find(
        i => i.descricao.toLowerCase() === selectedItem.descricao.toLowerCase() &&
             (i.unidade_medida_id ?? '') === (formItem.unidade_medida_id ?? '') &&
             i.id !== selectedItem.id
      )
      if (variant) {
        result.push({ item_id: variant.id, quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario })
      } else {
        const newItem = await criarItem({
          descricao: selectedItem.descricao,
          categoria_item_id: selectedItem.categoria_item_id,
          unidade_medida_id: formItem.unidade_medida_id || null,
        })
        itensDisponiveis.value.push(newItem)
        result.push({ item_id: newItem.id, quantidade: formItem.quantidade, valor_unitario: formItem.valor_unitario })
      }
    }
  }
  return result
}

async function handleSubmit() {
  loading.value = true
  error.value = null
  try {
    const resolvedItens = await resolveItens()
    const payload: CriarDespesaPayload = {
      estabelecimento_id: form.estabelecimento_id,
      categoria_despesa_id: form.categoria_despesa_id,
      valor_total: form.valor_total,
      data_despesa: form.data_despesa,
      observacao: form.observacao || undefined,
      itens: resolvedItens,
      abastecimento: eAbastecimento.value ? {
        carro_id: abastecimento.carro_id,
        quilometragem: parseInt(abastecimento.quilometragem),
        litros: abastecimento.litros,
        observacao: abastecimento.observacao || undefined,
      } : undefined,
    }
    await criarDespesa(payload)
    emit('saved')
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

    <div class="flex items-center gap-3 mb-6">
      <button @click="emit('cancel')" class="text-gray-400 hover:text-gray-600 transition-colors text-sm">
        ← Voltar
      </button>
      <h2 class="text-2xl font-bold text-gray-800">Nova Despesa</h2>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6" data-cy="despesa-form">
      <!-- Toggle abastecimento -->
      <div
        v-if="configsCarregadas && categoriaAbastecimentoId && tipoEstabelecimentoPostoId"
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
              :readonly="itens.length > 0"
              :class="[
                'block w-full rounded-lg border-gray-300 px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500',
                itens.length > 0 ? 'bg-gray-100 cursor-not-allowed font-semibold text-gray-600' : 'bg-gray-50/30'
              ]"
            />
            <p v-if="itens.length > 0" class="mt-1 text-[10px] text-gray-400 uppercase tracking-wider">
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
          <button type="button" data-cy="btn-add-item" @click="addItem"
            class="text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors">
            + Adicionar Item
          </button>
        </div>

        <div v-if="itens.length === 0" class="text-center py-4 text-gray-400 text-sm">
          Nenhum item adicionado.
        </div>

        <div v-if="itens.length > 0" class="grid grid-cols-12 gap-2 px-3 text-xs font-medium text-gray-500">
          <span class="col-span-3">Item</span>
          <span class="col-span-2">Unidade</span>
          <span class="col-span-2">Quantidade</span>
          <span class="col-span-2">Valor Unit.</span>
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
            @remove="removeItem(index)"
            @create-item="(desc, unit) => iniciarCriacaoItem(desc, unit, index)"
            @create-unidade="handleCriarUnidadeNoModal"
          />
        </div>
      </div>

      <div v-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{{ error }}</div>

      <div class="flex gap-3 justify-end">
        <button type="button" data-cy="btn-cancel" @click="emit('cancel')"
          class="px-6 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" data-cy="btn-submit" :disabled="loading"
          class="px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors">
          {{ loading ? 'Salvando...' : 'Salvar Despesa' }}
        </button>
      </div>
    </form>
  </div>
</template>
