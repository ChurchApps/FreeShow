import { get } from "svelte/store"
import { projects, shows, showsCache } from "../../stores"
import { loadShows } from "../helpers/setShow"
import type { Shows } from "../../../types/Show"

export function getShows() {
    return get(shows) as Shows
}

export async function getShow({ id }: { id: string }) {
    await loadShows([id])
    return get(showsCache)[id]
}

export function getProjects() {
    return get(projects)
}

export function getProject({ id }: { id: string }) {
    return get(projects)[id]
}
