import { encodeFilePath } from "../components/helpers/media"

let cachedWaveformData: Map<string, Float32Array> = new Map()
export async function createWaveform(container: HTMLElement, path: string) {
    const audioCtx = new AudioContext()

    if (cachedWaveformData.has(path)) {
        renderWaveform(container, cachedWaveformData.get(path)!)
        return
    }

    const response = await fetch(encodeFilePath(path))
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    const rawData = audioBuffer.getChannelData(0)
    cachedWaveformData.set(path, rawData)

    renderWaveform(container, rawData)
}

export const WAVEFORM_SAMPLES = 150
function renderWaveform(container: HTMLElement, rawData: Float32Array) {
    const samples = WAVEFORM_SAMPLES
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
                bar.style.height = `${waveform[i] * 100}%`
            })
        })
    })
}

// not in use
export function createRealtimeWaveform(canvas: HTMLCanvasElement, path: string) {
    const audio = new Audio(encodeFilePath(path))
    // audio.controls = true
    // document.body.appendChild(audio)

    setupAudioContext(canvas, audio)
}

function setupAudioContext(canvas: HTMLCanvasElement, audioElement) {
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    const source = audioCtx.createMediaElementSource(audioElement)
    source.connect(analyser)
    analyser.connect(audioCtx.destination)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    audioElement.onplay = () => {
        if (audioCtx.state === "suspended") {
            audioCtx.resume()
        }
        drawWaveform()
    }

    function drawWaveform() {
        requestAnimationFrame(drawWaveform)
        analyser.getByteTimeDomainData(dataArray)

        ctx!.fillStyle = "black"
        ctx!.fillRect(0, 0, canvas.width, canvas.height)

        ctx!.lineWidth = 2
        ctx!.strokeStyle = "#00ffcc"
        ctx!.beginPath()

        const sliceWidth = canvas.width / dataArray.length
        let x = 0

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0
            const y = (v * canvas.height) / 2

            if (i === 0) {
                ctx!.moveTo(x, y)
            } else {
                ctx!.lineTo(x, y)
            }

            x += sliceWidth
        }

        ctx!.lineTo(canvas.width, canvas.height / 2)
        ctx!.stroke()
    }
}
