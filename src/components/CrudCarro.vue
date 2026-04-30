<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { listarCarros, criarCarro, atualizarCarro, deletarCarro } from '@/api/carros'
import type { Carro } from '@/types/api'

const itens = ref<Carro[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const novoForm = reactive({ nome: '', placa: '' })
const salvandoNovo = ref(false)

type EditForm = { nome: string; placa: string; ativo: boolean }
const editandoId = ref<string | null>(null)
const editForm = reactive<EditForm>({ nome: '', placa: '', ativo: true })
const salvandoEdicao = ref(false)

const deletandoId = ref<string | null>(null)

async function carregar() {
  loading.value = true
  error.value = null
  try {
    itens.value = await listarCarros()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
}

onMounted(carregar)

async function handleCriar() {
  if (!novoForm.nome.trim()) return
  salvandoNovo.value = true
  error.value = null
  try {
    const payload = {
      nome: novoForm.nome.trim(),
      ...(novoForm.placa.trim() ? { placa: novoForm.placa.trim() } : {}),
    }
    const novo = await criarCarro(payload)
    itens.value.push(novo)
    itens.value.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    novoForm.nome = ''
    novoForm.placa = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar'
  } finally {
    salvandoNovo.value = false
  }
}

function iniciarEdicao(item: Carro) {
  editandoId.value = item.id
  editForm.nome = item.nome
  editForm.placa = item.placa ?? ''
  editForm.ativo = item.ativo
}

function cancelarEdicao() {
  editandoId.value = null
}

async function handleAtualizar(id: string) {
  if (!editForm.nome.trim()) return
  salvandoEdicao.value = true
  error.value = null
  try {
    const atualizado = await atualizarCarro(id, {
      nome: editForm.nome.trim(),
      placa: editForm.placa.trim() || null,
      ativo: editForm.ativo,
    })
    const idx = itens.value.findIndex(i => i.id === id)
    if (idx !== -1) itens.value[idx] = atualizado
    itens.value.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
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
    await deletarCarro(id)
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
    <form @submit.prevent="handleCriar" class="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3">
      <input
        v-model="novoForm.nome"
        required
        maxlength="60"
        placeholder="Nome do carro *"
        class="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <input
        v-model="novoForm.placa"
        maxlength="8"
        placeholder="Placa (opcional)"
        class="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        Nenhum carro cadastrado.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
            <th class="text-left px-4 py-3 text-gray-600 font-medium w-32">Placa</th>
            <th class="text-center px-4 py-3 text-gray-600 font-medium w-20">Ativo</th>
            <th class="px-4 py-3 w-44"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in itens" :key="item.id" class="hover:bg-gray-50 transition-colors">
            <template v-if="editandoId === item.id">
              <td class="px-4 py-3">
                <input
                  v-model="editForm.nome"
                  maxlength="60"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  @keydown.escape="cancelarEdicao"
                />
              </td>
              <td class="px-4 py-3">
                <input
                  v-model="editForm.placa"
                  maxlength="8"
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  @keydown.escape="cancelarEdicao"
                />
              </td>
              <td class="px-4 py-3 text-center">
                <input type="checkbox" v-model="editForm.ativo" class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
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
              <td class="px-4 py-3 text-gray-800 font-medium">{{ item.nome }}</td>
              <td class="px-4 py-3 text-gray-500">{{ item.placa ?? '—' }}</td>
              <td class="px-4 py-3 text-center">
                <span
                  :class="item.ativo
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'"
                  class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                >
                  {{ item.ativo ? 'Sim' : 'Não' }}
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
