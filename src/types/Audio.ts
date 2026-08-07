export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    loop?: boolean
    autoNext?: boolean // auto play next song when current ends, enabled by default
    crossfade?: number
    volume?: number // playlist specific volume
}

export interface AudioChannelData {
    volume?: number
    isMuted?: boolean
    delay?: number // delay in ms
    dB?: number
}

export interface AudioChannel {
    dB: {
        value: number
        min?: number
        max?: number
    }
}

export interface AudioStream {
    name: string
    value: string
}

export interface MetronomeSettings {
    tempo?: number
    beats?: number
    accentVolume?: number
    secondaryVolume?: number
}
