<script lang="ts">
    import { onMount } from "svelte"
    import { actions, activePopup, popupData } from "../../../stores"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    let id = $popupData.id
    let index = $popupData.index
    let mode = $popupData.mode
    let revert = $popupData.revert
    let value = $popupData.active || $popupData.value || ""
    let trigger = $popupData.trigger
    let existingShortcuts = $popupData.existingShortcuts || []

    let layoutRef = mode === "slide_shortcut" ? getLayoutRef() : []
    let slideDataActions = mode === "slide_shortcut" ? layoutRef[index].data?.actions || {} : {}
    let currentShortcut = mode === "slide_shortcut" ? (slideDataActions.slide_shortcut || {}).key : value

    onMount(() => {
        if (mode === "action") popupData.set({ ...$popupData, mode: "" })
        else popupData.set({})
        if (mode !== "slide_shortcut" && mode !== "global_group" && mode !== "action") activePopup.set(null)
    })

    function keydown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (e.key.trim().length !== 1 || !isNaN(e.key as any)) return

        const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
        if (isSpecial) return

        updateValue(e.key.toLowerCase())
    }

    let existing = false
    function updateValue(key: string) {
        if (existingShortcuts.find((a) => a.toLowerCase() === key)) {
            existing = true
            return
        }
        existing = false

        currentShortcut = key

        if (mode === "slide_shortcut") {
            slideDataActions.slide_shortcut = { key }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: slideDataActions, indexes: [index] } })
        } else if (mode === "action") {
            actions.update((a) => {
                if (a[id]) a[id].keypressActivate = key
                return a
            })
        } else if (trigger) {
            trigger(key)
        }

        activePopup.set(revert || null)
    }
</script>

<svelte:window on:keydown={keydown} />

{#if revert}
    <MaterialButton class="popup-back" icon="back" iconSize={1.3} title="actions.back" on:click={() => activePopup.set(revert)} />
{/if}

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
