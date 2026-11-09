import { get } from "svelte/store"
import type { ContentProviderId } from "../../electron/contentProviders/base/types"
import { history } from "../components/helpers/history"
import { loadShows } from "../components/helpers/setShow"
import type { Project, ProjectShowRef } from "../../types/Projects"
import { activePopup, activeProject, activeShow, popupData, projects, providerItemLinks, shows, showsCache } from "../stores"

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

/** the link key of a provider project item */
export function getProjectItemLinkKey(project: Project | null | undefined, item: ProjectShowRef | undefined, links = get(providerItemLinks)): string {
    const providerId = getProviderFromOrigin(project?.origin)
    if (!providerId || !item?.id) return ""
    if (item.providerItemId) return `${providerId}:${item.providerItemId}`

    // DEPRECATED items imported before they kept their provider item (pre v1.6.8)
    const entry = Object.entries(links).find(([key, link]) => key.startsWith(`${providerId}:`) && link.showId === item.id)
    return entry ? entry[0] : `${providerId}:${item.id}`
}

export function isProjectItemLinked(project: Project | null | undefined, item: ProjectShowRef | undefined, links = get(providerItemLinks)) {
    const key = getProjectItemLinkKey(project, item, links)
    return !!key && !!links[key]
}

type ProviderItemLink = { showId: string; mode: "online" | "local" | "manual" }
export type ProviderLinkChange = { index: number; showId?: string; key: string; link: ProviderItemLink | null }

/** applies item show and link changes together, returning the previous values (used by history) */
export function applyProviderLinkChanges(projectId: string, changes: ProviderLinkChange[]): ProviderLinkChange[] {
    const links = get(providerItemLinks)
    const previous = changes.map(({ index, showId, key }) => ({ index, showId: showId === undefined ? undefined : get(projects)[projectId]?.shows?.[index]?.id, key, link: links[key] || null }))

    providerItemLinks.update((a) => {
        changes.forEach(({ key, link }) => {
            if (link) a[key] = link
            else delete a[key]
        })
        return a
    })

    projects.update((a) => {
        const items = a[projectId]?.shows
        if (!items) return a
        changes.forEach(({ index, showId }) => {
            if (showId !== undefined && items[index]) items[index] = { ...items[index], id: showId }
        })
        return a
    })

    const active = get(activeShow)
    const changed = changes.find((a) => a.showId !== undefined && a.index === active?.index)
    if (active && changed && get(activeProject) === projectId) activeShow.set({ ...active, id: changed.showId! })

    return previous
}

function changeProjectItemLinks(projectId: string, changes: ProviderLinkChange[]) {
    if (!changes.length) return
    history({ id: "PROVIDER_LINK", newData: { projectId, changes }, location: { page: "show" } })
}

export function openLinkProviderDialog(item: { id: string; index?: number }) {
    if (!item?.id) return

    const projectId = get(activeProject)
    const currentProject = projectId ? get(projects)[projectId] : null
    if (!projectId || !currentProject) return

    const index = item.index ?? currentProject.shows?.findIndex((s) => s.id === item.id) ?? -1
    const key = getProjectItemLinkKey(currentProject, currentProject.shows?.[index])
    if (index < 0 || !key) return

    popupData.set({
        action: "select_show",
        active: item.id,
        trigger: (showId: string) => changeProjectItemLinks(projectId, [{ index, showId, key, link: { showId, mode: "manual" } }])
    })
    activePopup.set("select_show")
}

/** the items keep their shows, and the next sync decides them again */
export function unlinkProjectItems(items: { id: string; index?: number }[]) {
    const projectId = get(activeProject)
    const currentProject = projectId ? get(projects)[projectId] : null
    if (!projectId || !currentProject) return

    const links = get(providerItemLinks)
    const changes = items
        .map((item) => {
            const index = item.index ?? currentProject.shows?.findIndex((s) => s.id === item.id) ?? -1
            return { index, key: getProjectItemLinkKey(currentProject, currentProject.shows?.[index], links), link: null }
        })
        .filter((a) => a.key && links[a.key])
    changeProjectItemLinks(projectId, changes)
}
