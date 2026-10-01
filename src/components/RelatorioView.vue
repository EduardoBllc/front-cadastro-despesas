<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { AbastecimentoEficiencia, AbastecimentoMensal, Carro, CategoriaDespesa, GastoCategoria, GastoMensal } from '@/types/api'
import * as relatoriosApi from '@/api/relatorios'
import { listarCategoriasDespesa } from '@/api/categorias'
import { listarCarros } from '@/api/carros'
import GastosMensaisChart from './relatorios/GastosMensaisChart.vue'
import GastosCategoriaChart from './relatorios/GastosCategoriaChart.vue'
import DeliveryChart from './relatorios/DeliveryChart.vue'
import AbastecimentosMensaisChart from './relatorios/AbastecimentosMensaisChart.vue'
import EficienciaChart from './relatorios/EficienciaChart.vue'

type Tab = 'geral' | 'delivery' | 'abastecimentos'

const anoAtual = new Date().getFullYear()
const anos = Array.from({ length: 3 }, (_, i) => anoAtual - i)

const tab = ref<Tab>('geral')
const ano = ref(anoAtual)

// Geral
const gastosMensais = ref<GastoMensal[]>([])
const gastosCategoria = ref<GastoCategoria[]>([])
const loadingGeral = ref(false)

// Delivery
const categorias = ref<CategoriaDespesa[]>([])
const categoriaId = ref('')
const dadosDelivery = ref<GastoMensal[]>([])
const loadingDelivery = ref(false)

// Abastecimentos
const carros = ref<Carro[]>([])
const carroId = ref('')
const abastecimentosMensais = ref<AbastecimentoMensal[]>([])
const eficiencia = ref<AbastecimentoEficiencia[]>([])
const loadingAbastecimentos = ref(false)

async function fetchGeral() {
  loadingGeral.value = true
  try {
    ;[gastosMensais.value, gastosCategoria.value] = await Promise.all([
      relatoriosApi.gastosMensais(ano.value),
      relatoriosApi.gastosPorCategoria(ano.value),
    ])
  } finally {
    loadingGeral.value = false
  }
}

async function fetchDelivery() {
  if (!categoriaId.value) return
  loadingDelivery.value = true
  try {
    dadosDelivery.value = await relatoriosApi.gastosMensaisPorCategoria(ano.value, categoriaId.value)
  } finally {
    loadingDelivery.value = false
  }
}

async function fetchAbastecimentos() {
  loadingAbastecimentos.value = true
  try {
    const id = carroId.value || undefined
    ;[abastecimentosMensais.value, eficiencia.value] = await Promise.all([
      relatoriosApi.abastecimentosMensais(ano.value, id),
      relatoriosApi.abastecimentosEficiencia(id),
    ])
  } finally {
    loadingAbastecimentos.value = false
  }
}

async function onTabChange(t: Tab) {
  tab.value = t
  if (t === 'geral') {
    fetchGeral()
  } else if (t === 'delivery') {
    if (!categorias.value.length) categorias.value = await listarCategoriasDespesa()
  } else if (t === 'abastecimentos') {
    if (!carros.value.length) carros.value = await listarCarros()
    fetchAbastecimentos()
  }
}

watch(ano, () => {
  if (tab.value === 'geral') fetchGeral()
  else if (tab.value === 'delivery') fetchDelivery()
  else fetchAbastecimentos()
})

watch(categoriaId, fetchDelivery)
watch(carroId, fetchAbastecimentos)

onMounted(fetchGeral)

const tabs: { key: Tab; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'abastecimentos', label: 'Abastecimentos' },
]
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Relatórios</h2>
      <select
        v-model="ano"
        class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option v-for="a in anos" :key="a" :value="a">{{ a }}</option>
      </select>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-gray-200 mb-6">
      <button
        v-for="t in tabs"
        :key="t.key"
        @click="onTabChange(t.key)"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          tab === t.key
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700',
        ]"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- Geral -->
    <template v-if="tab === 'geral'">
      <div v-if="loadingGeral" class="text-center py-16 text-gray-400">Carregando...</div>
      <template v-else>
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Gastos mensais</h3>
          <GastosMensaisChart :dados="gastosMensais" />
        </div>
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Por categoria</h3>
          <div v-if="!gastosCategoria.length" class="text-center py-8 text-gray-400 text-sm">
            Nenhum dado para o período selecionado.
          </div>
          <GastosCategoriaChart v-else :dados="gastosCategoria" />
        </div>
      </template>
    </template>

    <!-- Delivery -->
    <template v-else-if="tab === 'delivery'">
      <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div class="flex items-center gap-4 mb-6">
          <label class="text-sm font-medium text-gray-600">Categoria:</label>
          <select
            v-model="categoriaId"
            class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecione...</option>
            <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.descricao }}</option>
          </select>
        </div>
        <div v-if="!categoriaId" class="text-center py-8 text-gray-400 text-sm">
          Selecione uma categoria para visualizar o relatório.
        </div>
        <div v-else-if="loadingDelivery" class="text-center py-8 text-gray-400 text-sm">
          Carregando...
        </div>
        <template v-else>
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Valor e frequência mensal</h3>
          <DeliveryChart :dados="dadosDelivery" />
          <div v-if="dadosDelivery.length" class="mt-4 grid grid-cols-3 gap-4 text-center">
            <div v-for="d in dadosDelivery" :key="d.mes" class="text-xs text-gray-500">
              <template v-if="d.ticket_medio">
                Ticket médio {{ ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.mes - 1] }}:
                R$ {{ parseFloat(d.ticket_medio).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Abastecimentos -->
    <template v-else-if="tab === 'abastecimentos'">
      <div class="flex items-center gap-4 mb-6">
        <label class="text-sm font-medium text-gray-600">Carro:</label>
        <select
          v-model="carroId"
          class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todos</option>
          <option v-for="c in carros" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </div>

      <div v-if="loadingAbastecimentos" class="text-center py-16 text-gray-400">Carregando...</div>
      <template v-else>
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Gasto e litros por mês</h3>
          <AbastecimentosMensaisChart :dados="abastecimentosMensais" />
        </div>
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Eficiência (km/L)</h3>
          <div v-if="!eficiencia.length" class="text-center py-8 text-gray-400 text-sm">
            Nenhum abastecimento encontrado.
          </div>
          <EficienciaChart v-else :dados="eficiencia" />
        </div>
      </template>
    </template>
  </div>
</template>
