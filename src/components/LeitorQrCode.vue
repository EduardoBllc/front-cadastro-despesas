<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MensagemNfce } from '@/api/nfce'

const emit = defineEmits<{ lido: [texto: string]; erro: [mensagem: string] }>()

const video = ref<HTMLVideoElement | null>(null)
let stream: MediaStream | null = null
let quadro = 0
let ativo = true

function pararCamera() {
  ativo = false
  cancelAnimationFrame(quadro)
  stream?.getTracks().forEach(track => track.stop())
  stream = null
}

onMounted(async () => {
  try {
    // jsqr só é baixado quando a webcam é aberta
    const [{ default: jsQR }, midia] = await Promise.all([
      import('jsqr'),
      navigator.mediaDevices.getUserMedia({ video: true }),
    ])
    stream = midia
    // fechado enquanto o navegador pedia permissão: desliga a câmera que acabou de abrir
    if (!ativo || !video.value) {
      pararCamera()
      return
    }
    video.value.srcObject = midia
    await video.value.play()

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
    pararCamera()
    emit('erro', MensagemNfce.CAMERA_INDISPONIVEL)
  }
})

onBeforeUnmount(pararCamera)
</script>

<template>
  <video
    ref="video"
    muted
    playsinline
    data-cy="leitor-qr-video"
    class="w-full rounded-lg bg-black"
  />
</template>
