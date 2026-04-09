import { encodeFilePath } from "../components/helpers/media"

type WaveformSettings = {
    height?: number // 1 = 100%
    samples?: number
    type?: "bars" | "line"

    // line
    strokeWidth?: number
    fill?: boolean
    fillOpacity?: number
}

const cachedWaveformData: Map<string, Float32Array> = new Map()

export async function createWaveform(container: HTMLElement, path: string, settings: WaveformSettings = {}) {
    if (!path) {
        container.innerHTML = ""
        return
    }

    if (cachedWaveformData.has(path)) {
        renderWaveform(container, cachedWaveformData.get(path)!, settings)
        return
    }

    try {
        const rawData = await loadWaveformData(path)
        if (!rawData) {
            container.innerHTML = ""
            return
        }

        cachedWaveformData.set(path, rawData)
        renderWaveform(container, rawData, settings)
    } catch (error) {
        console.warn("Failed to create waveform", path, error)
        container.innerHTML = ""
    }
}

async function loadWaveformData(path: string): Promise<Float32Array | null> {
    const encodedPath = encodeFilePath(path)
    const candidatePaths = encodedPath === path ? [path] : [encodedPath, path]

    for (const candidatePath of candidatePaths) {
        try {
            const audioCtx = new AudioContext()
            const response = await fetch(candidatePath)
            if (!response.ok && response.status !== 0) continue

            const arrayBuffer = await response.arrayBuffer()
            if (!arrayBuffer.byteLength) continue

            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
            return audioBuffer.getChannelData(0)
        } catch {
            // Try the next path variant before failing.
        }
    }

    return null
}

export const WAVEFORM_SAMPLES = 150
function renderWaveform(container: HTMLElement, rawData: Float32Array, settings: WaveformSettings = {}) {
    const samples = settings.samples || WAVEFORM_SAMPLES
    const blockSize = Math.max(1, Math.floor(rawData.length / samples))
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

    // LINE
    if (settings.type === "line") {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
        svg.setAttribute("viewBox", `0 0 ${samples} 100`)
        svg.setAttribute("preserveAspectRatio", "none")
        svg.style.cssText = "width: 100%; height: 100%; overflow: visible; display: block;"

        const hScale = 100 * (settings.height || 1)
        const points = Array.from(waveform).map((v, i) => `${i} ${100 - v * hScale}`)
        const lineD = `M ${points.join(" L ")}`

        if (settings.fill) {
            const fill = document.createElementNS("http://www.w3.org/2000/svg", "path")
            fill.setAttribute("d", `${lineD} L ${samples - 1} 100 L 0 100 Z`)
            fill.setAttribute("fill", "currentColor")
            if (settings.fillOpacity) fill.setAttribute("fill-opacity", String(settings.fillOpacity))
            fill.style.stroke = "none"
            svg.appendChild(fill)
        }

        const line = document.createElementNS("http://www.w3.org/2000/svg", "path")
        line.classList.add("wave-line")
        line.setAttribute("d", lineD)
        line.setAttribute("stroke", "currentColor")
        line.setAttribute("stroke-width", String(settings.strokeWidth || 2))
        line.setAttribute("vector-effect", "non-scaling-stroke")
        line.setAttribute("fill", "none")
        svg.appendChild(line)

        container.appendChild(svg)
        return
    }

    // BARS
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
