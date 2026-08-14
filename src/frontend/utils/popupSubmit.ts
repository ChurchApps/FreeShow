import { onDestroy } from "svelte"
import { popupSubmit } from "../stores"

/**
 * Makes Enter trigger a popup's primary action.
 *
 * Opt in from a popup component's top level script, e.g. `registerPopupSubmit(create)`.
 * Popup.svelte owns the key handling (and skips textareas, buttons, editboxes, ...),
 * so popups that already have their own Enter handling must NOT use this.
 *
 * The callback may no-op when the primary button isn't currently available.
 */
export function registerPopupSubmit(submit: () => void) {
    popupSubmit.set(submit)

    onDestroy(() => {
        // the outgoing popup is destroyed after its transition, which can be after the next
        // one mounted - so only clear this if nothing else registered in the meantime
        popupSubmit.update((current) => (current === submit ? null : current))
    })
}
