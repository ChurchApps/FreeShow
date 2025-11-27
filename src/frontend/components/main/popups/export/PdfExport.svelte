<script lang="ts">
    import { Show } from "../../../../../types/Show"
    import { translateText } from "../../../../utils/language"
    import Pdf from "../../../export/Pdf.svelte"
    import T from "../../../helpers/T.svelte"
    import MaterialButton from "../../../inputs/MaterialButton.svelte"
    import MaterialCheckbox from "../../../inputs/MaterialCheckbox.svelte"
    import MaterialDropdown from "../../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../../inputs/MaterialNumberInput.svelte"

    export let pdfOptions: any
    export let previewShow: Show | null

    let paper: any = null

    if (!Object.keys(pdfOptions).length) {
        pdfOptions = {
            type: "default",

            title: true,
            metadata: true,
            invert: false,
            groups: true,
            numbers: true,
            // repeats: false,
            // notes: false,
            pageNumbers: true,
            grid: [3, 6],
            oneFile: false,
            originalTextSize: true,
            textSize: 80,

            // Chord sheet specific options
            artist: true,
            key: true,
            showChords: false,
            showNotes: true,
            fontSize: 15,
            chordFontSize: 15,
            margin: 20,
            spacing: 2,
            columnsPerPage: 2
        }
    }

    $: pdfTypeOptions = [{ value: "default", label: translateText("example.default") }, { value: "text", label: translateText("export.text") }, { value: "slides", label: translateText("export.slides") }, ...(showHasChords(previewShow) ? [{ value: "chordSheet", label: "Chord Sheet" }] : [])]

    function showHasChords(show: Show | null): boolean {
        if (!show) return false

        return Object.values(show.slides || {}).some(slide => slide.items?.some(item => item.lines?.some(line => line.chords && line.chords.length > 0)))
    }

    function updatePdfOptions(e: any, key: string) {
        pdfOptions[key] = e.detail
    }
</script>

