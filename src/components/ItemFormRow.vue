<script setup lang="ts">
import { computed, watch } from 'vue'
import type { ItemFormState, Item, UnidadeMedida } from '@/types/api'
import AppCombobox from './AppCombobox.vue'
import { formatCurrency } from '@/utils/format'

const model = defineModel<ItemFormState>({ required: true })
const props = defineProps<{
  itens: Item[]
  unidades: UnidadeMedida[]
}>()
const emit = defineEmits<{
  remove: []
  'create-item': [descricao: string, unidade_medida_id: string]
  'create-unidade': [descricao: string]
}>()

const opcoesItens = computed(() => {
  const descMap = new Map<string, Set<string>>()
  for (const item of props.itens) {
    if (!descMap.has(item.descricao)) descMap.set(item.descricao, new Set())
    const unidadeDesc = props.unidades.find(u => u.id === item.unidade_medida_id)?.descricao ?? ''
    descMap.get(item.descricao)!.add(unidadeDesc)
  }
  return props.itens.map(item => {
    const units = descMap.get(item.descricao)!
    const hasMultiple = units.size > 1
    const unidadeDesc = props.unidades.find(u => u.id === item.unidade_medida_id)?.descricao ?? ''
    const label = hasMultiple && unidadeDesc
      ? `${item.descricao} (${unidadeDesc})`
      : item.descricao
    return { id: item.id, descricao: item.descricao, label }
  })
})

watch(() => model.value.item_id, (newId) => {
  const item = props.itens.find(i => i.id === newId)
  if (item) {
    model.value.unidade_medida_id = item.unidade_medida_id ?? ''
    if (!model.value.valor_unitario) {
      model.value.valor_unitario = item.valor_referencia ?? ''
    }
  } else {
    model.value.unidade_medida_id = ''
  }
})

const valorTotal = computed(() => {
  const qtd = parseFloat(model.value.quantidade) || 0
  const unit = parseFloat(model.value.valor_unitario) || 0
  return qtd * unit
})
</script>

<template>
  <div class="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg" data-cy="item-row">
    <div class="col-span-3">
      <AppCombobox
        v-model="model.item_id"
        :options="opcoesItens"
        placeholder="Item"
        required
        data-cy="item-descricao"
        @create="(desc) => emit('create-item', desc, model.unidade_medida_id)"
      />
    </div>
    <div class="col-span-2">
      <AppCombobox
        v-model="model.unidade_medida_id"
        :options="props.unidades"
        placeholder="Und."
        data-cy="item-unidade-medida"
        @create="(desc) => emit('create-unidade', desc)"
      />
    </div>
    <div class="col-span-2">
      <input
        v-model="model.quantidade"
        data-cy="item-quantidade"
        type="number"
        required
        min="0.01"
        step="0.01"
        placeholder="Qtd"
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      />
    </div>
    <div class="col-span-2">
      <input
        v-model="model.valor_unitario"
        data-cy="item-valor-unitario"
        type="number"
        required
        min="0.01"
        step="0.01"
        placeholder="R$ unit."
        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      />
    </div>
    <div class="col-span-2">
      <input
        :value="formatCurrency(valorTotal)"
        readonly
        tabindex="-1"
        placeholder="Total"
        class="block w-full rounded-md border-gray-200 bg-gray-100 shadow-sm sm:text-sm text-right font-medium text-gray-600 cursor-not-allowed"
      />
    </div>
    <div class="col-span-1 flex justify-center pt-1.5">
      <button
        type="button"
        data-cy="item-remove"
        @click="emit('remove')"
        title="Remover item"
        class="text-red-400 hover:text-red-600 transition-colors text-lg leading-none"
      >
        ✕
      </button>
    </div>
  </div>
</template>
