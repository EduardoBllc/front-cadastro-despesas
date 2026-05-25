<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listarDespesas, deletarDespesa } from '@/api/despesas'
import { formatDate, formatCurrency } from '@/utils/format'
import type { DespesaLista, PaginatedResponse } from '@/types/api'
import DespesaDetalhesModal from './DespesaDetalhesModal.vue'
import ActionButton from './ActionButton.vue'

const emit = defineEmits<{ nova: []; editar: [id: string] }>()

const state = ref<PaginatedResponse<DespesaLista>>({
  total: 0,
  page: 1,
  page_size: 20,
  items: [],
})
const loading = ref(false)
const error = ref<string | null>(null)
const deletandoId = ref<string | null>(null)
const despesaDetalhesId = ref<string | null>(null)

async function load(page = 1) {
  loading.value = true
  error.value = null
  try {
    state.value = await listarDespesas(page)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar despesas'
  } finally {
    loading.value = false
  }
}

async function handleDeletar(id: string) {
  if (!confirm('Deseja realmente excluir esta despesa?')) return
  deletandoId.value = id
  error.value = null
  try {
    await deletarDespesa(id)
    state.value.items = state.value.items.filter(i => i.id !== id)
    state.value.total--
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao excluir despesa'
  } finally {
    deletandoId.value = null
  }
}

onMounted(() => load())

const totalPages = () => Math.ceil(state.value.total / state.value.page_size)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Despesas</h2>
      <button
        data-cy="btn-nova-despesa"
        @click="emit('nova')"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      >
        + Nova Despesa
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando...</div>

    <div v-else-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{{ error }}</div>

    <template v-else>
      <div v-if="state.items.length === 0" class="text-center py-16 text-gray-400">
        <p class="text-5xl mb-4">💸</p>
        <p>Nenhuma despesa cadastrada.</p>
        <button
          @click="emit('nova')"
          class="mt-4 text-blue-600 hover:underline text-sm"
        >
          Cadastrar primeira despesa
        </button>
      </div>

      <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="text-left px-4 py-3 text-gray-600 font-medium">Data</th>
              <th class="text-left px-4 py-3 text-gray-600 font-medium">Estabelecimento</th>
              <th class="text-left px-4 py-3 text-gray-600 font-medium hidden sm:table-cell">Observação</th>
              <th class="text-right px-4 py-3 text-gray-600 font-medium">Valor Total</th>
              <th class="px-4 py-3 w-40"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="item in state.items"
              :key="item.id"
              data-cy="despesa-item"
              class="hover:bg-gray-50 transition-colors"
            >
              <td class="px-4 py-3 text-gray-500 whitespace-nowrap">
                {{ formatDate(item.data_despesa) }}
              </td>
              <td class="px-4 py-3 text-gray-800 font-medium">
                {{ item.estabelecimento?.descricao || '—' }}
              </td>
              <td class="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                {{ item.observacao ?? '—' }}
              </td>
              <td class="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                {{ formatCurrency(item.valor_total) }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <ActionButton
                    variant="editar"
                    data-cy="btn-editar-despesa"
                    @click="emit('editar', item.id)"
                  />
                  <ActionButton
                    variant="detalhes"
                    data-cy="btn-detalhes-despesa"
                    @click="despesaDetalhesId = item.id"
                  />
                  <ActionButton
                    variant="excluir"
                    data-cy="btn-deletar-despesa"
                    :loading="deletandoId === item.id"
                    :disabled="deletandoId === item.id"
                    @click="handleDeletar(item.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detalhes Modal -->
      <DespesaDetalhesModal
        v-if="despesaDetalhesId"
        :despesa-id="despesaDetalhesId"
        @close="despesaDetalhesId = null"
      />

      <!-- Paginação -->
      <div
        v-if="state.total > state.page_size"
        class="flex items-center justify-between mt-4 text-sm"
      >
        <p class="text-gray-500">{{ state.total }} despesa(s) no total</p>
        <div class="flex items-center gap-2">
          <button
            @click="load(state.page - 1)"
            :disabled="state.page === 1"
            class="px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Anterior
          </button>
          <span class="text-gray-600">{{ state.page }} / {{ totalPages() }}</span>
          <button
            @click="load(state.page + 1)"
            :disabled="state.page >= totalPages()"
            class="px-3 py-1.5 rounded-md border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Próxima
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
