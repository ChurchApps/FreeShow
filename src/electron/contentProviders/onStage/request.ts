/**
 * WARNING: This file should ONLY be accessed through OnStageProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or OnStageProvider instead.
 *
 * OnStage's presenter API returns services presentation-ready: sections arrive in arrangement
 * order with repeats resolved and lyrics already split into slides, so this file is a plain
 * transport + type mapping layer with no parsing.
 */

import { uid } from "uid"
import { ToMain } from "../../../types/IPC/ToMain"
import type { Show } from "../../../types/Show"
import { sendToMain } from "../../IPC/main"
import { onStageActiveTeam, onStageApiRequest, onStageConnect } from "./connect"
import { getFormatSettings } from "./format"
import { addSongArrangement, createSongBuild, finalizeSongBuild, type OnStageSong, type SongBuild } from "./songBuilder"

type OnStageServiceItem = {
    type: "song" | "moment"
    name: string | null
    notes: string | null
    index: number | null
    durationMs: number
    song: OnStageSong | null
}
type OnStageServiceOverview = { id: string; name: string | null; dateTime: string; location: string | null; itemCount: number; updatedAt: string | null }
// The wire shape PROVIDER_PROJECTS expects — the frontend handler builds the real Project from it.
type ProviderProjectItem = { type: "show" | "section"; id: string; scheduleLength: number; layout?: string; name?: string; notes?: string }
type ProviderProject = { id: string; name: string; scheduledTo: number; created: number; folderId: string; folderName: string; items: ProviderProjectItem[] }
type OnStageServiceDetail = { id: string; name: string | null; dateTime: string; location: string | null; updatedAt: string | null; items: OnStageServiceItem[] }

// a song's show id is derived from its OnStage id, so a reload can find its way back
const SHOW_ID_PREFIX = "onstagesong_"

async function onStageRequest<T>(endpoint: string): Promise<T | null> {
    const access = await onStageConnect("presenter")
    if (!access) {
        sendToMain(ToMain.ALERT, "Not authorized at OnStage (try to disconnect and connect again)")
        return null
    }

    return new Promise((resolve) => {
        onStageApiRequest(`/integrations/v1${endpoint}`, "GET", { Authorization: `Bearer ${access.access_token}` }, {}, (err, result) => {
            if (err) {
                console.error(`Could not get OnStage data at ${endpoint}:`, err.message)
                return resolve(null)
            }
            resolve(result as T)
        })
    })
}

export async function onStageGetTeams(): Promise<{ id: string; name: string; current: boolean }[]> {
    return (await onStageRequest<{ id: string; name: string; current: boolean }[]>("/teams")) || []
}

/**
 * Imported projects are grouped into one folder per OnStage team, so a user connected to several
 * teams keeps their services apart. The team travels on the token; tokens issued before team
 * labels existed fall back to asking the server which team they are bound to.
 */
async function resolveTeamFolder(): Promise<{ id: string; name: string } | null> {
    const active = onStageActiveTeam()
    if (active?.name) return active

    const current = (await onStageGetTeams()).find((team) => team.current)
    return current ? { id: current.id, name: current.name } : null
}

/** Reload one song from OnStage, leaving the schedules and every other song alone. */
export async function onStageReloadSong(showId: string, providerData?: unknown): Promise<void> {
    const songId = showId.startsWith(SHOW_ID_PREFIX) ? showId.slice(SHOW_ID_PREFIX.length) : showId
    if (!songId) return

    await onStageLoadServices(providerData, songId)
}

const RELOAD_NOT_SCHEDULED_MESSAGE = "This song is not scheduled in any OnStage service, so it could not be reloaded"

export async function onStageLoadServices(providerData?: unknown, onlySongId?: string): Promise<void> {
    const format = getFormatSettings(providerData)
    const list = await onStageRequest<{ services: OnStageServiceOverview[]; hasMore: boolean }>("/services")
    if (!list?.services?.length) {
        if (onlySongId) sendToMain(ToMain.ALERT, RELOAD_NOT_SCHEDULED_MESSAGE)
        return
    }

    sendToMain(ToMain.TOAST, onlySongId ? "Reloading song from OnStage" : "Getting schedules from OnStage")

    const teamFolder = await resolveTeamFolder()

    const projects: ProviderProject[] = []
    // A song appearing in several services is ONE show holding one arrangement per structure —
    // each service pins its own arrangement, so a service that plays the song differently no
    // longer decides the structure for all the others.
    const songBuilds: { [showId: string]: SongBuild } = {}

    for (const overview of list.services) {
        const service = await onStageRequest<OnStageServiceDetail>(`/services/${overview.id}`)
        if (!service?.items?.length) continue

        const serviceName = service.name || service.dateTime.slice(0, 10)
        const projectItems: ProviderProjectItem[] = []
        for (const item of service.items) {
            if (item.type === "song" && item.song) {
                // reloading one song still walks every service — that is where its arrangements live
                if (onlySongId && item.song.id !== onlySongId) continue

                const showId = `${SHOW_ID_PREFIX}${item.song.id}`
                const build = songBuilds[showId] || (songBuilds[showId] = createSongBuild(item.song))
                const layoutId = addSongArrangement(build, item.song, format, serviceName)

                projectItems.push({ type: "show", id: showId, layout: layoutId, scheduleLength: Math.round(item.durationMs / 1000) })
            } else if (!onlySongId) {
                projectItems.push({
                    type: "section",
                    id: uid(5),
                    name: item.name || "",
                    scheduleLength: Math.round(item.durationMs / 1000),
                    notes: item.notes || ""
                })
            }
        }
        // a single song reload leaves the schedules untouched
        if (!projectItems.length || onlySongId) continue

        projects.push({
            id: service.id,
            name: service.name || service.dateTime.slice(0, 10),
            scheduledTo: new Date(service.dateTime).getTime(),
            created: new Date(service.updatedAt || service.dateTime).getTime(),
            // no folder rather than an unnamed one, if the team could not be resolved
            folderId: teamFolder?.name ? teamFolder.id : "",
            folderName: teamFolder?.name || "",
            items: projectItems
        })
    }

    const shows: (Show & { id: string })[] = Object.keys(songBuilds).map((showId) => ({ id: showId, ...finalizeSongBuild(songBuilds[showId]) }))

    if (onlySongId && !shows.length) {
        sendToMain(ToMain.ALERT, RELOAD_NOT_SCHEDULED_MESSAGE)
        return
    }

    // an explicit reload of one song means the OnStage version is wanted — no questions asked
    sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "onstage", categoryName: "OnStage", shows, projects, forceReplace: !!onlySongId })
}
