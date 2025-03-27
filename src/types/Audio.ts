export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    loop?: boolean
    crossfade?: number
    volume?: number // playlist specific volume
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
