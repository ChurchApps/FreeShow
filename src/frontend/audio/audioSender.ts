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
    private static registeredContexts = new WeakSet<BaseAudioContext>()
    private static workletLoadingPromises = new WeakMap<BaseAudioContext, Promise<boolean>>()

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
        if (this.registeredContexts.has(ac)) return true
        if (!ac.audioWorklet) return false

        const existingPromise = this.workletLoadingPromises.get(ac)
        if (existingPromise) return existingPromise

        const promise = (async () => {
            try {
                await ac.audioWorklet.addModule("./assets/pcm-worklet.js")
                this.registeredContexts.add(ac)
                console.info("[AudioSender] AudioWorklet loaded")
                return true
            } catch (err: any) {
                if (this.registeredContexts.has(ac)) return true
                if (err?.name !== "AbortError") {
                    console.error("[AudioSender] Failed to load pcmWorklet module:", err)
                }
                return false
            } finally {
                this.workletLoadingPromises.delete(ac)
            }
        })()

        this.workletLoadingPromises.set(ac, promise)
        return promise
    }

    static async activate(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        const win = get(currentWindow) || "main"

        if (win === "output" || win === "pdf") {
            this.deactivate()
            return
        }

        if (!this.shouldBeActive()) {
            this.deactivate()
            return
        }
        if (ac.state === "suspended") ac.resume().catch(() => {})

        this.isActive = true
        await this.ensureWorkletModule(ac)
        await this.updateProcessors(ac, getDestinationNode)
    }

    static deactivate() {
        if (this.shouldBeActive()) return
        this.isActive = false
        this.cleanupAll()
    }

    static async updateProcessors(ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        if (!this.isActive || this.isUpdating) return
        this.isUpdating = true

        try {
            const isLoaded = await this.ensureWorkletModule(ac)
            if (!isLoaded) {
                console.warn("[AudioSender] Cannot update processors: Worklet module failed to load.")
                return
            }

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
            for (const targetId of activeTargets) {
                if (this.processors.has(targetId)) continue

                try {
                    const destNode = getDestinationNode(targetId)
                    const proc = this.createProcessor(ac, targetId)

                    destNode.connect(proc)
                    proc.connect(this.getSilentGain(ac))
                    this.processors.set(targetId, { proc, destNode })
                } catch (err) {
                    console.error(`[AudioSender] Failed to create processor for targetId=${targetId}:`, err)
                }
            }
        } finally {
            this.isUpdating = false
        }
    }

    private static pendingPortCleanups = new Map<string, () => void>()

    private static createProcessor(ac: AudioContext, targetId: string): AudioNode {
        if (!this.registeredContexts.has(ac) || !ac.audioWorklet) {
            return this.createFallbackProcessor(ac, targetId)
        }

        this.pendingPortCleanups.get(targetId)?.()
        this.pendingPortCleanups.delete(targetId)

        const node = new AudioWorkletNode(ac, "pcm-sender-processor")

        // request Main process to create a MessageChannelMain and send port2 back
        const portResponseHandler = (ev: MessageEvent) => {
            if (ev.data?.type === "AUDIO_PORT_RESPONSE" && ev.data?.targetId === targetId && ev.ports?.[0]) {
                window.removeEventListener("message", portResponseHandler)
                AudioSender.pendingPortCleanups.delete(targetId)
                if (!(node as any)._destroyed) {
                    try {
                        node.port.postMessage(
                            {
                                type: "INIT_PORT",
                                targetId,
                                sampleRate: ac.sampleRate,
                                icecastConfig: this.getIcecastConfig(targetId)
                            },
                            [ev.ports[0]]
                        )
                    } catch (err) {
                        console.warn(`[AudioSender] Failed to transfer audio port for targetId=${targetId}:`, err)
                    }
                }
            }
        }
        window.addEventListener("message", portResponseHandler)
        const cleanupListener = () => {
            window.removeEventListener("message", portResponseHandler)
            if (AudioSender.pendingPortCleanups.get(targetId) === cleanupListener) {
                AudioSender.pendingPortCleanups.delete(targetId)
            }
        }
        this.pendingPortCleanups.set(targetId, cleanupListener)
        ;(node as any)._cleanupListener = cleanupListener

        send(AUDIO, ["INIT_PORT"], { id: targetId })

        return node
    }

    private static createFallbackProcessor(ac: AudioContext, targetId: string): AudioNode {
        const frameSize = Math.max(128, Math.round(ac.sampleRate * 0.02))
        const bufL = new Float32Array(frameSize)
        const bufR = new Float32Array(frameSize)
        const planarBuffer = new Float32Array(frameSize * 2)
        let offset = 0

        const processor = ac.createScriptProcessor(2048, 2, 2)
        processor.onaudioprocess = (ev) => {
            if ((processor as any)._destroyed) return
            const inputBuffer = ev.inputBuffer
            const left = inputBuffer.getChannelData(0)
            const right = inputBuffer.numberOfChannels > 1 ? inputBuffer.getChannelData(1) : left
            const len = left ? left.length : 0

            for (let readIdx = 0; readIdx < len; ) {
                if (offset >= frameSize) {
                    planarBuffer.set(bufL, 0)
                    planarBuffer.set(bufR, frameSize)

                    this.sendBuffer(targetId, ac.sampleRate, new Uint8Array(planarBuffer.buffer))
                    offset = 0
                }

                const chunk = Math.min(len - readIdx, frameSize - offset)
                if (chunk <= 0) break

                bufL.set(left.subarray(readIdx, readIdx + chunk), offset)
                if (right) bufR.set(right.subarray(readIdx, readIdx + chunk), offset)
                else bufR.set(left.subarray(readIdx, readIdx + chunk), offset)

                offset += chunk
                readIdx += chunk

                if (offset >= frameSize) {
                    planarBuffer.set(bufL, 0)
                    planarBuffer.set(bufR, frameSize)

                    this.sendBuffer(targetId, ac.sampleRate, new Uint8Array(planarBuffer.buffer))
                    offset = 0
                }
            }
        }
        return processor
    }

    private static getIcecastConfig(targetId: string) {
        const spec = get(special)
        const isIcecast = targetId === "icecast"
        const icecast = spec?.icecast || {}
        return isIcecast
            ? {
                  enabled: icecast.enabled ?? true,
                  host: icecast.host || "localhost",
                  port: icecast.port ?? 8000,
                  mount: icecast.mount || "/stream.opus",
                  password: icecast.password ?? "hackme"
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
        const isIcecastEnabled = get(special)?.icecast?.enabled ?? true

        if (isIcecastEnabled) {
            for (let i = 0; i < connections.length; i++) {
                if (connections[i].to === "icecast") {
                    targets.add("icecast")
                    break
                }
            }
        }

        const rawOutputs = keysToID(get(outputs) || {})
        for (let i = 0; i < rawOutputs.length; i++) {
            const out = rawOutputs[i]
            const networkOutput = out.ndi || out.blackmagic || out.webrtcData?.streaming || out.rtmpData?.streaming
            if (out?.enabled && networkOutput) targets.add(out.id)
        }

        if (this.sendOutputShowAudio()) {
            const outputId = this.getOutputShowId()
            if (outputId) targets.add(outputId)
        }

        return targets
    }

    private static removeTarget(targetId: string) {
        this.pendingPortCleanups.get(targetId)?.()
        this.pendingPortCleanups.delete(targetId)

        const entry = this.processors.get(targetId)
        if (!entry) return

        const { proc, destNode } = entry
        try {
            ;(proc as any)._destroyed = true

            if ((proc as any)._cleanupListener) {
                ;(proc as any)._cleanupListener()
            }

            if ("port" in proc && (proc as any).port) {
                try {
                    ;(proc as any).port.postMessage({ type: "DESTROY" })
                } catch {}
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
        send(AUDIO, ["CLOSE_PORT"], { id: targetId })
    }

    static resetTarget(targetId: string, ac: AudioContext, getDestinationNode: (targetId: string) => AudioNode) {
        this.removeTarget(targetId)
        if (this.isActive) this.updateProcessors(ac, getDestinationNode)
    }

    static cleanupAll() {
        const cleanups = Array.from(this.pendingPortCleanups.values())
        this.pendingPortCleanups.clear()
        for (let i = 0; i < cleanups.length; i++) {
            try {
                cleanups[i]()
            } catch {}
        }

        const targets = Array.from(this.processors.keys())
        for (let i = 0; i < targets.length; i++) {
            this.removeTarget(targets[i])
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
        const isIcecastEnabled = get(special)?.icecast?.enabled ?? true
        if (isIcecastEnabled) {
            for (let i = 0; i < connections.length; i++) {
                if (connections[i].to.includes("icecast")) return true
            }
        }

        const outputList = keysToID(get(outputs) || {})
        for (let i = 0; i < outputList.length; i++) {
            const a = outputList[i]
            const networkOutput = a.ndi || a.blackmagic || a.webrtcData?.streaming || a.rtmpData?.streaming
            if (a?.enabled && networkOutput) return true
        }

        return false
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
