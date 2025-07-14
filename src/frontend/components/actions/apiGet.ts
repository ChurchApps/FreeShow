import { get } from "svelte/store"
import type { Shows } from "../../../types/Show"
import { activePlaylist, audioPlaylists, outputs, playingAudio, playingVideos, projects, shows, showsCache, videosTime } from "../../stores"
import { getTextLines } from "../edit/scripts/textStyle"
import { getActiveOutputs } from "../helpers/output"
import { loadShows } from "../helpers/setShow"
import { getLayoutRef } from "../helpers/show"
import { _show } from "../helpers/shows"
import { variables } from "../../stores"
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
    return getLayoutRef(id)
}

export function getProjects() {
    return get(projects)
}

export function getProject({ id }: { id: string }) {
    return get(projects)[id]
}

export function getOutput(data: API_id_optional) {
    const outputId = data?.id || getActiveOutputs(get(outputs))[0]
    const output = get(outputs)[outputId]
    return output?.out || null
}

export function getOutputSlideText() {
    const outputId = getActiveOutputs(get(outputs))[0]
    const outputSlide = get(outputs)[outputId]?.out?.slide
    const layoutRef = _show(outputSlide?.id).layouts([outputSlide?.layout]).ref()[0] || []
    const slideId = layoutRef[outputSlide?.index ?? -1]?.id
    const slide = _show(outputSlide?.id).get("slides")?.[slideId]
    return getTextLines(slide).join("\n")
}

export function getOutputGroupName() {
    const outputId = getActiveOutputs(get(outputs))[0]
    const outputSlide = get(outputs)[outputId]?.out?.slide
    const layoutRef = _show(outputSlide?.id).layouts([outputSlide?.layout]).ref()[0] || []
    const slideId = layoutRef[outputSlide?.index ?? -1]?.id
    const slide = _show(outputSlide?.id).get("slides")?.[slideId]
    return slide?.group || ""
}

export function getPlayingVideoDuration() {
    const outputId = getActiveOutputs(get(outputs))[0]
    const outputPath = get(outputs)[outputId]?.out?.background?.path || ""
    const video = get(playingVideos)[outputPath] || {}
    const time: number = video?.duration || video?.video?.duration || 0
    return time
}

export function getPlayingVideoTime() {
    const outputId = getActiveOutputs(get(outputs))[0]
    const time: number = get(videosTime)[outputId] || 0
    return time
}

export function getPlayingAudioDuration() {
    const audio = Object.values(get(playingAudio))[0]?.audio
    return audio ? audio?.duration || 0 : 0
}

export function getPlayingAudioTime() {
    const audio = Object.values(get(playingAudio))[0]?.audio
    return audio ? audio?.currentTime || 0 : 0
}

export function getPlayingAudioData() {
    const audioId = Object.keys(get(playingAudio))[0]
    const audio = get(playingAudio)[audioId]
    if (!audio) return

    return { id: audioId, name: audio.name, paused: audio.paused, isMic: audio.isMic, duration: getPlayingAudioDuration() }
}

export function getPlaylists() {
    return get(audioPlaylists)
}

export function getPlayingPlaylist(data: API_id_optional) {
    const id = data?.id || get(activePlaylist)?.id
    return get(audioPlaylists)[id] ? { ...get(audioPlaylists)[id], id } : null
}

export function getSlide(data: API_slide) {
    const slides = _show(data.showId || "active").get("slides") || {}
    const slide = slides[data.slideId || Object.keys(slides)[0]]
    return slide || null
}

export function getVariables() {
    const variableStore = get(variables)
    
    // Transform the variables object to an array with the requested fields
    return Object.entries(variableStore || {}).map(([id, variable]) => ({
        id,
        name: variable.name || "",
        type: variable.type || "number",
        value: variable.number !== undefined ? variable.number : variable.text || "",
        text: variable.text || "",
        enabled: variable.enabled !== false // default to true if not specified
    }))
}

export function getVariable(data: { id?: string; name?: string }) {
    const variableStore = get(variables)
    
    if (!data.id && !data.name) {
        return null // No lookup criteria provided
    }
    
    // Look up by ID first (more efficient)
    if (data.id && variableStore[data.id]) {
        return {
            id: data.id,
            ...variableStore[data.id]
        }
    }
    
    // Look up by name if ID not found or not provided
    if (data.name) {
        const foundEntry = Object.entries(variableStore).find(([_, variable]) => 
            variable.name === data.name
        )
        
        if (foundEntry) {
            const [id, variable] = foundEntry
            return {
                id,
                ...variable
            }
        }
    }
    
    return null // Variable not found
}


