import { get } from "svelte/store"
import { cachedShowsData, groups, showsCache } from "../../../stores"
import { getShowCacheId } from "../../helpers/show"
import { sortByName } from "../../helpers/array"
import { translateText } from "../../../utils/language"

export function getSlideGroups(showId: string, showUpdater = get(showsCache), cachedUpdater = get(cachedShowsData)) {
    return sortByName(cachedUpdater[getShowCacheId(showId, showUpdater[showId])]?.groups || [], "group") as any
}

export function getGlobalGroupName(groupId: string) {
    const group = get(groups)[groupId]
    if (!group) return ""
    if (group.default) return translateText("groups." + group.name)
    return group.name || "—"
}
