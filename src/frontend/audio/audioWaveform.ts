import { encodeFilePath } from "../components/helpers/media"

type WaveformSettings = {
    height?: number // 1 = 100%
    samples?: number
}

const cachedWaveformData: Map<string, Float32Array> = new Map()
export async function createWaveform(container: HTMLElement, path: string, settings: WaveformSettings = {}) {
    const audioCtx = new AudioContext()

    if (cachedWaveformData.has(path)) {
        renderWaveform(container, cachedWaveformData.get(path)!, settings)
        return
    }

    const response = await fetch(encodeFilePath(path))
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    const rawData = audioBuffer.getChannelData(0)
    cachedWaveformData.set(path, rawData)

    renderWaveform(container, rawData, settings)
}

export const WAVEFORM_SAMPLES = 150
function renderWaveform(container: HTMLElement, rawData: Float32Array, settings: WaveformSettings = {}) {
    const samples = settings.samples || WAVEFORM_SAMPLES
    const blockSize = Math.floor(rawData.length / samples)
    const waveform = new Float32Array(samples)

    for (let i = 0; i < samples; i++) {
        const blockStart = i * blockSize
        let sum = 0
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[blockStart + j])
        }
        waveform[i] = sum / blockSize
    }

    container.innerHTML = ""

    // create bars with a small initial height (for animation)
    const bars: HTMLDivElement[] = []
    for (let i = 0; i < samples; i++) {
        const bar = document.createElement("div")
        bar.classList.add("wave-bar")
        bar.style.height = "5px"
        bar.style.width = `${100 / samples}%`
        container.appendChild(bar)
        bars.push(bar)
    }

    requestAnimationFrame(() => {
        bars.forEach((bar) => (bar.style.height = "5px"))

        // set correct height (after previous render)
        requestAnimationFrame(() => {
            bars.forEach((bar, i) => {
                bar.style.height = `${waveform[i] * 100 * (settings.height || 1)}%`
            })
        })
    })
}
