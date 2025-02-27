export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    loop?: boolean
    crossfade?: number
}

export interface AudioChannel {
    dB: {
        value: number
        min?: number
        max?: number
    }
}
