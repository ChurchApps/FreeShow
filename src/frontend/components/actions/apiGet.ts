import { get } from "svelte/store"
import type { Shows } from "../../../types/Show"
import { projects, shows, showsCache } from "../../stores"
import { loadShows } from "../helpers/setShow"

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
