<script lang="ts">
    import { Show } from "../../../../../types/Show"
    import Pdf from "../../../export/Pdf.svelte"
    import Icon from "../../../helpers/Icon.svelte"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import Checkbox from "../../../inputs/Checkbox.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import NumberInput from "../../../inputs/NumberInput.svelte"

    export let pdfOptions: any
    export let previewShow: Show | null

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
        }
    }

    function updatePdfOptions(e: any, key: string) {
        pdfOptions[key] = e.target.checked
    }
</script>

<div style="display: flex;gap: 20px;">
    <div class="options">
        <h4 style="text-align: center;"><T id="export.options" /></h4>
        <br />

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

        <CombinedInput style="margin-top: 10px;">
            <p><T id="export.title" /></p>
            <div class="alignRight">
                <Checkbox checked={pdfOptions.title} on:change={(e) => updatePdfOptions(e, "title")} />
            </div>
        </CombinedInput>
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
        <!-- <span>
    <p>repeats</p>
    <div class="alignRight">
        <Checkbox checked={pdfOptions.repeats} on:change={(e) => updatePdfOptions(e, "repeats")} />
    </div>
  </span> -->
        <CombinedInput>
            <p><T id="export.rows" /></p>
            <NumberInput disabled={!pdfOptions.slides} value={pdfOptions.grid[1]} min={1} max={7} on:change={(e) => (pdfOptions.grid[1] = e.detail)} />
        </CombinedInput>
        <CombinedInput>
            <p><T id="export.columns" /></p>
            <NumberInput disabled={pdfOptions.text} value={pdfOptions.grid[0]} min={1} max={6} on:change={(e) => (pdfOptions.grid[0] = e.detail)} />
        </CombinedInput>
    </div>

    <div>
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
        aspect-ratio: 210/297;
        width: 800px;
        zoom: 0.4;
        overflow: auto;
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
