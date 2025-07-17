<script lang="ts">
    import { Show } from "../../../../../types/Show"
    import Pdf from "../../../export/Pdf.svelte"
    import Icon from "../../../helpers/Icon.svelte"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import Checkbox from "../../../inputs/Checkbox.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import NumberInput from "../../../inputs/NumberInput.svelte"
    import Dropdown from "../../../inputs/Dropdown.svelte"

    export let pdfOptions: any
    export let previewShow: Show | null
    export let showHasChords: (show: Show | null) => boolean

    let paper: any = null

    if (!Object.keys(pdfOptions).length) {
        pdfOptions = {
            title: true,
            metadata: true,
            invert: false,
            groups: true,
            numbers: true,
            text: true,
            slides: true,
            // repeats: false,
            // notes: false,
            pageNumbers: true,
            grid: [3, 6],
            oneFile: false,
            originalTextSize: true,
            textSize: 80,
            chordSheet: false, // Add chord sheet option
            
            // Chord sheet specific options
            artist: true,
            key: true,
            showChords: true,
            showNotes: true,
            fontSize: 15,
            chordFontSize: 15,
            margin: 20,
            spacing: 2,
            columnsPerPage: 2,
        }
    }

    $: hasChords = showHasChords(previewShow)

    const pdfTypeOptions = [
        { id: "normal", name: "Slides" },
        { id: "chordSheet", name: "Chord Sheet" }
    ]

    function updatePdfOptions(e: any, key: string) {
        pdfOptions[key] = e.target.checked
    }
</script>

