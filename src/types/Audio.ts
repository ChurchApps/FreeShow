export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    loop?: boolean
    crossfade?: number
}
