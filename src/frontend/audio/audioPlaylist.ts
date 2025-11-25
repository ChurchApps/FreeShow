import { get } from "svelte/store"
import { activePlaylist, audioPlaylists, media, outLocked, playingAudio } from "../stores"
import { AudioPlayer } from "./audioPlayer"
import { audioIsFading, clearAudio, fadeOutAudio, isAllAudioFading } from "./audioFading"
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
    static start(playlistId: string, audioPath = "", options: AudioPlaylistOptions = {}) {
        const playlist = get(audioPlaylists)[playlistId]
        if (!playlist) return

        // don't restart if already playing
        if (!options.pauseIfPlaying && get(activePlaylist)?.id === playlistId) return

        // pause if already playing
        if (options.pauseIfPlaying && audioPath && get(activePlaylist)?.id === playlistId && get(playingAudio)[audioPath]) {
            AudioPlayer.start(audioPath, { name: "" }, { pauseIfPlaying: true })
            return
        }

        activePlaylist.set({ id: playlistId })

        const crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal(audioPath, { crossfade })
    }

    static stop() {
        activePlaylist.set(null)
        const activeAudio = AudioPlaylist.getPlayingPath()
        clearAudio(activeAudio)
    }

    static update(id: string, key: string, value: any) {
        if (!get(audioPlaylists)[id]) return

        audioPlaylists.update((a) => {
            a[id][key] = value
            return a
        })

        if (key === "volume") AudioPlayer.updateVolume()
    }

    static next() {
        const playlist = AudioPlaylist.getActivePlaylist()
        if (get(outLocked) || !playlist) return

        const crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal("", { crossfade, loop: playlist.loop !== false })
    }

    static getPlayingPath(): string {
        return get(activePlaylist)?.active || ""
    }

    static getActivePlaylist() {
        const playlistId = get(activePlaylist)?.id || ""
        const playlist = get(audioPlaylists)[playlistId]
        if (!playlist) return null
        return playlist
    }

    private static isCrossfading = false
    static checkCrossfade() {
        const audioPath = AudioPlaylist.getPlayingPath()
        if (isAllAudioFading || !audioPath || get(media)[audioPath]?.loop) {
            this.isCrossfading = false
            return
        }
        if (this.isCrossfading) return

        const crossfadeDuration = this.crossfade()
        if (!crossfadeDuration) return

        this.isCrossfading = true
        setTimeout(() => (this.isCrossfading = false), crossfadeDuration)
    }

    private static extraMargin = 0.1 // s
    private static crossfade() {
        const playlist = AudioPlaylist.getActivePlaylist()
        if (!playlist) return 0

        const crossfade = Number(playlist.crossfade) || 0
        const audioPath = AudioPlaylist.getPlayingPath()
        const playing = AudioPlayer.getAudio(audioPath)
        if (!crossfade || !audioPath || !playing) return 0

        const customCrossfade = crossfade > 3 ? crossfade * 0.6 : crossfade
        const endTime = AudioPlayer.getEndTime(audioPath, playing.duration)
        const reachedEnding = playing.currentTime + customCrossfade + this.extraMargin >= endTime
        if (!reachedEnding) return 0

        AudioPlaylist.nextInternal("", { crossfade: customCrossfade, loop: playlist.loop !== false })
        return crossfade
    }

    protected static nextInternal(audioPath = "", data: PlaylistData) {
        const playlist = clone(AudioPlaylist.getActivePlaylist())
        if (!playlist) return

        const previousPath = AudioPlaylist.getPlayingPath()
        const songs = getSongs()
        if (!songs.length) return

        const currentSongIndex = songs.findIndex((a) => a === (audioPath || previousPath))
        let nextSong = songs[currentSongIndex + (audioPath ? 0 : 1)]

        if (!nextSong && data.loop) nextSong = songs[0]
        if (!nextSong) {
            if (!data.loop && !audioIsFading()) {
                if (data.crossfade) fadeOutAudio(data.crossfade)
                else clearAudio("", { playlistCrossfade: true })

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
        AudioPlayer.start(nextSong, { name: "" }, { pauseIfPlaying: false, crossfade: data.crossfade, playlistCrossfade: true, volume: playlist.volume || 1 })

        function getSongs(): string[] {
            if (previousPath && get(activePlaylist)?.songs) return get(activePlaylist).songs

            // generate list
            if (!playlist) return []
            let songsList = playlist.songs

            const mode = playlist.mode
            if (mode === "shuffle") songsList = shuffleArray(songsList)

            activePlaylist.update((a) => {
                a.songs = songsList
                return a
            })

            return songsList
        }
    }
}
