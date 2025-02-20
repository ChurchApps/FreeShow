import { get } from "svelte/store"
import { activePlaylist, audioPlaylists, outLocked, playingAudio } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { audioIsFading, clearAudio, fadeOutAudio } from "./audioFading"
import { customActionActivation } from "../components/actions/actions"
import { clone, shuffleArray } from "../components/helpers/array"

type AudioPlaylistOptions = {
    pauseIfPlaying?: boolean
}

type PlaylistData = {
    crossfade?: number
    loop?: boolean
}

export class AudioPlaylist {
    static start(playlistId: string, audioPath: string = "", options: AudioPlaylistOptions = {}) {
        let playlist = get(audioPlaylists)[playlistId]
        if (!playlist) return

        // pause if already playing
        if (options.pauseIfPlaying && audioPath && get(activePlaylist)?.id === playlistId && get(playingAudio)[audioPath]) {
            AudioPlayer.start(audioPath, { name: "" }, { pauseIfPlaying: true })
            return
        }

        activePlaylist.set({ id: playlistId })

        let crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal("", audioPath, { crossfade })
    }

    static stop() {
        let activeAudio = get(activePlaylist).active
        clearAudio(activeAudio)
    }

    static update(id: string, key: string, value: any) {
        if (!get(audioPlaylists)[id]) return

        audioPlaylists.update((a) => {
            a[id][key] = value
            return a
        })
    }

    static next() {
        let playlistId = get(activePlaylist)?.id || ""
        let playlist = get(audioPlaylists)[playlistId]
        if (get(outLocked) || !playlist) return

        let activePath = get(activePlaylist).active
        let crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal(activePath, "", { crossfade, loop: playlist.loop !== false })
    }

    protected static nextInternal(previousPath: string, audioPath: string = "", data: PlaylistData) {
        let playlistId = get(activePlaylist)?.id || ""
        let playlist = clone(get(audioPlaylists)[playlistId])
        if (!playlist) return

        let songs = getSongs()
        if (!songs.length) return

        let currentSongIndex = songs.findIndex((a) => a === (audioPath || previousPath))
        let nextSong = songs[currentSongIndex + (audioPath ? 0 : 1)]

        if (!nextSong && data.loop) nextSong = songs[0]
        if (!nextSong) {
            if (!data.loop && !audioIsFading()) {
                if (data.crossfade) fadeOutAudio(data.crossfade)
                else clearAudio("", false, true)

                setTimeout(() => {
                    if (!get(playingAudio)[previousPath]) customActionActivation("audio_playlist_ended")
                }, 100)
            }
            return
        }

        // prevent playing the same song twice (while it's fading) to stop duplicate audio
        if (Object.keys(playingAudio).includes(nextSong)) return

        activePlaylist.update((a) => {
            a.active = nextSong
            return a
        })

        // if (crossfade) isCrossfading = true
        AudioPlayer.start(nextSong, { name: "" }, { pauseIfPlaying: false, crossfade: data.crossfade, playlistCrossfade: true })

        function getSongs(): string[] {
            if (previousPath && get(activePlaylist)?.songs) return get(activePlaylist).songs

            // generate list
            if (!playlist) return []
            let songs = playlist.songs

            let mode = playlist.mode
            if (mode === "shuffle") songs = shuffleArray(songs)

            activePlaylist.update((a) => {
                a.songs = songs
                return a
            })

            return songs
        }
    }
}
