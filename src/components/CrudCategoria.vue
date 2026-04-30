<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Categoria = { id: string; descricao: string }

const props = defineProps<{
  listar: () => Promise<Categoria[]>
  criar: (descricao: string) => Promise<Categoria>
  atualizar: (id: string, descricao: string) => Promise<Categoria>
  deletar: (id: string) => Promise<void>
}>()

const itens = ref<Categoria[]>([])
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
    itens.value = await props.listar()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
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
    const novo = await props.criar(novaDescricao.value.trim())
    itens.value.push(novo)
    itens.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    novaDescricao.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar'
  } finally {
    salvandoNovo.value = false
  }
}

function iniciarEdicao(item: Categoria) {
  editandoId.value = item.id
  editDescricao.value = item.descricao
}

function cancelarEdicao() {
  editandoId.value = null
  editDescricao.value = ''
}

async function handleAtualizar(id: string) {
  if (!editDescricao.value.trim()) return
  salvandoEdicao.value = true
  error.value = null
  try {
    const atualizado = await props.atualizar(id, editDescricao.value.trim())
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
  deletandoId.value = id
  error.value = null
  try {
    await props.deletar(id)
    itens.value = itens.value.filter(i => i.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao excluir'
  } finally {
    deletandoId.value = null
  }
}
</script>

<template>
  <div>
    <form @submit.prevent="handleCriar" class="bg-white rounded-xl shadow-sm p-4 mb-4 flex gap-3">
      <input
        v-model="novaDescricao"
        required
        maxlength="60"
        placeholder="Nova descrição..."
        class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        :disabled="salvandoNovo"
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
      >
        {{ salvandoNovo ? 'Adicionando...' : '+ Adicionar' }}
      </button>
    </form>

    <div v-if="error" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{{ error }}</div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando...</div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div v-if="itens.length === 0" class="text-center py-12 text-gray-400 text-sm">
        Nenhum registro cadastrado.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Descrição</th>
            <th class="px-4 py-3 w-40"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in itens" :key="item.id" class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3">
              <input
                v-if="editandoId === item.id"
                v-model="editDescricao"
                maxlength="60"
                class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                @keydown.enter.prevent="handleAtualizar(item.id)"
                @keydown.escape="cancelarEdicao"
              />
              <span v-else class="text-gray-800">{{ item.descricao }}</span>
            </td>
            <td class="px-4 py-3">
              <div v-if="editandoId === item.id" class="flex gap-2 justify-end">
                <button
                  @click="handleAtualizar(item.id)"
                  :disabled="salvandoEdicao"
                  class="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Salvar
                </button>
                <button
                  @click="cancelarEdicao"
                  class="text-xs px-3 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
              <div v-else class="flex gap-2 justify-end">
                <button
                  @click="iniciarEdicao(item)"
                  class="text-xs px-3 py-1 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors"
                >
                  Editar
                </button>
                <button
                  @click="handleDeletar(item.id)"
                  :disabled="deletandoId === item.id"
                  class="text-xs px-3 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {{ deletandoId === item.id ? '...' : 'Excluir' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
