import { mount, flushPromises } from '@vue/test-utils'
import LeitorQrCode from '@/components/LeitorQrCode.vue'
import { MensagemNfce } from '@/api/nfce'

jest.mock('jsqr', () => ({ __esModule: true, default: jest.fn(() => null) }))

function mockGetUserMedia(impl: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: jest.fn(impl) },
    configurable: true,
  })
}

describe('LeitorQrCode', () => {
  it('emite erro quando a câmera é negada', async () => {
    mockGetUserMedia(() => Promise.reject(new DOMException('negado', 'NotAllowedError')))
    const wrapper = mount(LeitorQrCode)
    await flushPromises()
    expect(wrapper.emitted('erro')?.[0]).toEqual([MensagemNfce.CAMERA_INDISPONIVEL])
  })

  it('desliga a câmera se o leitor for fechado antes da permissão', async () => {
    const stop = jest.fn()
    let liberar!: (stream: MediaStream) => void
    mockGetUserMedia(() => new Promise(resolve => { liberar = resolve }))

    const wrapper = mount(LeitorQrCode)
    wrapper.unmount()
    liberar({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await flushPromises()

    expect(stop).toHaveBeenCalled()
  })
})
