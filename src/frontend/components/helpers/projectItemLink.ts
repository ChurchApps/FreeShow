import { get } from "svelte/store"
import { uid } from "uid"
import { Main } from "../../../types/IPC/Main"
import type { ProjectShowRef } from "../../../types/Projects"
import { requestMain } from "../../IPC/main"
import { activePopup, activeProject, activeShow, contentProviderData, popupData, projects, shows } from "../../stores"
import { history } from "./history"

// the show's quickAccess key that maps it to a provider's item
export const providerLinkKeys: { [providerId: string]: string } = { planningcenter: "pcoLink", churchApps: "chumsLink", amazinglife: "alLink", onstage: "onstageLink" }

/** the content provider a project syncs from */
export function getProjectProvider(projectId: string, projectsVal = get(projects), providerData = get(contentProviderData)): string | null {
    const project = projectsVal[projectId]
    if (project?.origin) return project.origin === "pco" ? "planningcenter" : project.origin

    // pre 1.6.6 projects have no origin
    if (projectId.startsWith("onstage_")) return "onstage"
    const plans = providerData?.planningcenter?.availablePlans as { planId: string }[] | undefined
    if (plans?.some((p) => p.planId === projectId)) return "planningcenter"
    return null
}

/** the provider whose item this show is linked to */
export function getShowProvider(showId: string): string | null {
    const quickAccess = get(shows)[showId]?.quickAccess || {}
    return Object.keys(providerLinkKeys).find((id) => quickAccess[providerLinkKeys[id]]) || null
}

let providerNames: { [providerId: string]: string } = {}
export async function loadProviderNames() {
    if (Object.keys(providerNames).length) return
    const providers: { providerId: string; displayName: string }[] = (await requestMain(Main.GET_CONTENT_PROVIDERS)) || []
    providerNames = Object.fromEntries(providers.map((p) => [p.providerId, p.displayName]))
}
export function getProviderName(providerId: string) {
    return providerNames[providerId] || providerId
}

// Linking or unlinking a project item by hand marks it manual, so a provider re-sync keeps the choice.

function setItem(projectId: string, index: number, item: ProjectShowRef) {
    const items = [...(get(projects)[projectId]?.shows || [])]
    if (!items[index]) return
    items[index] = item
    history({ id: "UPDATE", newData: { key: "shows", data: items }, oldData: { id: projectId }, location: { page: "show", id: "project_key" } })
    activeShow.set({ id: item.id, type: item.type || "show", index })
}

/** the show item becomes a placeholder named after its show */
export function unlinkProjectItem(index: number, projectId = get(activeProject) || "") {
    const item = get(projects)[projectId]?.shows?.[index]
    if (!item || (item.type || "show") !== "show") return

    const name = get(shows)[item.id]?.name || item.name || "—"
    setItem(projectId, index, { id: uid(5), type: "show_placeholder", name, source: item.source, manual: true })
}

/** the item shows the given show from now on */
export function linkProjectItemTo(index: number, showId: string, projectId = get(activeProject) || "") {
    const item = get(projects)[projectId]?.shows?.[index]
    if (!item || !showId) return

    const linked: ProjectShowRef = { id: showId, type: "show" }
    if (item.source) {
        linked.source = item.source
        linked.manual = true
    }
    if (item.notes) linked.notes = item.notes
    setItem(projectId, index, linked)
}

/** pick a show for the item */
export function linkProjectItem(index: number, projectId = get(activeProject) || "") {
    const item = get(projects)[projectId]?.shows?.[index]
    if (!item) return

    popupData.set({
        action: "select_show",
        active: (item.type || "show") === "show" ? item.id : "",
        trigger: (showId: string) => linkProjectItemTo(index, showId, projectId)
    })
    activePopup.set("select_show")
}
