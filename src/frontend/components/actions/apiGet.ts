import { get } from "svelte/store"
import type { Shows } from "../../../types/Show"
import { activePlaylist, audioPlaylists, outputs, playingAudio, playingVideos, projects, shows, showsCache, videosTime } from "../../stores"
import { getActiveOutputs } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import type { API_id_optional, API_slide } from "./api"
import { getLayoutRef } from "../helpers/show"

export function getShows() {
    return get(shows) as Shows
}

export async function getShow({ id }: { id: string }) {
    await loadShows([id])
    return get(showsCache)[id]
}

export async function getShowLayout({ id }: { id: string }) {
    await loadShows([id])
    return getLayoutRef(id)
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

export function getOutputGroupName() {
    const outputId = getActiveOutputs(get(outputs))[0]
    const outputSlide = get(outputs)[outputId]?.out?.slide
    const layoutRef = _show(outputSlide?.id).layouts([outputSlide?.layout]).ref()[0]
    const slideId = layoutRef[outputSlide?.index || -1]?.id
    const slide = _show(outputSlide?.id).get("slides")[slideId]
    return slide?.group || ""
}

export function getPlayingVideoDuration() {
    let outputId = getActiveOutputs(get(outputs))[0]
    let outputPath = get(outputs)[outputId]?.out?.background?.path || ""
    let video = get(playingVideos)[outputPath] || {}
    let time: number = video?.duration || video?.video?.duration || 0
    return time
}

export function getPlayingVideoTime() {
    let outputId = getActiveOutputs(get(outputs))[0]
    let time: number = get(videosTime)[outputId] || 0
    return time
}

export function getPlayingAudioDuration() {
    let audio = Object.values(get(playingAudio))[0]?.audio
    return audio ? audio?.duration || 0 : 0
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
