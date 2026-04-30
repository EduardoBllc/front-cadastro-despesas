<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { obterDespesa } from '@/api/despesas'
import { formatDate, formatCurrency } from '@/utils/format'
import type { DespesaDetalhe } from '@/types/api'

const props = defineProps<{
  despesaId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const despesa = ref<DespesaDetalhe | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    despesa.value = await obterDespesa(props.despesaId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Erro ao carregar detalhes da despesa'
  } finally {
    loading.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-xl font-bold text-gray-800">Detalhes da Despesa</h3>
          <button 
            @click="emit('close')"
            class="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span class="text-2xl">&times;</span>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="loading" class="py-12 text-center text-gray-400">
            Carregando detalhes...
          </div>
          
          <div v-else-if="error" class="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
            {{ error }}
          </div>

          <div v-else-if="despesa" class="space-y-6">
            <!-- Info Geral -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">Data</p>
                <p class="text-gray-800">{{ formatDate(despesa.data_despesa) }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">Estabelecimento</p>
                <p class="text-gray-800">{{ despesa.estabelecimento?.descricao || '—' }}</p>
              </div>
              <div>
                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">Valor Total</p>
                <p class="text-lg font-bold text-blue-600">{{ formatCurrency(despesa.valor_total) }}</p>
              </div>
              <div v-if="despesa.observacao">
                <p class="text-xs font-medium text-gray-400 uppercase tracking-wider">Observação</p>
                <p class="text-gray-600 text-sm">{{ despesa.observacao }}</p>
              </div>
            </div>

            <!-- Abastecimento (se houver) -->
            <div v-if="despesa.abastecimento" class="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <h4 class="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <span>⛽</span> Dados do Abastecimento
              </h4>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-2">
                <div>
                  <p class="text-[10px] font-medium text-blue-400 uppercase">Litros</p>
                  <p class="text-blue-900 font-medium">{{ despesa.abastecimento.litros }}L</p>
                </div>
                <div>
                  <p class="text-[10px] font-medium text-blue-400 uppercase">Preço/L</p>
                  <p class="text-blue-900 font-medium">{{ formatCurrency(despesa.abastecimento.valor_por_litro) }}</p>
                </div>
                <div>
                  <p class="text-[10px] font-medium text-blue-400 uppercase">KM Atual</p>
                  <p class="text-blue-900 font-medium">{{ despesa.abastecimento.quilometragem }} km</p>
                </div>
                <div v-if="despesa.abastecimento.km_rodados">
                  <p class="text-[10px] font-medium text-blue-400 uppercase">KM Rodados</p>
                  <p class="text-blue-900 font-medium">{{ despesa.abastecimento.km_rodados }} km</p>
                </div>
                <div v-if="despesa.abastecimento.km_por_litro">
                  <p class="text-[10px] font-medium text-blue-400 uppercase">Consumo</p>
                  <p class="text-blue-900 font-bold">{{ despesa.abastecimento.km_por_litro }} km/L</p>
                </div>
              </div>
            </div>

            <!-- Itens -->
            <div v-if="despesa.itens.length > 0">
              <h4 class="text-sm font-bold text-gray-800 mb-3">Itens da Despesa</h4>
              <div class="border border-gray-100 rounded-xl overflow-hidden">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-left px-4 py-2 text-gray-500 font-medium">Item</th>
                      <th class="text-center px-4 py-2 text-gray-500 font-medium">Qtd</th>
                      <th class="text-right px-4 py-2 text-gray-500 font-medium">Unit.</th>
                      <th class="text-right px-4 py-2 text-gray-500 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-50">
                    <tr v-for="item in despesa.itens" :key="item.id">
                      <td class="px-4 py-2 text-gray-700">
                        {{ item.item?.descricao || 'Item desconhecido' }}
                        <span v-if="item.item?.unidade_medida" class="text-[10px] text-gray-400 ml-1">
                          ({{ item.item.unidade_medida.descricao }})
                        </span>
                      </td>
                      <td class="px-4 py-2 text-center text-gray-600">{{ item.quantidade }}</td>
                      <td class="px-4 py-2 text-right text-gray-600">{{ formatCurrency(item.valor_unitario) }}</td>
                      <td class="px-4 py-2 text-right font-medium text-gray-800">{{ formatCurrency(item.valor_total) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-100 bg-gray-50 text-right">
          <button 
            @click="emit('close')"
            class="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
