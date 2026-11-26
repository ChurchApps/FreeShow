import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import type { Project, ProjectShowRef } from "../../types/Projects"
import { activePopup, activeProject, activeShow, popupData, projects, providerItemLinks, shows, showsCache } from "../stores"
import { fillPlaceholderItem } from "./providerProjectItems"

export function getProviderItemLink(providerId: ContentProviderId, itemId: string) {
    const link = get(providerItemLinks)[`${providerId}:${itemId}`]
    return link && get(shows)[link.showId] ? link : null
}

export function setProviderItemLink(providerId: ContentProviderId, itemId: string, showId: string, mode: "online" | "local" | "manual") {
    providerItemLinks.update((a) => ({ ...a, [`${providerId}:${itemId}`]: { showId, mode } }))
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

// remember what the user put in a placeholder, so the next sync does not replace it
export function fillProviderPlaceholder(project: Project | null | undefined, replaced: ProjectShowRef | undefined, item: ProjectShowRef) {
    const providerId = getProviderFromOrigin(project?.origin)
    if (!providerId) return item

    const filled = fillPlaceholderItem(replaced, item)
    if (filled !== item && filled.providerItemId && (filled.type || "show") === "show") setProviderItemLink(providerId, filled.providerItemId, filled.id, "manual")
    return filled
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
                const current = newShows[itemIndex]
                let linked: ProjectShowRef = { ...current, id: chosenShowId }
                // a linked placeholder becomes a show item
                if (linked.type === "show_placeholder") {
                    linked.type = "show"
                    delete linked.name
                    delete linked.data
                    if (!linked.providerItemId) linked = fillPlaceholderItem(current, linked)
                }
                newShows[itemIndex] = linked

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
