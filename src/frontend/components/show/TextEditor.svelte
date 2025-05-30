<script lang="ts">
    import { slide } from "svelte/transition"
    import { getQuickExample } from "../../converters/txt"
    import { dictionary, includeEmptySlides, labelsDisabled, textEditActive, textEditZoom } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import { formatText } from "./formatTextEditor"
    import { getPlainEditorText } from "./getTextEditor"
    import Notes from "./tools/Notes.svelte"
    import { transposeText } from "../../utils/chordTranspose"
    import type { Show } from "../../../types/Show"

    export let currentShow: Show | undefined

    $: allowEmpty = $includeEmptySlides

    let text = ""
    $: if (currentShow) text = getPlainEditorText("", allowEmpty)

    // menu
    let zoomOpened = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }

    // transpose chords
    function transposeUp() {
        formatText(transposeText(text, 1))
    }
    function transposeDown() {
        formatText(transposeText(text, -1))
    }

    // shortcut
    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return
        if (!e.target.closest(".paper")) return

        textEditZoom.set(Math.max(3, Math.min(20, $textEditZoom + (e.deltaY < 0 ? 1 : -1))))

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    $: showHasChords = Object.values(currentShow?.slides || {}).find((a) => a.items?.find((a) => a.lines?.find((a) => a.chords)))
</script>

<svelte:window on:mousedown={mousedown} on:wheel={wheel} />

<Notes disabled={currentShow?.locked} style="padding: 30px;height: calc(100% - 28px);font-size: {$textEditZoom / 8}em;" placeholder={getQuickExample()} value={text} on:change={(e) => formatText(e.detail)} />

<div class="actions">
    <div class="left">
        {#if showHasChords}
            <div class="transpose-toolbar">
                <Button class="transpose-btn" on:click={transposeUp} title={$dictionary.edit?.transpose_up}>
                    <Icon id="arrow_up" size={1.3} white />
                </Button>
                <Button class="transpose-btn" on:click={transposeDown} title={$dictionary.edit?.transpose_down}>
                    <Icon id="arrow_down" size={1.3} white />
                </Button>
            </div>
        {/if}
    </div>

    <Button on:click={() => textEditActive.set(false)} style="cursor: pointer;" active>
        <Icon id="text" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<p><T id="show.text" /></p>{/if}
    </Button>

    <div class="seperator" />

    <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
        <Icon size={1.3} id="zoomIn" white />
    </Button>
    {#if zoomOpened}
        <div class="zoom_container" transition:slide={{ duration: 150 }}>
            <Button style="padding: 0 !important;width: 100%;" on:click={() => textEditZoom.set(10)} bold={false} center>
                <p class="text" title={$dictionary.actions?.resetZoom}>{(($textEditZoom / 10) * 100).toFixed()}%</p>
            </Button>
            <Button disabled={$textEditZoom >= 20} on:click={() => textEditZoom.set(Math.min(20, $textEditZoom + 1))} title={$dictionary.actions?.zoomIn}>
                <Icon size={1.3} id="add" white />
            </Button>
            <Button disabled={$textEditZoom <= 3} on:click={() => textEditZoom.set(Math.max(3, $textEditZoom - 1))} title={$dictionary.actions?.zoomOut}>
                <Icon size={1.3} id="remove" white />
            </Button>
        </div>
    {/if}
</div>

<style>
    .left {
        flex: 1;
        height: 100%;
    }

    .transpose-toolbar {
        display: flex;
    }

    .actions {
        position: absolute;
        bottom: 0;

        width: 100%;
        height: 28px;

        display: flex;
        align-items: center;
        justify-content: end;
        background-color: var(--primary-darkest);
        /* border-top: 3px solid var(--primary-lighter); */
    }

    /* fixed height for consistent heights */
    .actions :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }

    .seperator {
        width: 1px;
        height: 100%;
        background-color: var(--primary);
        /* margin: 0 10px; */
    }

    .zoom_container {
        position: absolute;
        inset-inline-end: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;
        z-index: 30;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter);
    border-top: 3px solid var(--primary-lighter); */
        background-color: inherit;
    }
</style>
