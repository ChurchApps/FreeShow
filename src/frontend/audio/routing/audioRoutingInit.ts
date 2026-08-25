import { get } from "svelte/store"
import type { AudioRoutingChannel, AudioRoutingConfig, AudioRoutingConnection } from "../../../types/AudioRouting"
import { getAllOutputs, getFirstActiveOutput } from "../../components/helpers/output"
import { audioRouting, dictionary, outputs } from "../../stores"
import { waitUntilValueIsDefined } from "../../utils/common"
import { translateText } from "../../utils/language"
import { confirmCustom } from "../../utils/popup"

export function deduplicateConnections(connections: AudioRoutingConnection[]): AudioRoutingConnection[] {
    const seen = new Set<string>()
    return connections.filter((c) => {
        const chIdx = c.channelIndex ?? 0
        const key = `${c.from}->${c.to}:${chIdx}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

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
        data.connections = deduplicateConnections(data.connections)
        audioRouting.set(data)
        return
    }

    // wait for data
    await waitUntilValueIsDefined(() => Object.keys(get(dictionary)).length > 0 && Object.keys(get(outputs)).length > 0)

    // const outputEntries = Object.entries(get(outputs) || {})
    const channels: AudioRoutingChannel[] = [{ id: "main", name: translateText("audio.main") }]
    const connections: AudioRoutingConnection[] = []

    // connect main inputs
    connections.push({ from: "drawer_audio", to: "main" })
    connections.push({ from: "playlists_default", to: "main" })
    connections.push({ from: "mic_default", to: "main" })

    // create a custom Metronome channel
    channels.push({ id: "channel_metronome", name: translateText("audio.metronome") })
    connections.push({ from: "metronome", to: "channel_metronome" })

    // connect to outputs
    connections.push({ from: "main", to: "speaker_default" })
    connections.push({ from: "channel_metronome", to: "speaker_default" })

    // connect outputs
    const outputsList = getAllOutputs()
    let firstConnected = false
    outputsList.forEach((out) => {
        // any network outputs should have their own channel
        if (out.ndi || out.webrtc || out.rtmp) {
            channels.push({ id: `channel_${out.id}`, name: out.name, color: out.color, outputLink: out.id })
            connections.push(...createOutputConnections(out.id))
            return
        }

        // only connect first enabled physical output to audio output to prevent stacking audio
        if (out.enabled && !out.stageOutput && !firstConnected) {
            connections.push({ from: `output_win_sub_${out.id}`, to: "main" })
            firstConnected = true
        }
    })

    if (!firstConnected) {
        const firstActiveId = getFirstActiveOutput()?.id
        connections.push({ from: `output_win_sub_${firstActiveId}`, to: "main" })
    }

    audioRouting.set({ channels, connections })
}

export async function resetAudioRouting() {
    if (await confirmCustom(translateText("popup.reset_all_confirm"))) {
        initAudioRouting(null)
    }
}

// make sure at least one "active" output is connected to the main channel when creating a new output
export function checkPrimaryOutputRouting() {
    const outputsList = getAllOutputs()
    const primaryOutputs = outputsList.filter((out) => out.enabled && !out.ndi && !out.webrtc && !out.rtmp && !out.stageOutput)
    const outputInputs = primaryOutputs.map((out) => `output_win_sub_${out.id}`)
    if (!outputInputs.length) return

    const connections = get(audioRouting)?.connections || []
    const hasMainConnection = connections.some((c) => outputInputs.includes(c.from) && c.to === "main")
    if (hasMainConnection) return

    audioRouting.update((a) => {
        if (!a) return a
        a.connections.push({ from: outputInputs[0], to: "main" })
        return a
    })
}

function createOutputConnections(outputId: string) {
    const channelId = `channel_${outputId}`
    const connections: AudioRoutingConnection[] = []

    connections.push({ from: "drawer_audio", to: channelId })
    connections.push({ from: "playlists_default", to: channelId })
    connections.push({ from: `output_win_sub_${outputId}`, to: channelId })
    connections.push({ from: channelId, to: `network_sub_${outputId}` })

    return connections
}

export function createOutputAudioChannel(outputId: string) {
    const output = get(outputs)[outputId]
    if (!output) return

    audioRouting.update((a) => {
        const channels = a?.channels || []
        const connections = a?.connections || []

        const channelId = `channel_${outputId}`
        if (channels.some((c) => c.id === channelId)) return a

        channels.push({ id: channelId, name: output.name, color: output.color, outputLink: outputId })
        connections.push(...createOutputConnections(outputId))

        return { ...a, channels, connections: deduplicateConnections(connections) }
    })
}

// sync name/color to any linked outputs
export function syncOutputAudioChannels() {
    const outs = get(outputs)
    audioRouting.update((a) => {
        a?.channels?.forEach((c) => {
            const out = c.outputLink ? outs[c.outputLink] : null
            if (!out) return

            if (out.name) c.name = out.name
            c.color = out.color
        })
        return a
    })
}

export function removeOutputAudioChannel(outputId: string) {
    audioRouting.update((a) => {
        if (!a) return a

        const channelId = `channel_${outputId}`
        const channels = a.channels.filter((c) => c.id !== channelId)
        const connections = a.connections.filter((c) => c.from !== channelId && c.to !== channelId)

        return { ...a, channels, connections }
    })
}
