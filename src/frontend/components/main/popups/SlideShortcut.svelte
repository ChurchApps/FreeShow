<script lang="ts">
    import { onMount } from "svelte"
    import { activePopup, popupData } from "../../../stores"
    import { history } from "../../helpers/history"
    import { getLayoutRef } from "../../helpers/show"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import Tip from "../Tip.svelte"

    const index = $popupData.index
    const mode = $popupData.mode
    const revert = $popupData.revert
    const value = $popupData.active || $popupData.value || ""
    const trigger = $popupData.trigger
    const existingShortcuts = $popupData.existingShortcuts || []

    let layoutRef = mode === "slide_shortcut" ? getLayoutRef() : []
    let slideDataActions = mode === "slide_shortcut" ? layoutRef[index]?.data?.actions || {} : {}
    let currentShortcut = mode === "slide_shortcut" ? (slideDataActions.slide_shortcut || {}).key : value

    onMount(() => {
        if (mode === "action") popupData.set({ ...$popupData, mode: "" })
        else popupData.set({})
        if (mode !== "slide_shortcut" && mode !== "global_group" && mode !== "action") activePopup.set(null)
    })

    function keydown(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
        if (!e.key || e.key.trim().length !== 1 || !isNaN(e.key as any)) return

        const isSpecial = [".", ",", "-", "+", "/", "*", "<", ">", "|", "\\", "¨", "'"].includes(e.key)
        if (isSpecial) return

        updateValue(e.key.toLowerCase())
    }

    let existing = false
    function updateValue(key: string) {
        if (existingShortcuts.find((a: any) => a?.toString().toLowerCase() === key)) {
            existing = true
            return
        }
        existing = false

        currentShortcut = key

        if (mode === "slide_shortcut") {
            slideDataActions.slide_shortcut = { key }
            history({ id: "SHOW_LAYOUT", newData: { key: "actions", data: slideDataActions, indexes: [index] } })
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

{#if existing}
    <Tip type="warning" value="actions.shortcut_existing" />
{:else}
    <Tip value="actions.press_to_assign" />
{/if}

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
