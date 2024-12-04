import { get } from "svelte/store"
import { cachedShowsData, showsCache } from "../../../stores"
import { getShowCacheId } from "../../helpers/show"

export function getSlideGroups(showId: string, showUpdater: any = get(showsCache), cachedUpdater: any = get(cachedShowsData)) {
    return cachedUpdater[getShowCacheId(showId, showUpdater[showId])]?.groups.sort(orderGroups) || []
}

function orderGroups(a: any, b: any) {
    const aGroupType = a.group.split(" ")[0]
    const bGroupType = b.group.split(" ")[0]

    if (aGroupType !== bGroupType) {
        return aGroupType.localeCompare(bGroupType)
    }

    const groupA = Number.parseInt(a.group.split(" ")[1]) || 0
    const groupB = Number.parseInt(b.group.split(" ")[1]) || 0
    return groupA - groupB
}
