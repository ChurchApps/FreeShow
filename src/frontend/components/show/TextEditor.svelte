<script lang="ts">
    import type { Show } from "../../../types/Show"
    import { getQuickExample } from "../../converters/txt"
    import { activePopup, textEditZoom } from "../../stores"
    import { transposeText } from "../../utils/chordTranspose"
    import { newToast } from "../../utils/common"
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
    $: if (currentShow) text = getPlainEditorText()

    $: hasLockedSlide = Object.values(currentShow?.slides || {}).some((a) => a?.locked)
    $: isLocked = currentShow?.locked || hasLockedSlide
    $: if (isLocked) newToast("output.state_locked")

    // Ctrl+F in shortcuts.ts does not get triggered when a text input is active, so we trigger from here as well
    function keydown(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        // Ctrl+Shift+F is focus mode, and the normalized key is case folded, so exclude it explicitly
        if (e.shiftKey || e.altKey) return
        // normalized so this works on non-latin keyboard layouts
        if (getNormalizedKey(e).toLowerCase() === "f") activePopup.set("find_replace")
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

<HighlightedNotes class="context #editbox_text" disabled={isLocked} style="padding: 30px;padding-bottom: 60px;font-size: {$textEditZoom / 8}em;" placeholder={getQuickExample()} value={text} on:change={(e) => formatText(e.detail)} on:keydown={keydown} />

<FloatingInputs side="left">
    {#if showHasChords}
        <MaterialButton on:click={transposeUp} title="edit.transpose_up">
            <Icon id="arrow_up" size={1.3} white />
        </MaterialButton>
        <MaterialButton on:click={transposeDown} title="edit.transpose_down">
            <Icon id="arrow_down" size={1.3} white />
        </MaterialButton>
    {/if}

    <MaterialZoom hidden={showHasChords} columns={$textEditZoom / 10} min={0.5} max={2} defaultValue={1} addValue={-0.1} on:change={(e) => textEditZoom.set(e.detail * 10)} />
</FloatingInputs>
