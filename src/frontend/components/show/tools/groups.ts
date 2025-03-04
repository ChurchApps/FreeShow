import { get } from "svelte/store"
import { cachedShowsData, showsCache } from "../../../stores"
import { getShowCacheId } from "../../helpers/show"
import { sortByName } from "../../helpers/array"

export function getSlideGroups(showId: string, showUpdater: any = get(showsCache), cachedUpdater: any = get(cachedShowsData)) {
    return sortByName(cachedUpdater[getShowCacheId(showId, showUpdater[showId])]?.groups || [], "group")
}

// function orderGroups(a: any, b: any) {
//     const aGroupType = a.group.split(" ")[0]
//     const bGroupType = b.group.split(" ")[0]

//     if (aGroupType !== bGroupType) {
//         return aGroupType.localeCompare(bGroupType)
//     }

//     const groupA = parseInt(a.group.split(" ")[1]) || 0
//     const groupB = parseInt(b.group.split(" ")[1]) || 0
//     return groupA - groupB
// }
