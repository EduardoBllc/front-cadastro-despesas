<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { 
  listarEstabelecimentos, 
  criarEstabelecimento, 
  atualizarEstabelecimento,
  excluirEstabelecimento,
  listarTiposEstabelecimento,
  criarTipoEstabelecimento
} from '@/api/estabelecimentos'
import AppCombobox from './AppCombobox.vue'
import type { Estabelecimento, TipoEstabelecimento } from '@/types/api'

const itens = ref<Estabelecimento[]>([])
const tipos = ref<TipoEstabelecimento[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const novoForm = reactive({ descricao: '', tipo_id: '' })
const salvandoNovo = ref(false)

async function handleCriarTipo(descricao: string, formObj: { tipo_id: string }) {
  try {
    const novoTipo = await criarTipoEstabelecimento(descricao)
    tipos.value.push(novoTipo)
    tipos.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    formObj.tipo_id = novoTipo.id
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar tipo'
  }
}

const editandoId = ref<string | null>(null)
const editForm = reactive({ descricao: '', tipo_id: '' })
const salvandoEdicao = ref(false)
const deletandoId = ref<string | null>(null)

async function carregar() {
  loading.value = true
  error.value = null
  try {
    const [resEst, resTipos] = await Promise.all([
      listarEstabelecimentos(),
      listarTiposEstabelecimento()
    ])
    itens.value = resEst
    tipos.value = resTipos
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar dados'
  } finally {
    loading.value = false
  }
}

onMounted(carregar)

async function handleCriar() {
  if (!novoForm.descricao.trim() || !novoForm.tipo_id) return
  salvandoNovo.value = true
  error.value = null
  try {
    const novo = await criarEstabelecimento({
      descricao: novoForm.descricao.trim(),
      tipo_id: novoForm.tipo_id
    })
    itens.value.push(novo)
    itens.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    novoForm.descricao = ''
    novoForm.tipo_id = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar'
  } finally {
    salvandoNovo.value = false
  }
}

function iniciarEdicao(item: Estabelecimento) {
  editandoId.value = item.id
  editForm.descricao = item.descricao
  editForm.tipo_id = item.tipo_id
}

function cancelarEdicao() {
  editandoId.value = null
}

async function handleAtualizar(id: string) {
  if (!editForm.descricao.trim() || !editForm.tipo_id) return
  salvandoEdicao.value = true
  error.value = null
  try {
    const atualizado = await atualizarEstabelecimento(id, {
      descricao: editForm.descricao.trim(),
      tipo_id: editForm.tipo_id
    })
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
  if (!confirm('Deseja realmente excluir este estabelecimento?')) return
  deletandoId.value = id
  error.value = null
  try {
    await excluirEstabelecimento(id)
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
    <form @submit.prevent="handleCriar" class="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-medium text-gray-500 mb-1 uppercase">Nome / Descrição</label>
        <input
          v-model="novoForm.descricao"
          required
          maxlength="100"
          placeholder="Ex: Supermercado X"
          class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>
      <div class="w-64">
        <AppCombobox
          v-model="novoForm.tipo_id"
          :options="tipos"
          label="Tipo"
          required
          placeholder="Selecione o tipo..."
          @create="(desc) => handleCriarTipo(desc, novoForm)"
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

    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando estabelecimentos...</div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div v-if="itens.length === 0" class="text-center py-12 text-gray-400 text-sm">
        Nenhum estabelecimento cadastrado.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
            <th class="px-4 py-3 w-44"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in itens" :key="item.id" class="hover:bg-gray-50 transition-colors">
            <template v-if="editandoId === item.id">
              <td class="px-4 py-3">
                <input
                  v-model="editForm.descricao"
                  maxlength="100"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  @keydown.escape="cancelarEdicao"
                />
              </td>
              <td class="px-4 py-3">
                <AppCombobox
                  v-model="editForm.tipo_id"
                  :options="tipos"
                  required
                  placeholder="Tipo..."
                  @create="(desc) => handleCriarTipo(desc, editForm)"
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2 justify-end">
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
              </td>
            </template>
            <template v-else>
              <td class="px-4 py-3 text-gray-800 font-medium">{{ item.descricao }}</td>
              <td class="px-4 py-3">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {{ item.tipo?.descricao || '—' }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2 justify-end">
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
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
