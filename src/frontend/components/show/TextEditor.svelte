<script lang="ts">
    import type { Show } from "../../../types/Show"
    import { getQuickExample } from "../../converters/txt"
    import { activePopup, textEditZoom } from "../../stores"
    import { transposeText } from "../../utils/chordTranspose"
    import { newToast } from "../../utils/common"
    import { translateText } from "../../utils/language"
    import { getNormalizedKey } from "../../utils/shortcuts"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import { formatText } from "./formatTextEditor"
    import { getPlainEditorText } from "./getTextEditor"
    import HighlightedNotes from "./tools/HighlightedNotes.svelte"

    export let currentShow: Show | undefined

    let text = ""
    $: if (currentShow) text = getPlainEditorText("", false, itemIndex)

    $: hasLockedSlide = Object.values(currentShow?.slides || {}).some((a) => a?.locked)
    $: isLocked = currentShow?.locked || hasLockedSlide
    $: if (isLocked) newToast("output.state_locked")

    // item index
    let itemIndex = 0

    $: maxTextboxes = Object.values(currentShow?.slides || {}).reduce((max, slide) => {
        const count = (slide?.items || []).reduce((c, item) => c + ((item?.type || "text") === "text" || item?.lines ? 1 : 0), 0)
        return Math.max(max, count)
    }, 0)

    $: if (itemIndex > maxTextboxes) itemIndex = 0

    function increaseItemIndex() {
        if (itemIndex < maxTextboxes) itemIndex++
    }
    function decreaseItemIndex() {
        if (itemIndex > 0) itemIndex--
    }

    // Ctrl+F in shortcuts.ts does not get triggered when a text input is active, so we trigger from here as well
    function keydown(e: any) {
        if (e.shiftKey || e.altKey) return

        const ctrlKey = e.ctrlKey || e.metaKey ? getNormalizedKey(e) : ""

        if (ctrlKey === "f") activePopup.set("find_replace")
    }

    // transpose chords
    function transposeUp() {
        formatText(transposeText(text, 1))
    }
    function transposeDown() {
        formatText(transposeText(text, -1))
    }

    $: showHasChords = Object.values(currentShow?.slides || {}).some((a) => a?.items?.some((a) => a.lines?.some((a) => a.chords)))
</script>

<HighlightedNotes class="context #editbox_text" disabled={isLocked} style="padding: 30px;padding-bottom: 60px;font-size: {$textEditZoom / 8}em;" placeholder={getQuickExample()} value={text} on:change={(e) => formatText(e.detail, "", itemIndex)} on:keydown={keydown} />

<FloatingInputs side="left">
    {#if showHasChords && itemIndex === 0}
        <MaterialButton on:click={transposeUp} title="edit.transpose_up">
            <Icon id="arrow_up" size={1.3} white />
        </MaterialButton>
        <MaterialButton on:click={transposeDown} title="edit.transpose_down">
            <Icon id="arrow_down" size={1.3} white />
        </MaterialButton>
    {/if}

    <MaterialZoom hidden={showHasChords && itemIndex === 0} columns={$textEditZoom / 10} min={0.5} max={2} defaultValue={1} addValue={-0.1} on:change={(e) => textEditZoom.set(e.detail * 10)} />
</FloatingInputs>

{#if maxTextboxes > 1}
    <FloatingInputs side="right">
        <MaterialButton disabled={itemIndex <= 0} on:click={decreaseItemIndex} title="media.previous">
            <Icon id="remove" size={1.1} white />
        </MaterialButton>
        <MaterialButton on:click={() => (itemIndex = 0)} title={itemIndex > 0 ? "actions.reset" : ""} style="min-width: 45px;">
            <span style="font-size: 0.85em;opacity: 0.8;font-weight: 500;">
                {itemIndex === 0 ? translateText("category.all") : `#${itemIndex}`}
            </span>
        </MaterialButton>
        <MaterialButton disabled={itemIndex >= maxTextboxes} on:click={increaseItemIndex} title="media.next">
            <Icon id="add" size={1.1} white />
        </MaterialButton>
    </FloatingInputs>
{/if}
