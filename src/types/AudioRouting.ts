export interface AudioRoutingItem {
    id: string
    name: string
    type: string // "drawer_audio" | "mic" | "metronome" | "output_window" for inputs; "speaker" | "network" | "icecast" for outputs
    enabled?: boolean
    deviceId?: string
}

export interface AudioRoutingChannel {
    id: string
    name: string
    color?: string
    outputLink?: string
}

export interface AudioRoutingConnection {
    from: string // input ID or channel ID
    to: string // channel ID or output ID
    channelIndex?: number
}

export interface AudioRoutingConfig {
    channels: AudioRoutingChannel[]
    connections: AudioRoutingConnection[]
    inputs?: AudioRoutingItem[]
    outputs?: AudioRoutingItem[]
    desktopAudioEnabled?: boolean
}
