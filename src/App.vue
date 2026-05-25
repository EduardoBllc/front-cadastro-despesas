<script setup lang="ts">
import { ref } from 'vue'
import DespesaList from './components/DespesaList.vue'
import DespesaForm from './components/DespesaForm.vue'
import CrudCategoria from './components/CrudCategoria.vue'
import CrudCarro from './components/CrudCarro.vue'
import CrudEstabelecimento from './components/CrudEstabelecimento.vue'
import CrudTipoEstabelecimento from './components/CrudTipoEstabelecimento.vue'
import CrudItem from './components/CrudItem.vue'
import ConfiguracaoAbastecimento from './components/ConfiguracaoAbastecimento.vue'
import ConfiguracaoUnitario from './components/ConfiguracaoUnitario.vue'
import {
  listarCategoriasDespesa, criarCategoriaDespesa, atualizarCategoriaDespesa, deletarCategoriaDespesa,
  listarCategoriasItem, criarCategoriaItem, atualizarCategoriaItem, deletarCategoriaItem,
} from './api/categorias'
import { obterDespesa } from './api/despesas'
import type { DespesaDetalhe } from './types/api'

type Section = 'despesas' | 'categorias-despesa' | 'categorias-item' | 'itens' | 'carros' | 'estabelecimentos' | 'tipos-estabelecimento' | 'configuracoes'
const section = ref<Section>('despesas')
const despesaView = ref<'lista' | 'nova' | 'editar'>('lista')
const listKey = ref(0)
const despesaParaEditar = ref<DespesaDetalhe | null>(null)
const carregandoEditar = ref(false)

function navTo(s: Section) {
  section.value = s
  despesaView.value = 'lista'
  despesaParaEditar.value = null
}

async function handleEditar(id: string) {
  carregandoEditar.value = true
  try {
    despesaParaEditar.value = await obterDespesa(id)
    despesaView.value = 'editar'
  } finally {
    carregandoEditar.value = false
  }
}

function onSaved() {
  listKey.value++
  despesaView.value = 'lista'
  despesaParaEditar.value = null
}

const navItems: { key: Section; label: string }[] = [
  { key: 'despesas', label: 'Despesas' },
  { key: 'itens', label: 'Itens' },
  { key: 'categorias-despesa', label: 'Categorias de Despesa' },
  { key: 'categorias-item', label: 'Categorias de Item' },
  { key: 'estabelecimentos', label: 'Estabelecimentos' },
  { key: 'tipos-estabelecimento', label: 'Tipos de Estabelecimento' },
  { key: 'carros', label: 'Carros' },
  { key: 'configuracoes', label: 'Configurações' },
]
</script>

<template>
  <div class="min-h-screen bg-gray-100">
    <header class="bg-white shadow-sm">
      <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
        <span class="text-xl">💰</span>
        <h1 class="text-lg font-bold text-gray-800">Cadastro de Despesas</h1>
      </div>
      <nav class="max-w-5xl mx-auto px-4 flex gap-1 border-t border-gray-100">
        <button
          v-for="item in navItems"
          :key="item.key"
          @click="navTo(item.key)"
          :class="[
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            section === item.key
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          ]"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>

    <main class="max-w-5xl mx-auto px-4 py-8">
      <template v-if="section === 'despesas'">
        <DespesaList
          v-if="despesaView === 'lista'"
          :key="listKey"
          @nova="despesaView = 'nova'"
          @editar="handleEditar"
        />
        <div v-else-if="carregandoEditar" class="text-center py-12 text-gray-400">Carregando...</div>
        <DespesaForm
          v-else-if="despesaView === 'nova'"
          @saved="onSaved"
          @cancel="despesaView = 'lista'"
        />
        <DespesaForm
          v-else-if="despesaView === 'editar' && despesaParaEditar"
          :despesa="despesaParaEditar"
          @saved="onSaved"
          @cancel="() => { despesaView = 'lista'; despesaParaEditar = null }"
        />
      </template>

      <template v-else-if="section === 'categorias-despesa'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Categorias de Despesa</h2>
        <CrudCategoria
          :listar="listarCategoriasDespesa"
          :criar="criarCategoriaDespesa"
          :atualizar="atualizarCategoriaDespesa"
          :deletar="deletarCategoriaDespesa"
        />
      </template>

      <template v-else-if="section === 'categorias-item'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Categorias de Item</h2>
        <CrudCategoria
          :listar="listarCategoriasItem"
          :criar="criarCategoriaItem"
          :atualizar="atualizarCategoriaItem"
          :deletar="deletarCategoriaItem"
        />
      </template>

      <template v-else-if="section === 'itens'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Itens</h2>
        <CrudItem />
      </template>

      <template v-else-if="section === 'estabelecimentos'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Estabelecimentos</h2>
        <CrudEstabelecimento />
      </template>

      <template v-else-if="section === 'tipos-estabelecimento'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Tipos de Estabelecimento</h2>
        <CrudTipoEstabelecimento />
      </template>

      <template v-else-if="section === 'carros'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Carros</h2>
        <CrudCarro />
      </template>

      <template v-else-if="section === 'configuracoes'">
        <h2 class="text-2xl font-bold text-gray-800 mb-6">Configurações</h2>
        <div class="flex flex-wrap gap-8 items-start">
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-gray-600 mb-4">Abastecimento</h3>
            <ConfiguracaoAbastecimento />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-base font-semibold text-gray-600 mb-4">Itens Unitários</h3>
            <ConfiguracaoUnitario />
          </div>
        </div>
      </template>
    </main>
  </div>
</template>
