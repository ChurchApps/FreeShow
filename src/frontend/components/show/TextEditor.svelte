<script lang="ts">
    import type { Show } from "../../../types/Show"
    import { getQuickExample } from "../../converters/txt"
    import { includeEmptySlides, textEditActive, textEditZoom } from "../../stores"
    import { transposeText } from "../../utils/chordTranspose"
    import Icon from "../helpers/Icon.svelte"
    import FloatingInputs from "../input/FloatingInputs.svelte"
    import MaterialButton from "../inputs/MaterialButton.svelte"
    import MaterialZoom from "../inputs/MaterialZoom.svelte"
    import { formatText } from "./formatTextEditor"
    import { getPlainEditorText } from "./getTextEditor"
    import Notes from "./tools/Notes.svelte"

    export let currentShow: Show | undefined

    $: allowEmpty = $includeEmptySlides

    let text = ""
    $: if (currentShow) text = getPlainEditorText("", allowEmpty)

    // transpose chords
    function transposeUp() {
        formatText(transposeText(text, 1))
    }
    function transposeDown() {
        formatText(transposeText(text, -1))
    }

    $: showHasChords = Object.values(currentShow?.slides || {}).find((a) => a.items?.find((a) => a.lines?.find((a) => a.chords)))
</script>

<Notes disabled={currentShow?.locked} style="padding: 30px;height: calc(100% - 28px);font-size: {$textEditZoom / 8}em;" placeholder={getQuickExample()} value={text} on:change={(e) => formatText(e.detail)} />

<FloatingInputs arrow let:open>
    <MaterialZoom hidden={!open} columns={$textEditZoom / 10} min={0.5} max={2} defaultValue={1} addValue={-0.1} on:change={(e) => textEditZoom.set(e.detail * 10)} />

    {#if open}
        <div class="divider"></div>
    {/if}

    <MaterialButton isActive title="show.text" on:click={() => textEditActive.set(false)}>
        <Icon id="text_edit" white />
    </MaterialButton>
</FloatingInputs>

{#if showHasChords}
    <FloatingInputs side="left">
        <MaterialButton on:click={transposeUp} title="edit.transpose_up">
            <Icon id="arrow_up" size={1.3} white />
        </MaterialButton>
        <MaterialButton on:click={transposeDown} title="edit.transpose_down">
            <Icon id="arrow_down" size={1.3} white />
        </MaterialButton>
    </FloatingInputs>
{/if}
