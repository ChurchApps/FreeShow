export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    loop?: boolean
    crossfade?: number
}

export interface Channels {
    volume?: { left: number; right: number }
    dB?: {
        value: { left: number; right: number }
        min: number
        max: number
    }
}
