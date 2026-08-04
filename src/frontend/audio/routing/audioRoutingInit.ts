import { get } from "svelte/store"
import type { AudioRoutingChannel, AudioRoutingConfig, AudioRoutingConnection } from "../../../types/AudioRouting"
import { audioRouting, dictionary } from "../../stores"
import { waitUntilValueIsDefined } from "../../utils/common"
import { translateText } from "../../utils/language"

export async function initAudioRouting(data: AudioRoutingConfig | null) {
    if (data && data.channels && data.connections && data.channels.length > 0) {
        // Ensure the first channel has id "main"
        if (data.channels[0].id !== "main") {
            const oldId = data.channels[0].id
            data.channels[0].id = "main"
            data.connections.forEach((c) => {
                if (c.from === oldId) c.from = "main"
                if (c.to === oldId) c.to = "main"
            })
        }
        audioRouting.set(data)
        return
    }

    // wait for language data
    await waitUntilValueIsDefined(() => Object.keys(get(dictionary)).length > 0)

    // const outputEntries = Object.entries(get(outputs) || {})
    const channels: AudioRoutingChannel[] = [{ id: "main", name: translateText("audio.main") }]
    const connections: AudioRoutingConnection[] = []

    connections.push({ from: "drawer_audio", to: "main" }, { from: "mic_default", to: "main" }, { from: "main", to: "speaker_default" })

    // if (outputEntries.length) {
    //     for (const [id, out] of outputEntries) {
    //         const channelId = `channel_${id}`
    //         channels.push({ id: channelId, name: `${out.name || "Output"} Bus` })

    //         // Connect default inputs to each output's channel
    //         connections.push({ from: "drawer_audio", to: channelId })
    //         connections.push({ from: "mic_default", to: channelId })

    //         // Connect channel to physical/virtual output
    //         // const to = out.stageOutput ? "output_window" : id === "default" ? "speaker_default" : `speaker_sub_${id}`
    //         // connections.push({ from: channelId, to })
    //     }
    // }

    audioRouting.set({ channels, connections })
}
