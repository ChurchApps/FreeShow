import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import type { Project, ProjectShowRef } from "../../types/Projects"
import type { Show } from "../../types/Show"
import { activePopup, activeProject, activeShow, popupData, projects, providerItemLinks, shows, showsCache } from "../stores"

export function getProviderItemLink(providerId: ContentProviderId, itemId: string) {
    const link = get(providerItemLinks)[`${providerId}:${itemId}`]
    return link && get(shows)[link.showId] ? link : null
}

export function setProviderItemLink(providerId: ContentProviderId, itemId: string, showId: string, mode?: "online" | "local" | "manual", hash?: string) {
    providerItemLinks.update((a) => {
        const key = `${providerId}:${itemId}`
        return { ...a, [key]: { ...a[key], showId, ...(mode ? { mode } : {}), ...(hash ? { hash } : {}) } }
    })
}

const LEGACY_LINK_KEYS: { [key in ContentProviderId]?: string } = { planningcenter: "pcoLink", churchApps: "chumsLink", amazinglife: "alLink", onstage: "onstageLink" }
export async function syncProviderItemLinks(providerId: ContentProviderId) {
    const links = get(providerItemLinks)

    // DEPRECATED migrate legacy quickAccess links (pre v1.6.8)
    const legacyKey = LEGACY_LINK_KEYS[providerId]
    const legacyShowIds = legacyKey ? Object.keys(get(shows)).filter((id) => get(shows)[id].quickAccess?.[legacyKey]) : []
    if (legacyShowIds.length) {
        await loadShows(legacyShowIds)
        legacyShowIds.forEach((showId) => {
            links[`${providerId}:${get(shows)[showId].quickAccess[legacyKey!]}`] ??= { showId, mode: "online" }
            delete get(shows)[showId].quickAccess[legacyKey!]
            delete get(showsCache)[showId]?.quickAccess?.[legacyKey!]
        })
        shows.update((a) => a)
        showsCache.update((a) => a)
    }

    // remove links to deleted shows
    providerItemLinks.set(Object.fromEntries(Object.entries(links).filter(([key, link]) => !key.startsWith(`${providerId}:`) || get(shows)[link.showId])))
}

function getProviderFromOrigin(origin?: string | null): ContentProviderId | null {
    if (origin === "pco") return "planningcenter"
    return (origin as ContentProviderId) || null
}

function getProjectItemLinkKey(project: Project | null | undefined, item: ProjectShowRef | undefined): string {
    const providerId = getProviderFromOrigin(project?.origin)
    const itemId = item?.providerItemId || item?.id
    return providerId && itemId ? `${providerId}:${itemId}` : ""
}

export function isProjectItemLinked(project: Project | null | undefined, item: ProjectShowRef | undefined, links = get(providerItemLinks)) {
    return !!links[getProjectItemLinkKey(project, item)]
}

export function openLinkProviderDialog(item: { id: string; index?: number }) {
    if (!item?.id) return

    const projectId = get(activeProject)
    const currentProject = projectId ? get(projects)[projectId] : null
    const providerId = getProviderFromOrigin(currentProject?.origin)
    if (!projectId || !currentProject || !providerId) return

    const itemIndex = item.index ?? currentProject.shows?.findIndex((s) => s.id === item.id) ?? -1
    const providerItemId = currentProject.shows?.[itemIndex]?.providerItemId || item.id

    popupData.set({
        action: "select_show",
        active: item.id,
        trigger: (chosenShowId: string) => {
            setProviderItemLink(providerId, providerItemId, chosenShowId, "manual")

            if (itemIndex >= 0) {
                const newShows = [...(currentProject.shows || [])]
                newShows[itemIndex] = { ...newShows[itemIndex], id: chosenShowId }

                history({
                    id: "UPDATE",
                    newData: { key: "shows", data: newShows },
                    oldData: { id: projectId },
                    location: { page: "show", id: "project_key" }
                })

                if (get(activeShow)?.index === itemIndex) activeShow.set({ ...get(activeShow)!, id: chosenShowId })
            }
        }
    })
    activePopup.set("select_show")
}

export function unlinkProjectItems(items: { id: string; index?: number }[]) {
    const projectId = get(activeProject)
    const currentProject = projectId ? get(projects)[projectId] : null
    if (!currentProject) return

    providerItemLinks.update((a) => {
        items.forEach((item) => {
            const index = item.index ?? currentProject.shows?.findIndex((s) => s.id === item.id) ?? -1
            const key = getProjectItemLinkKey(currentProject, currentProject.shows?.[index])
            if (key) delete a[key]
        })
        return a
    })
}

// MERGE PROVIDER ITEMS

export function preserveProviderPlaceholders(projectId: string, data: any) {
    if (data.key !== "shows" || !Array.isArray(data.previousData) || data.previousData.length !== data.data?.length) return

    projects.update((p) => {
        p[projectId]?.shows?.forEach((item, i) => {
            const prev = data.previousData[i]
            if (prev?.type === "show_placeholder" && item?.type !== "show_placeholder" && prev.providerItemId) {
                item.providerItemId = prev.providerItemId
                if (prev.providerHash) item.providerHash = prev.providerHash
            }
        })

        return p
    })
}

function hashStr(str: string): string {
    let h = 2166136261
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return (h >>> 0).toString(36)
}

export function hashProviderShow(show: Partial<Show> | null | undefined): string {
    if (!show) return ""
    const { timestamps: _, layouts: __, slides, ...rest } = show as any
    return hashStr(JSON.stringify({ ...rest, slides: Object.values(slides || {}) }))
}

export function hashProviderProjectItem(item: Partial<ProjectShowRef> | null | undefined): string {
    if (!item) return ""
    const { id, providerHash: _, ...rest } = item
    const type = item.type || "show"
    const includeId = type !== "show" && type !== "section" && type !== "show_placeholder"
    return hashStr(JSON.stringify({ ...rest, ...(includeId ? { id } : {}) }))
}

export function mergeProviderProjectItems(existingShows: ProjectShowRef[], cloudShows: ProjectShowRef[]): ProjectShowRef[] {
    const cloudIds = new Set(cloudShows.map((i) => i.providerItemId).filter(Boolean) as string[])
    const existingById = new Map<string, ProjectShowRef[]>()
    const localAfter = new Map<string | null, ProjectShowRef[]>()
    let anchor: string | null = null

    for (const item of existingShows) {
        const pid = item.providerItemId || ((item.type || "show") === "show" && cloudIds.has(item.id) ? item.id : undefined)
        if (!pid) localAfter.set(anchor, [...(localAfter.get(anchor) || []), item])
        else if (cloudIds.has(pid)) {
            existingById.set(pid, [...(existingById.get(pid) || []), item])
            anchor = pid
        }
    }

    const merged: ProjectShowRef[] = [...(localAfter.get(null) || [])]
    const emitted = new Set<string>()
    for (const cloudItem of cloudShows) {
        const pid = cloudItem.providerItemId
        const existing = pid ? existingById.get(pid)?.shift() : undefined
        merged.push(existing?.providerHash && existing.providerHash === cloudItem.providerHash ? existing : cloudItem)
        if (pid && !emitted.has(pid)) {
            emitted.add(pid)
            merged.push(...(localAfter.get(pid) || []))
        }
    }

    return merged
}
