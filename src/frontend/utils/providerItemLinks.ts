import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import { activePopup, activeProject, activeShow, popupData, projects, providerItemLinks, shows, showsCache } from "../stores"

export function getProviderItemLink(providerId: ContentProviderId, itemId: string) {
    const link = get(providerItemLinks)[`${providerId}:${itemId}`]
    return link && get(shows)[link.showId] ? link : null
}

export function setProviderItemLink(providerId: ContentProviderId, itemId: string, showId: string, mode: "online" | "local" | "manual") {
    providerItemLinks.update((a) => ({ ...a, [`${providerId}:${itemId}`]: { showId, mode } }))
}

export function isShowLinked(showId: string, links = get(providerItemLinks)) {
    return Object.values(links).some((link) => link.showId === showId)
}

export function removeProviderLinks(showIds: string[]) {
    providerItemLinks.update((a) => Object.fromEntries(Object.entries(a).filter(([, link]) => !showIds.includes(link.showId))))
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
function getProviderItemIdFromShowId(showId: string, providerId: ContentProviderId, links = get(providerItemLinks)): string | null {
    const entry = Object.entries(links).find(([key, link]) => key.startsWith(`${providerId}:`) && link.showId === showId)
    if (entry) return entry[0].slice(providerId.length + 1)
    return showId
}

export function openLinkProviderDialog(item: { id: string; index?: number }) {
    if (!item?.id) return

    const projectId = get(activeProject)
    const currentProject = projectId ? get(projects)[projectId] : null
    const providerId = getProviderFromOrigin(currentProject?.origin)
    if (!providerId) return

    const currentShowId = item.id
    const providerItemId = getProviderItemIdFromShowId(currentShowId, providerId) || currentShowId
    const itemIndex = item.index ?? currentProject?.shows?.findIndex((s) => s.id === currentShowId)

    popupData.set({
        action: "select_show",
        active: currentShowId,
        trigger: (chosenShowId: string) => {
            setProviderItemLink(providerId, providerItemId, chosenShowId, "manual")

            if (projectId && currentProject && itemIndex !== undefined && itemIndex >= 0) {
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
