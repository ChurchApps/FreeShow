import { get } from "svelte/store"
import { AUDIO } from "../../types/Channels"
import { keysToID } from "../components/helpers/array"
import { getFirstActiveOutput } from "../components/helpers/output"
import { audioRouting, currentWindow, disabledServers, outputs, serverData, special } from "../stores"
import { send } from "../utils/request"

export class AudioSender {
    private static processors: Map<string, { proc: AudioNode; destNode: AudioNode }> = new Map()
    private static isActive = false
    private static silentGain: GainNode | null = null
    private static workletModuleLoaded = false

    private static getSilentGain(ac: AudioContext): GainNode {
        if (!this.silentGain || this.silentGain.context !== ac) {
            this.silentGain = ac.createGain()
            this.silentGain.gain.value = 0
            try {
                this.silentGain.connect(ac.destination)
            } catch {}
        }
        return this.silentGain
    }

    private static async ensureWorkletModule(ac: AudioContext): Promise<boolean> {
        if (this.workletModuleLoaded) return true
        if (!ac.audioWorklet) return false

        const paths = ["pcmWorklet.js", "./pcmWorklet.js", "/pcmWorklet.js"]
        for (const p of paths) {
            try {
                await ac.audioWorklet.addModule(p)
                this.workletModuleLoaded = true
                console.log(`[AudioSender] AudioWorklet module loaded successfully from: ${p}`)
                return true
            } catch {}
        }

        console.error("[AudioSender] Could not load pcmWorklet.js from public paths")
        return false
    }

    static async activate(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        const win = get(currentWindow) || "main"
        console.log(`[AudioSender] activate() called in window: ${win}`)

        if (win === "output" || win === "pdf") {
            console.log(`[AudioSender] Ignoring activate in secondary window: ${win}`)
            this.deactivate()
            return
        }

        if (!this.shouldBeActive()) return

        if (ac.state === "suspended") {
            ac.resume().catch(() => {})
        }

        this.isActive = true
        await this.ensureWorkletModule(ac)
        this.updateProcessors(ac, getDestinationNode)
    }

    static deactivate() {
        if (this.shouldBeActive()) return

        const win = get(currentWindow) || "main"
        console.log(`[AudioSender] deactivate() called in window: ${win}`)
        this.isActive = false
        this.cleanupAll()
    }

    private static isUpdating = false

    static updateProcessors(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        if (!this.isActive || this.isUpdating) return
        this.isUpdating = true

        try {
            const activeTargets: string[] = []

            const connections = get(audioRouting)?.connections || []
            const isIcecastConnected = connections.some((c) => c.to === "icecast")
            if (isIcecastConnected) activeTargets.push("icecast")

            const activeStreamingOutputs = keysToID(get(outputs)).filter((out) => out && out.enabled && (out.ndi || out.blackmagic || out.webrtcData?.streaming || out.rtmpData?.streaming))
            activeStreamingOutputs.forEach((out) => {
                if (!activeTargets.includes(out.id)) activeTargets.push(out.id)
            })

            if (this.sendOutputShowAudio()) {
                const outputId = this.getOutputShowId()
                if (outputId && !activeTargets.includes(outputId)) {
                    activeTargets.push(outputId)
                }
            }

            if (activeTargets.length === 0) {
                this.cleanupAll()
                return
            }

            const win = get(currentWindow) || "main"

            // Remove processors for inactive targets
            this.processors.forEach((_entry, targetId) => {
                if (!activeTargets.includes(targetId)) {
                    this.removeTarget(targetId)
                }
            })

            // Create processor for each active target
            const hasWorklet = this.workletModuleLoaded && !!ac.audioWorklet
            activeTargets.forEach((targetId) => {
                if (this.processors.has(targetId)) return

                const destNode = getDestinationNode(targetId)
                if (this.processors.has(targetId)) return

                try {
                    if (hasWorklet && ac.audioWorklet) {
                        console.log(`[AudioSender] Creating AudioWorkletNode for targetId=${targetId} window=${win}`)
                        const workletNode = new AudioWorkletNode(ac, "pcm-sender-processor")

                        workletNode.port.onmessage = (ev) => {
                            if ((workletNode as any)._destroyed) return
                            const data = ev.data
                            const rawBuffer = data?.buffer || (data instanceof ArrayBuffer ? data : null)
                            if (!rawBuffer) return

                            const uint8Array = new Uint8Array(rawBuffer)
                            const spec = get(special)
                            const isIcecast = targetId === "icecast"
                            const icecastConfig = isIcecast ? { enabled: true, host: spec.icecastHost, port: spec.icecastPort, mount: spec.icecastMount, password: spec.icecastPassword ?? "hackme" } : undefined

                            send(AUDIO, ["PCM"], { id: targetId, buffer: uint8Array, sampleRate: ac.sampleRate, icecast: icecastConfig })
                        }

                        destNode.connect(workletNode)
                        workletNode.connect(this.getSilentGain(ac))
                        this.processors.set(targetId, { proc: workletNode, destNode })
                    } else {
                        console.log(`[AudioSender] Creating fallback ScriptProcessorNode for targetId=${targetId} window=${win}`)
                        const processor = ac.createScriptProcessor(1024, 2, 2)

                        processor.onaudioprocess = (ev) => {
                            if ((processor as any)._destroyed) return

                            const inputBuffer = ev.inputBuffer
                            const left = inputBuffer.getChannelData(0)
                            const right = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : left
                            const length = left.length

                            const float32Planar = new Float32Array(length * 2)
                            float32Planar.set(left, 0)
                            float32Planar.set(right, length)

                            const uint8Array = new Uint8Array(float32Planar.buffer)
                            const spec = get(special)
                            const isIcecast = targetId === "icecast"
                            const icecastConfig = isIcecast ? { enabled: true, host: spec.icecastHost, port: spec.icecastPort, mount: spec.icecastMount, password: spec.icecastPassword ?? "hackme" } : undefined

                            send(AUDIO, ["PCM"], { id: targetId, buffer: uint8Array, sampleRate: ac.sampleRate, icecast: icecastConfig })
                        }

                        destNode.connect(processor)
                        processor.connect(this.getSilentGain(ac))
                        this.processors.set(targetId, { proc: processor, destNode })
                    }
                } catch (err) {
                    console.error(`[AudioSender] Failed to start audio processor for targetId=${targetId}:`, err)
                }
            })
        } finally {
            this.isUpdating = false
        }
    }

