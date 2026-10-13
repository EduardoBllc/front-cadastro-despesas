<script setup lang="ts">
import { ref } from 'vue'
import { importarNfce, MensagemNfce } from '@/api/nfce'
import type { RascunhoNfce } from '@/types/api'
import LeitorQrCode from './LeitorQrCode.vue'

const emit = defineEmits<{ importado: [rascunho: RascunhoNfce]; fechar: [] }>()

const url = ref('')
const erro = ref<string | null>(null)
const carregando = ref(false)
const lendoWebcam = ref(false)

async function importar() {
  const link = url.value.trim()
  if (!link) return
  carregando.value = true
  erro.value = null
  try {
    emit('importado', await importarNfce(link))
  } catch (e) {
    erro.value = e instanceof Error ? e.message : MensagemNfce.ERRO_IMPORTACAO
  } finally {
    carregando.value = false
  }
}

function onLido(texto: string) {
  lendoWebcam.value = false
  url.value = texto
  importar()
}

function onErroCamera(mensagem: string) {
  lendoWebcam.value = false
  erro.value = mensagem
}
</script>

<template>
  <!-- items-start + my-auto: centraliza, mas rola a partir do topo quando a câmera deixa a modal mais alta que a tela -->
  <div class="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 bg-black/50 backdrop-blur-sm">
    <form
      data-cy="form-importar-nfce"
      class="my-auto bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 border border-gray-100"
      @submit.prevent="importar"
    >
      <h4 class="text-lg font-bold text-gray-800">Importar NFC-e</h4>

      <LeitorQrCode v-if="lendoWebcam" @lido="onLido" @erro="onErroCamera" />

      <div>
        <label for="nfce-url" class="block text-sm font-medium text-gray-600 mb-1">Link do QR Code</label>
        <input
          id="nfce-url"
          v-model="url"
          data-cy="input-nfce-url"
          type="text"
          inputmode="url"
          placeholder="https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p=..."
          class="block w-full rounded-lg border-gray-300 bg-gray-50/30 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
      </div>

      <p v-if="erro" data-cy="nfce-erro" class="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{{ erro }}</p>

      <div class="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          data-cy="btn-ler-webcam"
          class="w-full sm:w-auto px-4 py-2 text-sm font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
          @click="lendoWebcam = !lendoWebcam"
        >
          {{ lendoWebcam ? 'Parar câmera' : 'Ler pela câmera' }}
        </button>
        <button
          type="button"
          data-cy="btn-cancelar-nfce"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          @click="emit('fechar')"
        >
          Cancelar
        </button>
        <button
          type="submit"
          data-cy="btn-importar-nfce"
          :disabled="!url.trim() || carregando"
          class="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {{ carregando ? 'Importando...' : 'Importar' }}
        </button>
      </div>
    </form>
  </div>
</template>
