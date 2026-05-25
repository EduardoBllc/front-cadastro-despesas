<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listarConfiguracoes, atualizarConfiguracao } from '@/api/configuracoes'
import { listarUnidadesMedida } from '@/api/unidades'
import AppCombobox from './AppCombobox.vue'
import type { UnidadeMedida } from '@/types/api'

const unidadesMedida = ref<UnidadeMedida[]>([])

const medidaUnitarioId = ref('')
const valorPadraoUnitario = ref('')
const autopreencheUnitarioQuantidade = ref(false)
const autopreencheUnitarioItem = ref(false)

const loading = ref(false)
const salvando = ref(false)
const error = ref<string | null>(null)
const sucesso = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [configs, unds] = await Promise.all([
      listarConfiguracoes(),
      listarUnidadesMedida(),
    ])
    unidadesMedida.value = unds

    const medidaConf = configs.find(c => c.chave === 'medida_unitario_id')
    const valorConf = configs.find(c => c.chave === 'valor_padrao_unitario')
    const autoQtdConf = configs.find(c => c.chave === 'autopreenche_unitario_quantidade')
    const autoItemConf = configs.find(c => c.chave === 'autopreenche_unitario_item')

    medidaUnitarioId.value = medidaConf?.valor ?? ''
    valorPadraoUnitario.value = valorConf?.valor ?? ''
    autopreencheUnitarioQuantidade.value = String(autoQtdConf?.valor).toLowerCase() === 'true'
    autopreencheUnitarioItem.value = String(autoItemConf?.valor).toLowerCase() === 'true'
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar configurações'
  } finally {
    loading.value = false
  }
})

async function handleSalvar() {
  salvando.value = true
  error.value = null
  sucesso.value = false
  try {
    await Promise.all([
      atualizarConfiguracao('medida_unitario_id', medidaUnitarioId.value || null),
      atualizarConfiguracao('valor_padrao_unitario', valorPadraoUnitario.value || null),
      atualizarConfiguracao('autopreenche_unitario_quantidade', autopreencheUnitarioQuantidade.value ? 'true' : 'false'),
      atualizarConfiguracao('autopreenche_unitario_item', autopreencheUnitarioItem.value ? 'true' : 'false'),
    ])
    sucesso.value = true
    setTimeout(() => { sucesso.value = false }, 3000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao salvar configurações'
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-12 text-gray-400">Carregando...</div>

    <div v-else class="bg-white rounded-xl shadow-sm p-6 space-y-6 max-w-lg">
      <div>
        <p class="text-sm text-gray-500 mb-6">
          Configure a unidade de medida padrão para itens unitários e os comportamentos de
          preenchimento automático no formulário de despesas.
        </p>

        <div class="space-y-5">
          <div>
            <AppCombobox
              v-model="medidaUnitarioId"
              :options="unidadesMedida"
              label="Unidade de Medida para Itens Unitários"
              placeholder="Selecione a unidade..."
            />
            <p class="mt-1 text-xs text-gray-400">
              Unidade que representa "unitário" (ex.: un, pç, unid).
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Valor Padrão para Quantidade Unitária</label>
            <input
              v-model="valorPadraoUnitario"
              type="number"
              min="0.001"
              step="0.001"
              placeholder="Ex: 1"
              class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm transition-colors focus:border-blue-500 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-gray-400">
              Quantidade preenchida automaticamente quando o item usar a unidade unitária acima.
            </p>
          </div>

          <div class="flex items-center justify-between py-2">
            <div>
              <p class="text-sm font-medium text-gray-700">Preencher quantidade automaticamente</p>
              <p class="text-xs text-gray-400 mt-0.5">
                Preenche a quantidade com o valor padrão ao adicionar um item com unidade unitária.
              </p>
            </div>
            <button
              type="button"
              @click="autopreencheUnitarioQuantidade = !autopreencheUnitarioQuantidade"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none',
                autopreencheUnitarioQuantidade ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  autopreencheUnitarioQuantidade ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
          </div>

          <div class="flex items-center justify-between py-2">
            <div>
              <p class="text-sm font-medium text-gray-700">Preencher unidade ao criar item</p>
              <p class="text-xs text-gray-400 mt-0.5">
                Pré-seleciona a unidade unitária ao abrir o modal de criação de novo item.
              </p>
            </div>
            <button
              type="button"
              @click="autopreencheUnitarioItem = !autopreencheUnitarioItem"
              :class="[
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none',
                autopreencheUnitarioItem ? 'bg-blue-600' : 'bg-gray-200'
              ]"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  autopreencheUnitarioItem ? 'translate-x-6' : 'translate-x-1'
                ]"
              />
            </button>
          </div>
        </div>
      </div>

      <div v-if="error" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{{ error }}</div>
      <div v-if="sucesso" class="bg-green-50 text-green-700 p-3 rounded-lg text-sm">
        Configurações salvas com sucesso.
      </div>

      <div class="flex justify-end">
        <button
          @click="handleSalvar"
          :disabled="salvando"
          class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {{ salvando ? 'Salvando...' : 'Salvar' }}
        </button>
      </div>
    </div>
  </div>
</template>
