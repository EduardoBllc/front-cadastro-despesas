import { mount, flushPromises } from '@vue/test-utils'
import LeitorQrCode from '@/components/LeitorQrCode.vue'
import { CHAVE_CAMERA_SALVA, CameraNfce, MensagemNfce } from '@/api/nfce'

jest.mock('jsqr', () => ({ __esModule: true, default: jest.fn(() => null) }))

const GRANDE_ANGULAR = { kind: 'videoinput', deviceId: 'traseira-grande-angular', label: 'camera2 2, facing back' }
const PRINCIPAL = { kind: 'videoinput', deviceId: 'traseira-principal', label: 'camera2 0, facing back' }
const CAMERA_INEXISTENTE = 'camera-removida'

type CameraFalsa = typeof PRINCIPAL

function streamFalso(deviceId: string, stop: jest.Mock = jest.fn()) {
  return {
    getTracks: () => [{ stop }],
    getVideoTracks: () => [{ getSettings: () => ({ deviceId }) }],
  } as unknown as MediaStream
}

function mockMediaDevices(getUserMedia: jest.Mock, cameras: CameraFalsa[] = []) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia, enumerateDevices: jest.fn(async () => cameras) },
    configurable: true,
  })
}

// Simula o navegador: sem deviceId exato, abre a primeira câmera da lista
function mockCameras(cameras: CameraFalsa[]) {
  const stops = new Map(cameras.map(c => [c.deviceId, jest.fn()]))
  const getUserMedia = jest.fn(async ({ video }: { video: MediaTrackConstraints }) => {
    const pedida = (video.deviceId as ConstrainDOMStringParameters | undefined)?.exact
    const camera = pedida ? cameras.find(c => c.deviceId === pedida) : cameras[0]
    if (!camera) throw new DOMException('câmera não encontrada', 'OverconstrainedError')
    return streamFalso(camera.deviceId, stops.get(camera.deviceId))
  })
  mockMediaDevices(getUserMedia, cameras)
  return { getUserMedia, stops }
}

describe('LeitorQrCode', () => {
  beforeEach(() => localStorage.clear())

  it('emite erro quando a câmera é negada', async () => {
    mockMediaDevices(jest.fn(() => Promise.reject(new DOMException('negado', 'NotAllowedError'))))
    const wrapper = mount(LeitorQrCode)
    await flushPromises()
    expect(wrapper.emitted('erro')?.[0]).toEqual([MensagemNfce.CAMERA_INDISPONIVEL])
  })

  it('desliga a câmera se o leitor for fechado antes da permissão', async () => {
    const stop = jest.fn()
    let liberar!: (stream: MediaStream) => void
    mockMediaDevices(jest.fn(() => new Promise(resolve => { liberar = resolve })))

    const wrapper = mount(LeitorQrCode)
    wrapper.unmount()
    liberar(streamFalso(PRINCIPAL.deviceId, stop))
    await flushPromises()

    expect(stop).toHaveBeenCalled()
  })

  it('abre a traseira padrão, troca para a próxima câmera e lembra a escolha', async () => {
    const { getUserMedia, stops } = mockCameras([GRANDE_ANGULAR, PRINCIPAL])
    const wrapper = mount(LeitorQrCode)
    await flushPromises()

    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: CameraNfce.TRASEIRA } })
    expect(wrapper.find('[data-cy=nome-camera]').text()).toBe(GRANDE_ANGULAR.label)

    await wrapper.find('[data-cy=btn-trocar-camera]').trigger('click')
    await flushPromises()

    expect(stops.get(GRANDE_ANGULAR.deviceId)).toHaveBeenCalled()
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { deviceId: { exact: PRINCIPAL.deviceId } } })
    expect(wrapper.find('[data-cy=nome-camera]').text()).toBe(PRINCIPAL.label)
    expect(localStorage.getItem(CHAVE_CAMERA_SALVA)).toBe(PRINCIPAL.deviceId)
    wrapper.unmount()
  })

  it('reabre a câmera escolhida da última vez', async () => {
    localStorage.setItem(CHAVE_CAMERA_SALVA, PRINCIPAL.deviceId)
    const { getUserMedia } = mockCameras([GRANDE_ANGULAR, PRINCIPAL])
    const wrapper = mount(LeitorQrCode)
    await flushPromises()

    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(getUserMedia).toHaveBeenCalledWith({ video: { deviceId: { exact: PRINCIPAL.deviceId } } })
    wrapper.unmount()
  })

  it('volta para a traseira padrão se a câmera salva não existe mais', async () => {
    localStorage.setItem(CHAVE_CAMERA_SALVA, CAMERA_INEXISTENTE)
    const { getUserMedia } = mockCameras([GRANDE_ANGULAR, PRINCIPAL])
    const wrapper = mount(LeitorQrCode)
    await flushPromises()

    expect(getUserMedia).toHaveBeenLastCalledWith({ video: { facingMode: CameraNfce.TRASEIRA } })
    expect(wrapper.emitted('erro')).toBeUndefined()
    wrapper.unmount()
  })

  it('esconde a troca quando há só uma câmera', async () => {
    mockCameras([PRINCIPAL])
    const wrapper = mount(LeitorQrCode)
    await flushPromises()

    expect(wrapper.find('[data-cy=btn-trocar-camera]').exists()).toBe(false)
    wrapper.unmount()
  })
})
