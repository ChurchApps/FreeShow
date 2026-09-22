import { AudioAnalyser } from "./audioAnalyser"

export class SpectrumAnalyzer {
    private canvas: HTMLCanvasElement | null = null
    private ctx: CanvasRenderingContext2D | null = null
    private animationFrame: number | null = null
    private channelId: string = ""
    private isRunning = false

    private readonly minFreq = 20
    private readonly maxFreq = 20000
    private readonly numPoints = 120

    private smoothedValues: Float32Array = new Float32Array(this.numPoints)
    private displayValues: Float32Array = new Float32Array(this.numPoints)
    private channelBuffers: Uint8Array[] = []

    private activeAnalysers: AnalyserNode[] = []
    private lastFrameTime = 0

    constructor(channelId: string = "") {
        this.channelId = channelId
    }

    public setChannel(channelId: string) {
        if (this.channelId !== channelId) {
            this.resetActiveAnalysersFft()
            this.channelId = channelId
        }
    }

    public start(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        this.ctx = canvas.getContext("2d")
        if (!this.ctx) return

        if (this.isRunning) return
        this.isRunning = true
        this.lastFrameTime = performance.now()
        this.renderLoop()
    }

    public stop() {
        this.isRunning = false
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame)
            this.animationFrame = null
        }
        this.resetActiveAnalysersFft()
        this.clearCanvas()
    }

    private resetActiveAnalysersFft() {
        for (let i = 0; i < this.activeAnalysers.length; i++) {
            const a = this.activeAnalysers[i]
            if (a && a.fftSize !== 256) {
                try {
                    a.fftSize = 256
                } catch {}
            }
        }
        this.activeAnalysers = []
    }

    private clearCanvas() {
        if (this.ctx && this.canvas) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
    }

    private renderLoop = () => {
        if (!this.isRunning || !this.canvas || !this.ctx) return

        this.animationFrame = requestAnimationFrame(this.renderLoop)

        const now = performance.now()
        // Cap rendering to ~60 FPS (16ms)
        if (now - this.lastFrameTime < 14) return
        this.lastFrameTime = now

        this.renderFrame()
    }

    private renderFrame() {
        if (!this.canvas || !this.ctx) return

        const width = this.canvas.width
        const height = this.canvas.height
        if (width <= 0 || height <= 0) return

        const analysers = AudioAnalyser.getAnalysers(this.channelId)
        const hasAnalysers = Boolean(analysers && analysers.length > 0)

        let sampleRate = 48000
        let binCount = 0

        if (hasAnalysers) {
            this.activeAnalysers = analysers
            // Dynamically scale up to 1024 for high-resolution analysis only while actively displayed
            for (let i = 0; i < analysers.length; i++) {
                if (analysers[i].fftSize !== 1024) {
                    try {
                        analysers[i].fftSize = 1024
                    } catch {}
                }
            }

            const firstAnalyser = analysers[0]
            binCount = firstAnalyser.frequencyBinCount
            sampleRate = firstAnalyser.context.sampleRate || 48000

            if (this.channelBuffers.length !== analysers.length || (this.channelBuffers[0] && this.channelBuffers[0].length !== binCount)) {
                this.channelBuffers = analysers.map(() => new Uint8Array(binCount))
            }

            for (let ch = 0; ch < analysers.length; ch++) {
                analysers[ch].getByteFrequencyData(this.channelBuffers[ch] as Uint8Array<ArrayBuffer>)
            }
        } else if (this.activeAnalysers.length > 0) {
            this.resetActiveAnalysersFft()
        }

        const fftSize = binCount * 2
        const freqPerBin = fftSize > 0 ? sampleRate / fftSize : 1

        const logMin = Math.log10(this.minFreq)
        const logMax = Math.log10(this.maxFreq)
        const logRange = logMax - logMin

        let maxAmpAcrossFrame = 0

        for (let i = 0; i < this.numPoints; i++) {
            let targetAmp = 0

            if (hasAnalysers && binCount > 0 && this.channelBuffers.length > 0) {
                const progress = i / (this.numPoints - 1)
                const nextProgress = Math.min(1, (i + 1) / (this.numPoints - 1))

                const freq = Math.pow(10, logMin + progress * logRange)
                const nextFreq = Math.pow(10, logMin + nextProgress * logRange)

                const bin = freq / freqPerBin
                const nextBin = nextFreq / freqPerBin

                const b0 = Math.min(binCount - 1, Math.max(0, Math.floor(bin)))
                const bEnd = Math.min(binCount - 1, Math.max(b0, Math.ceil(nextBin)))

                let rawVal = 0
                const numCh = this.channelBuffers.length

                if (bEnd > b0) {
                    let maxVal = 0
                    for (let ch = 0; ch < numCh; ch++) {
                        const buf = this.channelBuffers[ch]
                        for (let b = b0; b <= bEnd; b++) {
                            const v = buf[b] || 0
                            if (v > maxVal) maxVal = v
                        }
                    }
                    rawVal = maxVal
                } else {
                    const b1 = Math.min(binCount - 1, b0 + 1)
                    const frac = bin - b0
                    let sum = 0
                    for (let ch = 0; ch < numCh; ch++) {
                        const buf = this.channelBuffers[ch]
                        const v0 = buf[b0] || 0
                        const v1 = buf[b1] || v0
                        sum += v0 + (v1 - v0) * frac
                    }
                    rawVal = sum / numCh
                }

                // Direct accurate response to EQ gain changes
                targetAmp = (rawVal / 255) * 0.85
            }

            if (isNaN(targetAmp)) targetAmp = 0
            if (targetAmp > maxAmpAcrossFrame) maxAmpAcrossFrame = targetAmp

            // Smooth attack and release ballistics
            const current = this.smoothedValues[i] || 0
            if (targetAmp > current) {
                this.smoothedValues[i] = current * 0.65 + targetAmp * 0.35
            } else {
                this.smoothedValues[i] = current * 0.93 // Smooth decay
            }
        }

        // Spatial blur across adjacent frequency bins to remove spiky jitter
        for (let i = 0; i < this.numPoints; i++) {
            const prev = i > 0 ? this.smoothedValues[i - 1] : this.smoothedValues[i]
            const curr = this.smoothedValues[i]
            const next = i < this.numPoints - 1 ? this.smoothedValues[i + 1] : this.smoothedValues[i]
            this.displayValues[i] = prev * 0.2 + curr * 0.6 + next * 0.2
        }

        // Render to canvas
        this.ctx.clearRect(0, 0, width, height)

        if (maxAmpAcrossFrame < 0.002 && this.smoothedValues[0] < 0.005) {
            return
        }

        const points: { x: number; y: number }[] = []
        for (let i = 0; i < this.numPoints; i++) {
            const x = (i / (this.numPoints - 1)) * width
            const normAmp = Math.min(1, Math.max(0, this.displayValues[i]))
            const y = height - normAmp * height * 0.95
            points.push({ x, y })
        }

        if (points.length < 2) return

        // Gradient fill
        const gradient = this.ctx.createLinearGradient(0, height, 0, 0)
        gradient.addColorStop(0, "rgba(78, 205, 196, 0.02)")
        gradient.addColorStop(0.3, "rgba(78, 205, 196, 0.12)")
        gradient.addColorStop(0.7, "rgba(82, 149, 173, 0.28)")
        gradient.addColorStop(1, "rgba(100, 220, 240, 0.45)")

        this.ctx.beginPath()
        this.ctx.moveTo(0, height)
        this.ctx.lineTo(points[0].x, points[0].y)

        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i]
            const next = points[i + 1]
            const midX = (curr.x + next.x) / 2
            const midY = (curr.y + next.y) / 2
            this.ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
        }

        const last = points[points.length - 1]
        this.ctx.lineTo(last.x, last.y)
        this.ctx.lineTo(width, height)
        this.ctx.closePath()
        this.ctx.fillStyle = gradient
        this.ctx.fill()

        // Top line stroke
        this.ctx.beginPath()
        this.ctx.moveTo(points[0].x, points[0].y)

        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i]
            const next = points[i + 1]
            const midX = (curr.x + next.x) / 2
            const midY = (curr.y + next.y) / 2
            this.ctx.quadraticCurveTo(curr.x, curr.y, midX, midY)
        }
        this.ctx.lineTo(last.x, last.y)

        this.ctx.strokeStyle = "rgba(130, 230, 250, 0.75)"
        this.ctx.lineWidth = 1.5
        this.ctx.stroke()
    }

    public dispose() {
        this.stop()
        this.canvas = null
        this.ctx = null
        this.smoothedValues.fill(0)
        this.displayValues.fill(0)
    }
}
