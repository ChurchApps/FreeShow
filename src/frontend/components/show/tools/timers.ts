import { get } from "svelte/store"
import { showsCache } from "../../../stores"
import { loadShows } from "../../helpers/setShow"
import { _show } from "../../helpers/shows"

export async function getTimers(showRef: any) {
  let list: any[] = []

  if (showRef.type !== undefined && showRef.type !== "show") return []
  if (!get(showsCache)[showRef.id]) await loadShows([showRef.id])

  let timers = _show(showRef.id)
    .slides()
    .items()
    .get()[0]
    .filter((a: any) => a.type === "timer")

  if (timers.length) {
    timers.forEach((a: any) => {
      list.push({ showId: showRef.id, slideId: a.id, ...a })
    })
  }

  return list
}