<!-- min-width: 42vw; -->
<div style="display: flex;gap: 15px;">
    <div class="options" style="flex: 0 0 300px;">
        <MaterialDropdown label="clock.type" style="margin-bottom: 10px;" options={pdfTypeOptions} value={pdfOptions.type || "default"} on:change={e => (pdfOptions.type = e.detail)} />

        <!-- <MaterialCheckbox label="export.title" checked={pdfOptions.title} on:change={(e) => updatePdfOptions(e, "title")} /> -->

        {#if pdfOptions.type !== "chordSheet"}
            <MaterialCheckbox label="export.metadata" checked={pdfOptions.metadata} on:change={e => updatePdfOptions(e, "metadata")} />
            <MaterialCheckbox label="export.page_numbers" checked={pdfOptions.pageNumbers} on:change={e => updatePdfOptions(e, "pageNumbers")} />
            <MaterialCheckbox label="export.groups" checked={pdfOptions.groups} on:change={e => updatePdfOptions(e, "groups")} />
            <MaterialCheckbox label="export.numbers" checked={pdfOptions.numbers} on:change={e => updatePdfOptions(e, "numbers")} />
            <MaterialCheckbox label="export.invert" disabled={pdfOptions.type === "text"} checked={pdfOptions.invert} on:change={e => updatePdfOptions(e, "invert")} />

            <MaterialCheckbox label="export.original_text_size" style="margin-top: 10px;" disabled={pdfOptions.type === "slides"} checked={pdfOptions.originalTextSize !== false} on:change={e => updatePdfOptions(e, "originalTextSize")} />
            <MaterialNumberInput label="settings.font_size" disabled={pdfOptions.type === "slides" || pdfOptions.originalTextSize !== false} value={pdfOptions.textSize} on:change={e => (pdfOptions.textSize = e.detail)} />

            {#if pdfOptions.type !== "text"}
                <MaterialNumberInput label="export.rows" style="margin-top: 10px;" value={pdfOptions.grid[1]} min={1} max={7} on:change={e => (pdfOptions.grid[1] = e.detail)} />
                <MaterialNumberInput label="export.columns" disabled={pdfOptions.type !== "slides"} value={pdfOptions.grid[0]} min={1} max={6} on:change={e => (pdfOptions.grid[0] = e.detail)} />
            {/if}
        {:else}
            <MaterialNumberInput label="settings.font_size" value={pdfOptions.fontSize} min={8} max={24} on:change={e => (pdfOptions.fontSize = e.detail)} />
            <MaterialNumberInput label="export.margin (mm)" value={pdfOptions.margin} min={5} max={50} on:change={e => (pdfOptions.margin = e.detail)} />
            <MaterialNumberInput label="edit.line_spacing" value={pdfOptions.spacing * 10} min={1} max={30} on:change={e => (pdfOptions.spacing = e.detail / 10)} />

            <MaterialNumberInput label="export.columns" style="margin-top: 10px;" value={pdfOptions.columnsPerPage} min={1} max={3} on:change={e => (pdfOptions.columnsPerPage = e.detail)} />

            <h5 style="margin: 10px 0;text-align: center;color: var(--text);"><T id="edit.chords" /></h5>

            <MaterialNumberInput label="edit.font_size" value={pdfOptions.chordFontSize} min={6} max={20} on:change={e => (pdfOptions.chordFontSize = e.detail)} />
        {/if}
    </div>

    <div class="previewBox">
        <div style="flex: 1;display: flex;flex-direction: column;margin: 10px;border-radius: 4px;overflow: hidden;">
            <!-- <h4 style="text-align: center;"><T id="export.preview" /></h4> -->
            <div class="label">{translateText("export.preview")}</div>

            <div class="paper" bind:this={paper}>
                <Pdf shows={previewShow ? [previewShow] : []} options={pdfOptions} />
            </div>
        </div>
        <div style="display: flex;flex-direction: column;height: 100%;background-color: var(--primary-darkest);">
            <!-- aspect-ratio: 1/1.4142; -->
            <MaterialButton style="flex: 1;" icon="up" on:click={() => paper.scrollBy(0, -paper.offsetHeight + 9.6)} />
            <MaterialButton style="flex: 1;" icon="down" on:click={() => paper.scrollBy(0, paper.offsetHeight - 7.001)} />
        </div>
    </div>
</div>

<!-- all as one file ??-->
<!-- {#if shows.length > 1 && format.id !== "project"}
  <span>
    <p><T id="export.oneFile" /></p>
    <div class="alignRight">
        <Checkbox disabled={shows.length < 2} checked={pdfOptions.oneFile} on:change={(e) => updatePdfOptions(e, "oneFile")} />
    </div>
  </span>
{/if} -->

<style>
    .previewBox {
        background-color: var(--primary-darker);
        border: 1px solid var(--primary-lighter);
        border-radius: 8px;
        overflow: hidden;

        display: flex;
        align-items: center;
        flex: 1;

        position: relative;
    }

    .label {
        position: absolute;
        left: 0.75rem;
        top: 0.25rem;

        font-size: 0.75rem;
        font-weight: 500;
        color: var(--secondary);

        pointer-events: none;
        z-index: 1;
    }

    .paper {
        background-color: white;
        width: 100%;
        height: auto;
        min-width: 200px;
        max-width: 900px;
        zoom: 0.4;
        overflow: auto;
        aspect-ratio: 210/297;
        align-self: center;
    }

    .paper::-webkit-scrollbar-track,
    .paper::-webkit-scrollbar-corner {
        background: rgb(0 0 0 / 0.05);
    }
    .paper::-webkit-scrollbar-thumb {
        background: rgb(0 0 0 / 0.3);
    }
    .paper::-webkit-scrollbar-thumb:hover {
        background: rgb(0 0 0 / 0.5);
    }

    .options {
        display: flex;
        flex-direction: column;
    }
</style>
