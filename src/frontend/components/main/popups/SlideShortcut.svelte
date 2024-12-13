<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData } from "../../../stores"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"

    let index = $popupData.index
    let mode = $popupData.mode

    let layoutRef: any[] = _show().layouts("active").ref()[0] || []
    let actions = layoutRef[index].data?.actions || {}
    let currentShortcut = (actions.slide_shortcut || {}).key

    onMount(() => {
        popupData.set({})
        if (mode !== "slide_shortcut") activePopup.set(null)
    })

    function keydown(e: any) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (e.key.trim().length !== 1 || !isNaN(e.key)) return

        const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
        if (isSpecial) return

        updateValue(e.key.toLowerCase())
    }

    function updateValue(key: string) {
        currentShortcut = key
        actions.slide_shortcut = { key }
        history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [index] } })

        activePopup.set(null)
    }
</script>

<svelte:window on:keydown={keydown} />

<p style="text-align: center;opacity: 0.7;"><T id="actions.press_to_assign" /></p>

{#if currentShortcut}
    <div class="shortcut">
        {currentShortcut}
    </div>
{/if}

<style>
    .shortcut {
        font-size: 4em;
        /* color: var(--secondary); */
        font-weight: bold;
        text-transform: capitalize;
        text-align: center;
    }
</style>
