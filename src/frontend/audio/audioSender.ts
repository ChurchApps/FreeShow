import { get } from "svelte/store"
import { AUDIO } from "../../types/Channels"
import { keysToID } from "../components/helpers/array"
import { getFirstActiveOutput } from "../components/helpers/output"
import { audioRouting, currentWindow, disabledServers, outputs, serverData, special } from "../stores"
import { send } from "../utils/request"

export class AudioSender {
    private static processors = new Map<string, { proc: AudioNode; destNode: AudioNode }>()
    private static isActive = false
    private static isUpdating = false
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

        for (const path of ["pcmWorklet.js", "./pcmWorklet.js", "/pcmWorklet.js"]) {
            try {
                await ac.audioWorklet.addModule(path)
                this.workletModuleLoaded = true
                console.info("[AudioSender] AudioWorklet loaded")
                return true
            } catch {}
        }

        console.error("[AudioSender] Failed to load pcmWorklet.js from public paths")
        return false
    }

    static async activate(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        const win = get(currentWindow) || "main"

        if (win === "output" || win === "pdf") {
            this.deactivate()
            return
        }

        if (!this.shouldBeActive()) return
        if (ac.state === "suspended") ac.resume().catch(() => {})

        this.isActive = true
        await this.ensureWorkletModule(ac)
        this.updateProcessors(ac, getDestinationNode)
    }

    static deactivate() {
        if (this.shouldBeActive()) return
        this.isActive = false
        this.cleanupAll()
    }

    static updateProcessors(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        if (!this.isActive || this.isUpdating) return
        this.isUpdating = true

        try {
            const activeTargets = this.getActiveTargets()

            if (activeTargets.size === 0) {
                this.cleanupAll()
                return
            }

            // Clean up inactive targets
            for (const targetId of this.processors.keys()) {
                if (!activeTargets.has(targetId)) {
                    this.removeTarget(targetId)
                }
            }

            // Create nodes for newly active targets
            activeTargets.forEach((targetId) => {
                if (this.processors.has(targetId)) return

                try {
                    const destNode = getDestinationNode(targetId)
                    const proc = this.createProcessor(ac, targetId)

                    destNode.connect(proc)
                    proc.connect(this.getSilentGain(ac))
                    this.processors.set(targetId, { proc, destNode })
                } catch (err) {
                    console.error(`[AudioSender] Failed to create processor for targetId=${targetId}:`, err)
                }
            })
        } finally {
            this.isUpdating = false
        }
    }

    private static createProcessor(ac: AudioContext, targetId: string): AudioNode {
        if (this.workletModuleLoaded && ac.audioWorklet) {
            const node = new AudioWorkletNode(ac, "pcm-sender-processor")

            const audioWorker = new Worker(new URL("./audioSender.worker.ts", import.meta.url))
            const channelWorklet = new MessageChannel()

            audioWorker.postMessage({ type: "CONNECT_WORKLET_PORT", targetId, sampleRate: ac.sampleRate, icecastConfig: this.getIcecastConfig(targetId) }, [channelWorklet.port1])
            node.port.postMessage({ type: "INIT_PORT" }, [channelWorklet.port2])

            // request Main process to create a MessageChannelMain and send port2 back
            const portResponseHandler = (ev: MessageEvent) => {
                if (ev.data?.type === "AUDIO_PORT_RESPONSE" && ev.data?.targetId === targetId && ev.ports?.[0]) {
                    window.removeEventListener("message", portResponseHandler)
                    if (!(node as any)._destroyed) {
                        audioWorker.postMessage({ type: "CONNECT_MAIN_PORT", targetId }, [ev.ports[0]])
                    }
                }
            }
            window.addEventListener("message", portResponseHandler)
            ;(node as any)._cleanupListener = () => window.removeEventListener("message", portResponseHandler)

            send(AUDIO, ["INIT_PORT"], { id: targetId })

            // fallback listener in case worker sends messages back to parent thread
            audioWorker.onmessage = (ev) => {
                if ((node as any)._destroyed) return
                const rawBuffer = ev.data?.buffer || (ev.data instanceof ArrayBuffer ? ev.data : null)
                if (rawBuffer) this.sendBuffer(targetId, ac.sampleRate, new Uint8Array(rawBuffer))
            }
            ;(node as any)._worker = audioWorker

            return node
        }

        // Fallback ScriptProcessor
        const processor = ac.createScriptProcessor(1024, 2, 2)
        processor.onaudioprocess = (ev) => {
            if ((processor as any)._destroyed) return
            const inputBuffer = ev.inputBuffer
            const left = inputBuffer.getChannelData(0)
            const right = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : left

            const planar = new Float32Array(left.length * 2)
            planar.set(left, 0)
            planar.set(right, left.length)

            this.sendBuffer(targetId, ac.sampleRate, new Uint8Array(planar.buffer))
        }
        return processor
    }

    private static getIcecastConfig(targetId: string) {
        const spec = get(special)
        const isIcecast = targetId === "icecast"
        return isIcecast
            ? {
                  enabled: true,
                  host: spec.icecastHost,
                  port: spec.icecastPort,
                  mount: spec.icecastMount,
                  password: spec.icecastPassword ?? "hackme"
              }
            : undefined
    }

    private static sendBuffer(targetId: string, sampleRate: number, buffer: Uint8Array) {
        const icecastConfig = this.getIcecastConfig(targetId)
        send(AUDIO, ["PCM"], { id: targetId, buffer, sampleRate, icecast: icecastConfig })
    }

    private static getActiveTargets(): Set<string> {
        const targets = new Set<string>()

        const connections = get(audioRouting)?.connections || []
        if (connections.some((c) => c.to === "icecast")) {
            targets.add("icecast")
        }

        const activeOutputs = keysToID(get(outputs)).filter((out) => out?.enabled && (out.ndi || out.blackmagic || out.webrtcData?.streaming || out.rtmpData?.streaming))
        activeOutputs.forEach((out) => targets.add(out.id))

        if (this.sendOutputShowAudio()) {
            const outputId = this.getOutputShowId()
            if (outputId) targets.add(outputId)
        }

        return targets
    }

    private static removeTarget(targetId: string) {
        const entry = this.processors.get(targetId)
        if (!entry) return

        const { proc, destNode } = entry
        try {
            ;(proc as any)._destroyed = true

            if ((proc as any)._worker) {
                try {
                    ;(proc as any)._worker.postMessage({ type: "DISCONNECT", targetId })
                    ;(proc as any)._worker.terminate()
                } catch {}
            }
            if ((proc as any)._cleanupListener) {
                ;(proc as any)._cleanupListener()
            }

            if ("port" in proc && (proc as any).port) {
                ;(proc as any).port.onmessage = null
                ;(proc as any).port.close()
            }
            if ("onaudioprocess" in proc) {
                ;(proc as any).onaudioprocess = null
            }

            try {
                destNode.disconnect(proc)
            } catch {
                destNode.disconnect()
            }
            proc.disconnect()
        } catch {}

        this.processors.delete(targetId)
    }

    static resetTarget(targetId: string, ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        this.removeTarget(targetId)
        if (this.isActive) this.updateProcessors(ac, getDestinationNode)
    }

    static cleanupAll() {
        for (const targetId of this.processors.keys()) {
            this.removeTarget(targetId)
        }
        this.processors.clear()

        if (this.silentGain) {
            try {
                this.silentGain.disconnect()
            } catch {}
            this.silentGain = null
        }
    }

    public static shouldBeActive(): boolean {
        if (get(currentWindow) !== null) return false
        if (this.sendOutputShowAudio()) return true

        const connections = get(audioRouting)?.connections || []
        if (connections.some((c) => c.to.includes("icecast"))) return true

        const outputList = keysToID(get(outputs) || {}).filter(Boolean)
        return outputList.some((a) => a?.enabled && (a.ndi || a.blackmagic || a.webrtcData?.streaming || a.rtmpData?.streaming))
    }

    private static sendOutputShowAudio(): boolean {
        return get(disabledServers).output_stream === false && !!get(serverData)?.output_stream?.sendAudio && !!this.getOutputShowId()
    }

    private static getOutputShowId(): string | null {
        return get(serverData)?.output_stream?.outputId || getFirstActiveOutput()?.id || null
    }
}

currentWindow.subscribe((win) => {
    if (win === "output" || win === "pdf") {
        AudioSender.deactivate()
    }
})
