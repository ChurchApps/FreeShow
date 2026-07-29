export interface AudioRoutingItem {
    id: string
    name: string
    type: string // "drawer_audio" | "mic" | "metronome" | "output_window" for inputs; "speaker" | "network" | "icecast" for outputs
    enabled?: boolean
    deviceId?: string
}

export interface AudioRoutingMerger {
    id: string
    name: string
}

export interface AudioRoutingConnection {
    from: string // input ID or merger ID
    to: string   // merger ID or output ID
}

export interface AudioRoutingConfig {
    mergers: AudioRoutingMerger[]
    connections: AudioRoutingConnection[]
    inputs?: AudioRoutingItem[]
    outputs?: AudioRoutingItem[]
}
