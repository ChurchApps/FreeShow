import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { loadShows } from "../components/helpers/setShow"
import { providerItemLinks, shows, showsCache } from "../stores"

export function getProviderItemLink(providerId: ContentProviderId, itemId: string) {
    const link = get(providerItemLinks)[`${providerId}:${itemId}`]
    return link && get(shows)[link.showId] ? link : null
}

export function setProviderItemLink(providerId: ContentProviderId, itemId: string, showId: string, mode: "online" | "local") {
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
