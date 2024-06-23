export interface Playlist {
    name: string
    songs: string[]
    mode?: "default" | "shuffle"
    crossfade?: number
}
