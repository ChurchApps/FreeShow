import { get } from "svelte/store"
import type { AudioRoutingConfig, AudioRoutingConnection, AudioRoutingMerger } from "../../../types/AudioRouting"
import { audioRouting, outputs } from "../../stores"

export function initAudioRouting(data: AudioRoutingConfig | null) {
    if (data?.mergers && data?.connections) {
        audioRouting.set(data)
        return
    }

    const outputEntries = Object.entries(get(outputs) || {})
    const mergers: AudioRoutingMerger[] = []
    const connections: AudioRoutingConnection[] = []

    if (outputEntries.length) {
        for (const [id, out] of outputEntries) {
            const mergerId = `merger_${id}`
            mergers.push({ id: mergerId, name: `${out.name || "Output"} Bus` })

            // Connect default inputs to each output's merger
            connections.push({ from: "drawer_audio", to: mergerId })
            connections.push({ from: "mic_default", to: mergerId })
            connections.push({ from: "output_window", to: mergerId })

            // Connect merger to physical/virtual output
            const to = out.stageOutput ? "output_window" : id === "default" ? "speaker_default" : `speaker_sub_${id}`
            connections.push({ from: mergerId, to })
        }
    } else {
        mergers.push({ id: "main", name: "Main Bus" })
        connections.push({ from: "drawer_audio", to: "main" }, { from: "mic_default", to: "main" }, { from: "output_window", to: "main" }, { from: "main", to: "speaker_default" })
    }

    audioRouting.set({ mergers, connections })
}