<div style="display: flex;gap: 20px;height: 100%;">
    <div class="options" style="flex: 0 0 300px;">
        <h4 style="text-align: center;"><T id="edit.options" /></h4>
        <br />

        {#if hasChords}
            <CombinedInput>
                <p><T id="export.type" /></p>
                <Dropdown
                    options={pdfTypeOptions}
                    value={pdfOptions.chordSheet ? "Chord Sheet" : "Slides"}
                    on:click={(e) => (pdfOptions.chordSheet = e.detail.id === "chordSheet")}
                />
            </CombinedInput>
            <br />
        {/if}

        {#if !pdfOptions.chordSheet}
            <div class="line">
                <Button
                    on:click={() => (pdfOptions.text = !pdfOptions.text)}
                    disabled={!pdfOptions.slides}
                    style={pdfOptions.text ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);"}
                    bold={false}
                    center
                    dark
                >
                    <T id="export.text" />
                </Button>
                <Button
                    on:click={() => (pdfOptions.slides = !pdfOptions.slides)}
                    disabled={!pdfOptions.text}
                    style={pdfOptions.slides ? "flex: 1;border-bottom: 2px solid var(--secondary) !important;" : "flex: 1;border-bottom: 2px solid var(--primary-lighter);"}
                    bold={false}
                    center
                    dark
                >
                    <T id="export.slides" />
                </Button>
            </div>
        {/if}

        <CombinedInput style="margin-top: 10px;">
            <p><T id="export.title" /></p>
            <div class="alignRight">
                <Checkbox checked={pdfOptions.title} on:change={(e) => updatePdfOptions(e, "title")} />
            </div>
        </CombinedInput>
        
        {#if !pdfOptions.chordSheet}
            <CombinedInput>
                <p><T id="export.metadata" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.metadata} on:change={(e) => updatePdfOptions(e, "metadata")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.page_numbers" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.pageNumbers} on:change={(e) => updatePdfOptions(e, "pageNumbers")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.groups" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.groups} on:change={(e) => updatePdfOptions(e, "groups")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.numbers" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.numbers} on:change={(e) => updatePdfOptions(e, "numbers")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.invert" /></p>
                <div class="alignRight">
                    <Checkbox disabled={!pdfOptions.slides} checked={pdfOptions.invert} on:change={(e) => updatePdfOptions(e, "invert")} />
                </div>
            </CombinedInput>
        {/if}

        {#if !pdfOptions.chordSheet}
            <CombinedInput style="margin-top: 10px;">
                <p><T id="export.original_text_size" /></p>
                <div class="alignRight">
                    <Checkbox disabled={!pdfOptions.text} checked={pdfOptions.originalTextSize !== false} on:change={(e) => updatePdfOptions(e, "originalTextSize")} />
                </div>
            </CombinedInput>
            <CombinedInput>
                <p><T id="settings.font_size" /></p>
                <NumberInput disabled={!pdfOptions.text || pdfOptions.originalTextSize !== false} value={pdfOptions.textSize} on:change={(e) => (pdfOptions.textSize = e.detail)} />
            </CombinedInput>
        {/if}
        
        <!-- Chord Sheet Options -->
        {#if pdfOptions.chordSheet}
            <h5 style="margin-top: 20px; margin-bottom: 10px; text-align: center;"><T id="export.chord_sheet_options" /></h5>
            
            <CombinedInput>
                <p><T id="export.lyrics_font_size" /></p>
                <NumberInput value={pdfOptions.fontSize} on:change={(e) => (pdfOptions.fontSize = e.detail)} min={8} max={24} />
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.chord_font_size" /></p>
                <NumberInput value={pdfOptions.chordFontSize} on:change={(e) => (pdfOptions.chordFontSize = e.detail)} min={6} max={20} />
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.margin" /></p>
                <NumberInput value={pdfOptions.margin} on:change={(e) => (pdfOptions.margin = e.detail)} min={5} max={50} />
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.line_spacing" /></p>
                <NumberInput value={pdfOptions.spacing} on:change={(e) => (pdfOptions.spacing = e.detail)} min={1} max={3} decimals={1} />
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.columns" /></p>
                <NumberInput value={pdfOptions.columnsPerPage} on:change={(e) => (pdfOptions.columnsPerPage = e.detail)} min={1} max={3} />
            </CombinedInput>
            
            <h5 style="margin-top: 20px; margin-bottom: 10px; text-align: center;"><T id="export.metadata_display" /></h5>
            
            <CombinedInput>
                <p><T id="export.artist" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.artist} on:change={(e) => updatePdfOptions(e, "artist")} />
                </div>
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.key" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.key} on:change={(e) => updatePdfOptions(e, "key")} />
                </div>
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.chords_used" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.showChords} on:change={(e) => updatePdfOptions(e, "showChords")} />
                </div>
            </CombinedInput>
            
            <CombinedInput>
                <p><T id="export.notes" /></p>
                <div class="alignRight">
                    <Checkbox checked={pdfOptions.showNotes} on:change={(e) => updatePdfOptions(e, "showNotes")} />
                </div>
            </CombinedInput>
        {/if}
        <!-- <span>
    <p>repeats</p>
    <div class="alignRight">
        <Checkbox checked={pdfOptions.repeats} on:change={(e) => updatePdfOptions(e, "repeats")} />
    </div>
  </span> -->
        {#if !pdfOptions.chordSheet}
            <CombinedInput>
                <p><T id="export.rows" /></p>
                <NumberInput disabled={!pdfOptions.slides} value={pdfOptions.grid[1]} min={1} max={7} on:change={(e) => (pdfOptions.grid[1] = e.detail)} />
            </CombinedInput>
            <CombinedInput>
                <p><T id="export.columns" /></p>
                <NumberInput disabled={pdfOptions.text} value={pdfOptions.grid[0]} min={1} max={6} on:change={(e) => (pdfOptions.grid[0] = e.detail)} />
            </CombinedInput>
        {/if}
    </div>

    <div style="flex: 1; display: flex; flex-direction: column;">
        <h4 style="text-align: center;"><T id="export.preview" /></h4>
        <br />
        <div class="paper" bind:this={paper}>
            <Pdf shows={previewShow ? [previewShow] : []} options={pdfOptions} />
        </div>
    </div>
    <div style="display: flex;flex-direction: column;">
        <br />
        <br />
        <!-- aspect-ratio: 1/1.4142; -->
        <Button style="flex: 1;" on:click={() => paper.scrollBy(0, -paper.offsetHeight + 9.6)} dark><Icon id="up" white /></Button>
        <Button style="flex: 1;" on:click={() => paper.scrollBy(0, paper.offsetHeight - 7.001)} dark><Icon id="down" white /></Button>
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
    .paper {
        background-color: white;
        width: 100%;
        height: 100%;
        min-width: 400px;
        max-width: 600px;
        zoom: 0.4;
        overflow: auto;
        aspect-ratio: 210/297;
        flex: 1;
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

    h4 {
        color: var(--text);
    }

    .line {
        display: flex;
        align-items: center;
        background-color: var(--primary-darker);
        flex-flow: wrap;
    }
</style>
