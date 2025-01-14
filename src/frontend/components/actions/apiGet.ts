import { get } from "svelte/store"
import type { Shows } from "../../../types/Show"
import { activePlaylist, audioPlaylists, outputs, playingAudio, projects, shows, showsCache, videosTime } from "../../stores"
import { getActiveOutputs } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import type { API_id_optional, API_slide } from "./api"

export function getShows() {
    return get(shows) as Shows
}

export async function getShow({ id }: { id: string }) {
    await loadShows([id])
    return get(showsCache)[id]
}

export async function getShowLayout({ id }: { id: string }) {
    await loadShows([id])
    return _show(id).layouts("active").ref()[0]
}

export function getProjects() {
    return get(projects)
}

export function getProject({ id }: { id: string }) {
    return get(projects)[id]
}

export function getOutput(data: API_id_optional) {
    let outputId = data?.id || getActiveOutputs(get(outputs))[0]
    let output = get(outputs)[outputId]
    return output?.out || null
}

export function getPlayingVideoTime() {
    let outputId = getActiveOutputs(get(outputs))[0]
    let time = get(videosTime)[outputId]
    return time || 0
}

export function getPlayingAudioTime() {
    let audio = Object.values(get(playingAudio))[0]?.audio
    return audio ? audio?.currentTime || 0 : 0
}

export function getPlaylists() {
    return get(audioPlaylists)
}

export function getPlayingPlaylist(data: API_id_optional) {
    let id = data?.id || get(activePlaylist)?.id
    return get(audioPlaylists)[id] ? { ...get(audioPlaylists)[id], id } : null
}

export function getSlide(data: API_slide) {
    let slides = _show(data.showId || "active").get("slides") || {}
    let slide = slides[data.slideId || Object.keys(slides)[0]]
    return slide || null
}
