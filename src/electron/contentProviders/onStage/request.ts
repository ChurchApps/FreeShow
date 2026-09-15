/**
 * WARNING: This file should ONLY be accessed through OnStageProvider.
 * Do not import or use functions from this file directly in other parts of the application.
 * Use ContentProviderRegistry or OnStageProvider instead.
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
type ProviderProjectItem = { type: "show" | "section"; id: string; scheduleLength: number; layout?: string; name?: string; notes?: string }
type ProviderProject = { id: string; name: string; scheduledTo: number; created: number; folderId: string; folderName: string; items: ProviderProjectItem[] }
type OnStageServiceDetail = { id: string; name: string | null; dateTime: string; location: string | null; updatedAt: string | null; items: OnStageServiceItem[] }

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

/** Projects are grouped into one folder per OnStage team. */
async function resolveTeamFolder(): Promise<{ id: string; name: string } | null> {
    const active = onStageActiveTeam()
    if (active?.name) return active

    const current = (await onStageGetTeams()).find((team) => team.current)
    return current ? { id: current.id, name: current.name } : null
}

/** Loads every upcoming service, or just one when a project is refreshed. */
export async function onStageLoadServices(providerData?: unknown, onlyServiceId?: string): Promise<void> {
    const format = getFormatSettings(providerData)
    const list = await onStageRequest<{ services: OnStageServiceOverview[]; hasMore: boolean }>("/services")
    if (!list?.services?.length) return

    sendToMain(ToMain.TOAST, "Getting schedules from OnStage")

    const teamFolder = await resolveTeamFolder()

    const projects: ProviderProject[] = []
    // one show per song, holding one arrangement per service structure
    const songBuilds: { [showId: string]: SongBuild } = {}

    for (const overview of list.services) {
        if (onlyServiceId && overview.id !== onlyServiceId) continue

        const service = await onStageRequest<OnStageServiceDetail>(`/services/${overview.id}`)
        if (!service?.items?.length) continue

        const serviceName = service.name || service.dateTime.slice(0, 10)
        const projectItems: ProviderProjectItem[] = []
        for (const item of service.items) {
            if (item.type === "song" && item.song) {
                const showId = `${SHOW_ID_PREFIX}${item.song.id}`
                const build = songBuilds[showId] || (songBuilds[showId] = createSongBuild(item.song))
                const layoutId = addSongArrangement(build, item.song, format, serviceName)

                projectItems.push({ type: "show", id: showId, layout: layoutId, scheduleLength: Math.round(item.durationMs / 1000) })
            } else {
                projectItems.push({
                    type: "section",
                    id: uid(5),
                    name: item.name || "",
                    scheduleLength: Math.round(item.durationMs / 1000),
                    notes: item.notes || ""
                })
            }
        }
        if (!projectItems.length) continue

        projects.push({
            id: service.id,
            name: service.name || service.dateTime.slice(0, 10),
            scheduledTo: new Date(service.dateTime).getTime(),
            created: new Date(service.updatedAt || service.dateTime).getTime(),
            folderId: teamFolder?.name ? teamFolder.id : "",
            folderName: teamFolder?.name || "",
            items: projectItems
        })
    }

    const shows: (Show & { id: string })[] = Object.keys(songBuilds).map((showId) => ({ id: showId, ...finalizeSongBuild(songBuilds[showId]) }))

    sendToMain(ToMain.PROVIDER_PROJECTS, { providerId: "onstage", categoryName: "OnStage", shows, projects })
}
