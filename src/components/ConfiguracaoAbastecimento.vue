<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listarConfiguracoes, atualizarConfiguracao } from '@/api/configuracoes'
import { listarCategoriasDespesa } from '@/api/categorias'
import { listarTiposEstabelecimento } from '@/api/estabelecimentos'
import AppCombobox from './AppCombobox.vue'
import type { CategoriaDespesa, TipoEstabelecimento } from '@/types/api'

const categoriasDespesa = ref<CategoriaDespesa[]>([])
const tiposEstabelecimento = ref<TipoEstabelecimento[]>([])

const categoriaAbastecimentoId = ref('')
const tipoEstabelecimentoPostoId = ref('')

const loading = ref(false)
const salvando = ref(false)
const error = ref<string | null>(null)
const sucesso = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [configs, cats, tipos] = await Promise.all([
      listarConfiguracoes(),
      listarCategoriasDespesa(),
      listarTiposEstabelecimento(),
    ])
    categoriasDespesa.value = cats
    tiposEstabelecimento.value = tipos

    const catConf = configs.find(c => c.chave === 'categoria_abastecimento_id')
    const tipoConf = configs.find(c => c.chave === 'tipo_estabelecimento_posto_id')
    categoriaAbastecimentoId.value = catConf?.valor ?? ''
    tipoEstabelecimentoPostoId.value = tipoConf?.valor ?? ''
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
      atualizarConfiguracao('categoria_abastecimento_id', categoriaAbastecimentoId.value || null),
      atualizarConfiguracao('tipo_estabelecimento_posto_id', tipoEstabelecimentoPostoId.value || null),
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
          Defina quais cadastros são usados automaticamente ao registrar um abastecimento.
          Sem essas configurações o toggle de abastecimento não fica disponível no formulário de despesas.
        </p>

        <div class="space-y-5">
          <div>
            <AppCombobox
              v-model="categoriaAbastecimentoId"
              :options="categoriasDespesa"
              label="Categoria de Despesa para Abastecimento"
              placeholder="Selecione a categoria..."
            />
            <p class="mt-1 text-xs text-gray-400">
              Preenchida automaticamente ao marcar a despesa como abastecimento.
            </p>
          </div>

          <div>
            <AppCombobox
              v-model="tipoEstabelecimentoPostoId"
              :options="tiposEstabelecimento"
              label="Tipo de Estabelecimento para Posto de Combustível"
              placeholder="Selecione o tipo..."
            />
            <p class="mt-1 text-xs text-gray-400">
              Apenas estabelecimentos desse tipo aparecerão ao cadastrar um abastecimento.
            </p>
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
