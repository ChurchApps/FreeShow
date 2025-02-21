<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData } from "../../../stores"
    import { history } from "../../helpers/history"
    import { _show } from "../../helpers/shows"
    import T from "../../helpers/T.svelte"

    let index = $popupData.index
    let mode = $popupData.mode
    let value = $popupData.value || ""
    let trigger = $popupData.trigger
    let existingShortcuts = $popupData.existingShortcuts || []

    let layoutRef: any[] = mode === "slide_shortcut" ? _show().layouts("active").ref()[0] || [] : []
    let actions = mode === "slide_shortcut" ? layoutRef[index].data?.actions || {} : {}
    let currentShortcut = mode === "slide_shortcut" ? (actions.slide_shortcut || {}).key : value

    onMount(() => {
        popupData.set({})
        if (mode !== "slide_shortcut" && mode !== "global_group") activePopup.set(null)
    })

    function keydown(e: any) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (e.key.trim().length !== 1 || !isNaN(e.key)) return

        const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
        if (isSpecial) return

        updateValue(e.key.toLowerCase())
    }

    let existing: boolean = false
    function updateValue(key: string) {
        if (existingShortcuts.find((a) => a.toLowerCase() === key)) {
            existing = true
            return
        }
        existing = false

        currentShortcut = key

        if (mode === "slide_shortcut") {
            actions.slide_shortcut = { key }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: actions, indexes: [index] } })
        } else if (trigger) {
            trigger(key)
        }

        activePopup.set(null)
    }
</script>

<svelte:window on:keydown={keydown} />

<p style="text-align: center;opacity: 0.7;" class:existing>
    {#if existing}
        <T id="actions.shortcut_existing" />
    {:else}
        <T id="actions.press_to_assign" />
    {/if}
</p>

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

    .existing {
        opacity: 0.9 !important;
        font-size: 1.1em;
        /* font-weight: bold; */
    }
</style>
