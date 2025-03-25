import { get } from "svelte/store"
import { cachedShowsData, showsCache } from "../../../stores"
import { getShowCacheId } from "../../helpers/show"
import { sortByName } from "../../helpers/array"

export function getSlideGroups(showId: string, showUpdater = get(showsCache), cachedUpdater = get(cachedShowsData)) {
    return sortByName(cachedUpdater[getShowCacheId(showId, showUpdater[showId])]?.groups || [], "group") as any
}
