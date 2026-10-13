<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHAVE_CAMERA_SALVA, CameraNfce, MensagemNfce } from '@/api/nfce'

const emit = defineEmits<{ lido: [texto: string]; erro: [mensagem: string] }>()

const video = ref<HTMLVideoElement | null>(null)
const cameras = ref<MediaDeviceInfo[]>([])
const cameraAtual = ref('')
const trocando = ref(false)
const nomeCamera = computed(() => cameras.value.find(c => c.deviceId === cameraAtual.value)?.label ?? '')
let stream: MediaStream | null = null
let quadro = 0
let ativo = true

function lerCameraSalva(): string | null {
  try {
    return localStorage.getItem(CHAVE_CAMERA_SALVA)
  } catch {
    return null
  }
}

function salvarCamera(deviceId: string) {
  try {
    localStorage.setItem(CHAVE_CAMERA_SALVA, deviceId)
  } catch {
    // sem storage: só não lembra a escolha
  }
}

function desligarStream() {
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

function pararCamera() {
  ativo = false
  cancelAnimationFrame(quadro)
  desligarStream()
}

function falhar() {
  pararCamera()
  emit('erro', MensagemNfce.CAMERA_INDISPONIVEL)
}

async function abrirCamera(restricoes: MediaTrackConstraints) {
  // celular costuma abrir só uma câmera por vez: desliga a atual antes de pedir a outra
  desligarStream()
  stream = await navigator.mediaDevices.getUserMedia({ video: restricoes })
  // fechado enquanto o navegador pedia permissão: desliga a câmera que acabou de abrir
  if (!ativo || !video.value) {
    pararCamera()
    return
  }
  cameraAtual.value = stream.getVideoTracks()[0]?.getSettings().deviceId ?? ''
  video.value.srcObject = stream
  await video.value.play()
}

async function abrirCameraInicial() {
  const salva = lerCameraSalva()
  if (salva) {
    try {
      return await abrirCamera({ deviceId: { exact: salva } })
    } catch {
      // câmera salva não existe mais: volta para a traseira padrão
    }
  }
  await abrirCamera({ facingMode: CameraNfce.TRASEIRA })
}

async function trocarCamera() {
  const atual = cameras.value.findIndex(c => c.deviceId === cameraAtual.value)
  const proxima = cameras.value[(atual + 1) % cameras.value.length]
  trocando.value = true
  try {
    await abrirCamera({ deviceId: { exact: proxima.deviceId } })
    salvarCamera(proxima.deviceId)
  } catch {
    falhar()
  } finally {
    trocando.value = false
  }
}

onMounted(async () => {
  try {
    // jsqr só é baixado quando a câmera é aberta
    const [{ default: jsQR }] = await Promise.all([import('jsqr'), abrirCameraInicial()])
    if (!ativo) return

    // os nomes das câmeras só vêm depois da permissão concedida
    const dispositivos = await navigator.mediaDevices.enumerateDevices()
    cameras.value = dispositivos.filter(d => d.kind === 'videoinput')

    const canvas = document.createElement('canvas')
    const contexto = canvas.getContext('2d', { willReadFrequently: true })
    const ler = () => {
      const v = video.value
      if (!ativo || !v || !contexto) return
      if (v.readyState >= v.HAVE_ENOUGH_DATA) {
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        contexto.drawImage(v, 0, 0)
        const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height)
        const qr = jsQR(imagem.data, imagem.width, imagem.height)
        if (qr) {
          pararCamera()
          emit('lido', qr.data)
          return
        }
      }
      quadro = requestAnimationFrame(ler)
    }
    quadro = requestAnimationFrame(ler)
  } catch {
    falhar()
  }
})

onBeforeUnmount(pararCamera)
</script>

<template>
  <div class="relative">
    <video
      ref="video"
      muted
      playsinline
      data-cy="leitor-qr-video"
      class="w-full rounded-lg bg-black"
    />
    <div v-if="cameras.length > 1" class="absolute inset-x-2 bottom-2 flex items-center gap-2">
      <span
        v-if="nomeCamera"
        data-cy="nome-camera"
        class="min-w-0 truncate px-2 py-1 text-xs text-white bg-black/60 rounded-lg"
      >
        {{ nomeCamera }}
      </span>
      <button
        type="button"
        data-cy="btn-trocar-camera"
        :disabled="trocando"
        class="ml-auto shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-black/60 rounded-lg hover:bg-black/75 disabled:opacity-50 transition-colors"
        @click="trocarCamera"
      >
        Trocar câmera
      </button>
    </div>
  </div>
</template>
