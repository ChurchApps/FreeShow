import { get } from "svelte/store"
import type { AudioRoutingChannel, AudioRoutingConfig, AudioRoutingConnection } from "../../../types/AudioRouting"
import { audioRouting, dictionary, outputs } from "../../stores"
import { waitUntilValueIsDefined } from "../../utils/common"
import { translateText } from "../../utils/language"

export async function initAudioRouting(data: AudioRoutingConfig | null) {
    if (data && data.channels && data.connections) {
        audioRouting.set(data)
        return
    }

    const outputEntries = Object.entries(get(outputs) || {})
    const channels: AudioRoutingChannel[] = []
    const connections: AudioRoutingConnection[] = []

    if (outputEntries.length) {
        for (const [id, out] of outputEntries) {
            const channelId = `channel_${id}`
            channels.push({ id: channelId, name: `${out.name || "Output"} Bus` })

            // Connect default inputs to each output's channel
            connections.push({ from: "drawer_audio", to: channelId })
            connections.push({ from: "mic_default", to: channelId })

            // Connect channel to physical/virtual output
            // const to = out.stageOutput ? "output_window" : id === "default" ? "speaker_default" : `speaker_sub_${id}`
            // connections.push({ from: channelId, to })
        }
    } else {
        // wait for language data
        await waitUntilValueIsDefined(() => Object.keys(get(dictionary)).length > 0)

        channels.push({ id: "main", name: translateText("audio.main") })
        connections.push({ from: "drawer_audio", to: "main" }, { from: "mic_default", to: "main" }, { from: "main", to: "speaker_default" })
    }

    audioRouting.set({ channels, connections })
}
