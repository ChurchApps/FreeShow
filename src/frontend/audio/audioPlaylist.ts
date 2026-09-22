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
    autoNext?: boolean
    cannotPlay?: number // songs skipped in a row because their file could not be played
}

export class AudioPlaylist {
    static start(playlistId: string, audioPath = "", index: number = 0, options: AudioPlaylistOptions = {}) {
        const playlist = get(audioPlaylists)[playlistId]
        if (!playlist) return

        const active = get(activePlaylist)
        // don't restart if already playing
        if (!options.pauseIfPlaying && active?.id === playlistId) return

        const currentKey = AudioPlaylist.getPlayingKey()

        // pause if already playing
        if (options.pauseIfPlaying && active?.id === playlistId && active?.index === index && get(playingAudio)[currentKey]) {
            AudioPlayer.start(audioPath || AudioPlaylist.getPlayingPath(), { name: "" }, { pauseIfPlaying: true, playlistIndex: index, playlistId })
            return
        }

        activePlaylist.set({ id: playlistId, index })

        const crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal(audioPath, index, { crossfade })
    }

    static stop() {
        activePlaylist.set(null)
        const activeAudio = AudioPlaylist.getPlayingKey() || AudioPlaylist.getPlayingPath()
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

    static next(isEnding: boolean = false) {
        const playlist = AudioPlaylist.getActivePlaylist()
        if (get(outLocked) || !playlist) return

        const crossfade = Number(playlist.crossfade) || 0
        AudioPlaylist.nextInternal("", -1, { crossfade, loop: playlist.loop !== false, autoNext: isEnding ? playlist.autoNext !== false : true })
    }

    // the file path as stored in the playlist (used to find the position in the song list)
    static getPlayingPath(): string {
        return get(activePlaylist)?.active || ""
    }

    // the actually playing file key (including index)
    static getPlayingKey(): string {
        return get(activePlaylist)?.activeKey || (get(activePlaylist)?.index !== undefined && get(activePlaylist)?.active ? AudioPlayer.getKey(get(activePlaylist).active, get(activePlaylist).index) : AudioPlaylist.getPlayingPath())
    }

    static getActivePlaylist() {
        const playlistId = get(activePlaylist)?.id || ""
        const playlist = get(audioPlaylists)[playlistId]
        if (!playlist) return null
        return playlist
    }

    private static isCrossfading = false
    static checkCrossfade() {
        const audioKey = AudioPlaylist.getPlayingKey()
        const audioPath = AudioPlaylist.getPlayingPath()
        if (isAllAudioFading || !audioKey || get(media)[audioPath]?.loop) {
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
        const audioKey = AudioPlaylist.getPlayingKey()
        const audioPath = AudioPlaylist.getPlayingPath()
        const playing = AudioPlayer.getAudio(audioKey)
        if (!crossfade || !audioKey || !playing) return 0

        const customCrossfade = crossfade > 3 ? crossfade * 0.6 : crossfade
        const endTime = AudioPlayer.getEndTime(audioPath, playing.duration)
        const reachedEnding = playing.currentTime + customCrossfade + this.extraMargin >= endTime
        if (!reachedEnding) return 0

        AudioPlaylist.nextInternal("", -1, { crossfade: customCrossfade, loop: playlist.loop !== false })
        return crossfade
    }

    protected static async nextInternal(audioPath = "", startIndex = -1, data: PlaylistData) {
        const playlist = clone(AudioPlaylist.getActivePlaylist())
        if (!playlist) return

        const songs = getSongs()
        if (!songs.length) return

        let nextIndex: number
        if (startIndex > -1) {
            nextIndex = startIndex
        } else {
            const currentIndex = get(activePlaylist)?.index ?? -1
            nextIndex = currentIndex + 1
        }

        let nextSong = songs[nextIndex] || audioPath
        if (!nextSong && data.loop) {
            nextIndex = 0
            nextSong = songs[0]
        }

        if (!nextSong) {
            if (!data.loop && !audioIsFading()) {
                if (data.crossfade) fadeOutAudio(data.crossfade)
                else clearAudio("", { playlistCrossfade: true, clearPlaylist: true })

                setTimeout(() => {
                    const previousKey = AudioPlaylist.getPlayingKey()
                    if (!get(playingAudio)[previousKey]) customActionActivation("audio_playlist_ended")
                }, 100)
            }
            return
        }

        const nextKey = AudioPlayer.getKey(nextSong, nextIndex)

        // prevent playing the exact same key twice (while it's fading) to stop duplicate audio
        if (get(playingAudio)[nextKey]) return

        activePlaylist.update((a) => {
            if (!a) a = {}
            a.active = nextSong
            a.activeKey = nextKey // might be changed into an auto located path
            a.index = nextIndex
            return a
        })

        // if (crossfade) isCrossfading = true
        const playlistId = get(activePlaylist)?.id || ""
        const started = await AudioPlayer.start(nextSong, { name: "" }, { pauseIfPlaying: false, crossfade: data.crossfade, playlistCrossfade: true, startPaused: data.autoNext === false, volume: playlist.volume || 1, playlistId, playlistIndex: nextIndex })

        // skip songs that can't be played (e.g. moved/deleted files), so one missing file does not stop the playlist
        if (!started) {
            const cannotPlay = (data.cannotPlay || 0) + 1
            if (cannotPlay >= songs.length) return

            console.error("Could not play playlist audio, skipping:", nextSong)
            AudioPlaylist.nextInternal("", -1, { ...data, cannotPlay: cannotPlay })
        }

        function getSongs(): string[] {
            if (get(activePlaylist)?.songs?.length) return get(activePlaylist).songs

            // generate list
            if (!playlist) return []
            let songsList = playlist.songs || []

            const mode = playlist.mode
            if (mode === "shuffle") songsList = shuffleArray(songsList)

            activePlaylist.update((a) => {
                if (!a) a = {}
                a.songs = songsList
                return a
            })

            return songsList
        }
    }
}