    private static removeTarget(targetId: string) {
        console.log(`[AudioSender] removeTarget called for ${targetId}`)
        const entry = this.processors.get(targetId)
        if (entry) {
            const { proc, destNode } = entry
            try {
                ;(proc as any)._destroyed = true
                if ("port" in proc && (proc as any).port) {
                    try {
                        ;(proc as any).port.onmessage = null
                    } catch {}
                    try {
                        ;(proc as any).port.close()
                    } catch {}
                }
                if ("onaudioprocess" in proc) {
                    ;(proc as any).onaudioprocess = null
                }
                try {
                    destNode.disconnect(proc)
                } catch {
                    try {
                        destNode.disconnect()
                    } catch {}
                }
                proc.disconnect()
            } catch {}
            this.processors.delete(targetId)
        }
    }

    static resetTarget(targetId: string, ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        this.removeTarget(targetId)
        if (this.isActive) this.updateProcessors(ac, getDestinationNode)
    }

    static cleanupAll() {
        this.processors.forEach((_entry, targetId) => {
            this.removeTarget(targetId)
        })
        this.processors.clear()

        if (this.silentGain) {
            try {
                this.silentGain.disconnect()
            } catch {}
            this.silentGain = null
        }
    }

    public static shouldBeActive(): boolean {
        const win = get(currentWindow)
        if (win !== null) return false

        if (this.sendOutputShowAudio()) return true

        const connections = get(audioRouting)?.connections || []
        if (this.isOutputConnected("icecast", connections)) return true

        const outputList = keysToID(get(outputs) || {}).filter(Boolean)
        const hasConnectedOutput = outputList.some((a) => a && a.enabled && (a.ndi || a.blackmagic || a.webrtcData?.streaming || a.rtmpData?.streaming))
        return hasConnectedOutput
    }

    private static isOutputConnected(id: string | undefined, connections: { from: string; to: string }[]): boolean {
        if (!id) return false
        for (let i = 0; i < connections.length; i++) {
            if (connections[i].to.includes(id)) return true
        }
        return false
    }

    private static sendOutputShowAudio(): boolean {
        return get(disabledServers).output_stream === false && !!get(serverData)?.output_stream?.sendAudio && !!this.getOutputShowId()
    }

    private static getOutputShowId(): string | null {
        const outputId = get(serverData)?.output_stream?.outputId || getFirstActiveOutput()?.id
        return outputId || null
    }

    static setTestTone(enabled: boolean) {
        console.log(`[AudioSender] Setting 440Hz Sine Wave Test Tone: ${enabled}`)
        this.processors.forEach(({ proc }) => {
            if ("port" in proc && (proc as any).port) {
                try {
                    ;(proc as any).port.postMessage({ testTone: enabled })
                } catch {}
            }
        })
    }
}

try {
    ;(window as any).testNdiTone = (enabled = true) => AudioSender.setTestTone(enabled)
} catch {}

currentWindow.subscribe((win) => {
    if (win === "output" || win === "pdf") {
        AudioSender.deactivate()
    }
})
