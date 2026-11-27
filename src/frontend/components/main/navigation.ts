import { get } from "svelte/store"
import type { ActiveEdit, Profiles } from "../../../types/Main"
import type { ShowRef, TrimmedShows } from "../../../types/Show"
import type { TopViews } from "../../../types/Tabs"
import { activeEdit, activePage, activeShow } from "../../stores"

// open a top level page (shared by the classic top bar and the modern rail)
export function openPage(id: TopViews) {
    activePage.set(id)

    if (id === "edit") openActiveShow()
}

function openActiveShow() {
    const edit = get(activeEdit)
    const show = get(activeShow)
    const showIsActive = !!show && (show.type || "show") === "show"
    if (!showIsActive) return

    if (!edit.id || (edit.showId && edit.showId !== show?.id)) {
        activeEdit.set({ slide: edit.slide || 0, items: [], showId: show?.id })
    }
}

// the edit page is unavailable without an editable show
export function getEditDisabled(edit: ActiveEdit, show: ShowRef | null, shows: TrimmedShows, profile: Profiles[string] | undefined) {
    const currentShow = shows[show?.id || ""]
    const showProfile = profile?.access?.shows || {}
    const isLocked = currentShow?.locked || showProfile.global === "read" || showProfile[currentShow?.category || ""] === "read"

    if (edit.id && (edit.type || "show") !== "show") return false
    if (show && (show.type || "show") === "show") return !!isLocked

    return show?.type === "pdf" || !show?.id
}
