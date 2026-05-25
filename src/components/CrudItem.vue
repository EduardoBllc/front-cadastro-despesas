<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { listarItens, criarItem, atualizarItem, deletarItem } from '@/api/itens'
import ActionButton from './ActionButton.vue'
import { listarCategoriasItem } from '@/api/categorias'
import { listarUnidadesMedida, criarUnidadeMedida } from '@/api/unidades'
import type { Item, CategoriaItem, UnidadeMedida } from '@/types/api'
import AppCombobox from './AppCombobox.vue'

const itens = ref<Item[]>([])
const categoriasItem = ref<CategoriaItem[]>([])
const unidadesMedida = ref<UnidadeMedida[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const novoItem = reactive({
  descricao: '',
  categoria_item_id: '',
  unidade_medida_id: '',
})
const salvandoNovo = ref(false)

const editandoId = ref<string | null>(null)
const editItem = reactive({
  descricao: '',
  categoria_item_id: '',
  unidade_medida_id: '',
})
const salvandoEdicao = ref(false)

const deletandoId = ref<string | null>(null)

async function carregar() {
  loading.value = true
  error.value = null
  try {
    const [lista, cats, unds] = await Promise.all([
      listarItens(),
      listarCategoriasItem(),
      listarUnidadesMedida()
    ])
    itens.value = lista
    categoriasItem.value = cats
    unidadesMedida.value = unds
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar'
  } finally {
    loading.value = false
  }
}

onMounted(carregar)

function nomeCategoria(id: string): string {
  return categoriasItem.value.find(c => c.id === id)?.descricao ?? '—'
}

function descUnidade(id: string | null): string {
  if (!id) return '—'
  return unidadesMedida.value.find(u => u.id === id)?.descricao ?? '—'
}

async function handleCriarUnidade(descricao: string, target: 'novo' | 'edit') {
  try {
    const nova = await criarUnidadeMedida(descricao)
    unidadesMedida.value.push(nova)
    unidadesMedida.value.sort((a, b) => a.descricao.localeCompare(b.descricao))
    if (target === 'novo') {
      novoItem.unidade_medida_id = nova.id
    } else {
      editItem.unidade_medida_id = nova.id
    }
  } catch (e) {
    error.value = 'Erro ao criar unidade de medida'
  }
}

async function handleCriar() {
  if (!novoItem.descricao.trim() || !novoItem.categoria_item_id) return
  salvandoNovo.value = true
  error.value = null
  try {
    const criado = await criarItem({
      descricao: novoItem.descricao.trim(),
      categoria_item_id: novoItem.categoria_item_id,
      unidade_medida_id: novoItem.unidade_medida_id || null,
    })
    itens.value.push(criado)
    itens.value.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
    novoItem.descricao = ''
    novoItem.categoria_item_id = ''
    novoItem.unidade_medida_id = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao criar'
  } finally {
    salvandoNovo.value = false
  }
}

function iniciarEdicao(item: Item) {
  editandoId.value = item.id
  editItem.descricao = item.descricao
  editItem.categoria_item_id = item.categoria_item_id
  editItem.unidade_medida_id = item.unidade_medida_id ?? ''
}

function cancelarEdicao() {
  editandoId.value = null
}

async function handleAtualizar(id: string) {
  if (!editItem.descricao.trim() || !editItem.categoria_item_id) return
  salvandoEdicao.value = true
  error.value = null
  try {
    const atualizado = await atualizarItem(id, {
      descricao: editItem.descricao.trim(),
      categoria_item_id: editItem.categoria_item_id,
      unidade_medida_id: editItem.unidade_medida_id || null,
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

async function handleToggleAtivo(item: Item) {
  try {
    const atualizado = await atualizarItem(item.id, { ativo: !item.ativo })
    const idx = itens.value.findIndex(i => i.id === item.id)
    if (idx !== -1) itens.value[idx] = atualizado
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao atualizar'
  }
}

async function handleDeletar(id: string) {
  deletandoId.value = id
  error.value = null
  try {
    await deletarItem(id)
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
    <!-- Formulário de criação -->
    <form @submit.prevent="handleCriar" class="bg-white rounded-xl shadow-sm p-4 mb-4 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <input
          v-model="novoItem.descricao"
          required
          maxlength="120"
          placeholder="Descrição *"
          class="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 sm:col-span-2"
        />
        <AppCombobox
          v-model="novoItem.categoria_item_id"
          :options="categoriasItem"
          placeholder="Categoria *"
          required
        />
        <AppCombobox
          v-model="novoItem.unidade_medida_id"
          :options="unidadesMedida"
          placeholder="Und. (ex: kg, L)"
          @create="(desc) => handleCriarUnidade(desc, 'novo')"
        />
      </div>
      <div class="flex justify-end">
        <button
          type="submit"
          :disabled="salvandoNovo || !novoItem.descricao || !novoItem.categoria_item_id"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {{ salvandoNovo ? 'Adicionando...' : '+ Adicionar' }}
        </button>
      </div>
    </form>

    <div v-if="error" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">{{ error }}</div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando...</div>

    <div v-else class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div v-if="itens.length === 0" class="text-center py-12 text-gray-400 text-sm">
        Nenhum item cadastrado.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Descrição</th>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Categoria</th>
            <th class="text-left px-4 py-3 text-gray-600 font-medium">Und.</th>
            <th class="text-right px-4 py-3 text-gray-600 font-medium">Ref. (R$)</th>
            <th class="text-center px-4 py-3 text-gray-600 font-medium">Ativo</th>
            <th class="px-4 py-3 w-40"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="item in itens" :key="item.id" class="hover:bg-gray-50 transition-colors">
            <template v-if="editandoId === item.id">
              <td class="px-4 py-3">
                <input
                  v-model="editItem.descricao"
                  maxlength="120"
                  required
                  class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  @keydown.escape="cancelarEdicao"
                />
              </td>
              <td class="px-4 py-3">
                <AppCombobox
                  v-model="editItem.categoria_item_id"
                  :options="categoriasItem"
                  placeholder="Categoria"
                  required
                />
              </td>
              <td class="px-4 py-3">
                <AppCombobox
                  v-model="editItem.unidade_medida_id"
                  :options="unidadesMedida"
                  placeholder="Und."
                  @create="(desc) => handleCriarUnidade(desc, 'edit')"
                />
              </td>
              <td class="px-4 py-3 text-right text-gray-400 text-xs italic">auto</td>
              <td class="px-4 py-3"></td>
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
              <td class="px-4 py-3 text-gray-800">{{ item.descricao }}</td>
              <td class="px-4 py-3 text-gray-500">{{ nomeCategoria(item.categoria_item_id) }}</td>
              <td class="px-4 py-3 text-gray-500">{{ descUnidade(item.unidade_medida_id) }}</td>
              <td class="px-4 py-3 text-right text-gray-700">
                {{ item.valor_referencia ? `R$ ${parseFloat(item.valor_referencia).toFixed(2)}` : '—' }}
              </td>
              <td class="px-4 py-3 text-center">
                <button
                  type="button"
                  @click="handleToggleAtivo(item)"
                  :class="[
                    'px-2 py-0.5 rounded-full text-xs font-medium transition-colors',
                    item.ativo
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  ]"
                >
                  {{ item.ativo ? 'Ativo' : 'Inativo' }}
                </button>
              </td>
              <td class="px-4 py-3">
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
