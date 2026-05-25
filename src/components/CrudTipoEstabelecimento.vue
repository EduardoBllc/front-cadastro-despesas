<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { 
  listarTiposEstabelecimento, 
  criarTipoEstabelecimento, 
  atualizarTipoEstabelecimento, 
  excluirTipoEstabelecimento 
} from '@/api/estabelecimentos'
import type { TipoEstabelecimento } from '@/types/api'
import ActionButton from './ActionButton.vue'

const itens = ref<TipoEstabelecimento[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const novaDescricao = ref('')
const salvandoNovo = ref(false)

const editandoId = ref<string | null>(null)
const editDescricao = ref('')
const salvandoEdicao = ref(false)
const deletandoId = ref<string | null>(null)

async function carregar() {
  loading.value = true
  error.value = null
  try {
    itens.value = await listarTiposEstabelecimento()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar tipos'
  } finally {
    loading.value = false
  }
}

onMounted(carregar)

async function handleCriar() {
  if (!novaDescricao.value.trim()) return
  salvandoNovo.value = true
  error.value = null
  try {
    const novo = await criarTipoEstabelecimento(novaDescricao.value.trim())
    itens.value.push(novo)
    itens.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    novaDescricao.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar'
  } finally {
    salvandoNovo.value = false
  }
}

function iniciarEdicao(item: TipoEstabelecimento) {
  editandoId.value = item.id
  editDescricao.value = item.descricao
}

function cancelarEdicao() {
  editandoId.value = null
}

async function handleAtualizar(id: string) {
  if (!editDescricao.value.trim()) return
  salvandoEdicao.value = true
  error.value = null
  try {
    const atualizado = await atualizarTipoEstabelecimento(id, editDescricao.value.trim())
    const idx = itens.value.findIndex(i => i.id === id)
    if (idx !== -1) itens.value[idx] = atualizado
    itens.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    editandoId.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao atualizar'
  } finally {
    salvandoEdicao.value = false
  }
}

async function handleDeletar(id: string) {
  if (!confirm('Deseja realmente excluir este tipo de estabelecimento?')) return
  deletandoId.value = id
  error.value = null
  try {
    await excluirTipoEstabelecimento(id)
    itens.value = itens.value.filter(i => i.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao excluir (verifique se existem estabelecimentos vinculados)'
  } finally {
    deletandoId.value = null
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleCriar" class="bg-white rounded-xl shadow-sm p-4 mb-4 flex gap-3 items-end">
      <div class="flex-1">
        <label class="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Novo Tipo de Estabelecimento</label>
        <input
          v-model="novaDescricao"
          required
          maxlength="60"
          placeholder="Ex: Supermercado, Farmácia, Posto..."
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm h-[42px]"
        />
      </div>
      <button
        type="submit"
        :disabled="salvandoNovo"
        class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors h-[42px]"
      >
        {{ salvandoNovo ? '...' : '+ Adicionar' }}
      </button>
    </form>

    <div v-if="error" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{{ error }}</div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando tipos...</div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
      <div v-if="itens.length === 0" class="text-center py-12 text-gray-400 text-sm">
        Nenhum tipo de estabelecimento cadastrado.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50/50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-[10px]">Descrição</th>
            <th class="px-4 py-3 w-44"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in itens" :key="item.id" class="hover:bg-gray-50/50 transition-colors">
            <template v-if="editandoId === item.id">
              <td class="px-4 py-3">
                <input
                  v-model="editDescricao"
                  maxlength="60"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  @keydown.enter="handleAtualizar(item.id)"
                  @keydown.escape="cancelarEdicao"
                  auto-focus
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2 justify-end">
                  <button
                    @click="handleAtualizar(item.id)"
                    :disabled="salvandoEdicao"
                    class="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                  >
                    Salvar
                  </button>
                  <button
                    @click="cancelarEdicao"
                    class="text-xs px-3 py-1 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </td>
            </template>
            <template v-else>
              <td class="px-4 py-3 text-gray-800 font-medium">{{ item.descricao }}</td>
              <td class="px-4 py-3">
                <div class="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <!-- Adicionado hover no tr para mostrar botões (opcional, removi para manter padrão) -->
                </div>
                <div class="flex gap-2 justify-end">
                  <ActionButton variant="editar" @click="iniciarEdicao(item)" />
                  <ActionButton
                    variant="excluir"
                    :loading="deletandoId === item.id"
                    :disabled="deletandoId === item.id"
                    @click="handleDeletar(item.id)"
                  />
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
