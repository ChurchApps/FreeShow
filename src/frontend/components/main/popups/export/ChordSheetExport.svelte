<script lang="ts">
    import { Show } from "../../../../../types/Show"
    import Pdf from "../../../export/Pdf.svelte"
    import Icon from "../../../helpers/Icon.svelte"
    import T from "../../../helpers/T.svelte"
    import Button from "../../../inputs/Button.svelte"
    import Checkbox from "../../../inputs/Checkbox.svelte"
    import CombinedInput from "../../../inputs/CombinedInput.svelte"
    import NumberInput from "../../../inputs/NumberInput.svelte"

    export let chordSheetOptions: any
    export let previewShow: Show | null

    let paper: any = null

    if (!Object.keys(chordSheetOptions).length) {
        chordSheetOptions = {
            // Essential PDF export options
            text: true,
            slides: false, 
            groups: true,
            numbers: false,
            title: true,
            metadata: false,
            pageNumbers: false,
            grid: [1, 1],
            oneFile: false,
            originalTextSize: false,
            textSize: 80,
            invert: false,
            
            // Chord sheet specific options
            artist: true,
            key: true,
            tempo: false,
            capo: false,
            fontSize: 12,
            chordFontSize: 10,
            margin: 20,
            spacing: 1.5,
            columnsPerPage: 1,
        }
    }

    function updateChordSheetOptions(e: any, key: string) {
        chordSheetOptions[key] = e.target.checked
    }
</script>

<div style="display: flex;gap: 20px;">
    <div class="options">
        <h4 style="text-align: center;"><T id="edit.options" /></h4>
        <br />

        <CombinedInput>
            <p><T id="export.title" /></p>
            <div class="alignRight">
                <Checkbox checked={chordSheetOptions.title} on:change={(e) => updateChordSheetOptions(e, "title")} />
            </div>
        </CombinedInput>
        <CombinedInput>
            <p><T id="export.artist" /></p>
            <div class="alignRight">
                <Checkbox checked={chordSheetOptions.artist} on:change={(e) => updateChordSheetOptions(e, "artist")} />
            </div>
        </CombinedInput>
        <CombinedInput>
            <p>Song Key</p>
            <div class="alignRight">
                <Checkbox checked={chordSheetOptions.key} on:change={(e) => updateChordSheetOptions(e, "key")} />
            </div>
        </CombinedInput>
        <CombinedInput>
            <p>Tempo</p>
            <div class="alignRight">
                <Checkbox checked={chordSheetOptions.tempo} on:change={(e) => updateChordSheetOptions(e, "tempo")} />
            </div>
        </CombinedInput>
        <CombinedInput>
            <p>Capo</p>
            <div class="alignRight">
                <Checkbox checked={chordSheetOptions.capo} on:change={(e) => updateChordSheetOptions(e, "capo")} />
            </div>
        </CombinedInput>

        <hr style="margin: 15px 0;" />

        <CombinedInput>
            <p>Font Size</p>
            <NumberInput value={chordSheetOptions.fontSize} min={8} max={24} on:change={(e) => (chordSheetOptions.fontSize = e.detail)} />
        </CombinedInput>
        <CombinedInput>
            <p>Chord Font Size</p>
            <NumberInput value={chordSheetOptions.chordFontSize} min={6} max={20} on:change={(e) => (chordSheetOptions.chordFontSize = e.detail)} />
        </CombinedInput>
        <CombinedInput>
            <p>Line Spacing</p>
            <NumberInput value={chordSheetOptions.spacing} min={1} max={3} step={0.1} on:change={(e) => (chordSheetOptions.spacing = e.detail)} />
        </CombinedInput>
        <CombinedInput>
            <p>Margin (px)</p>
            <NumberInput value={chordSheetOptions.margin} min={10} max={50} on:change={(e) => (chordSheetOptions.margin = e.detail)} />
        </CombinedInput>
        <CombinedInput>
            <p>Columns per Page</p>
            <NumberInput value={chordSheetOptions.columnsPerPage} min={1} max={3} on:change={(e) => (chordSheetOptions.columnsPerPage = e.detail)} />
        </CombinedInput>
    </div>

    <div>
        <h4 style="text-align: center;"><T id="export.preview" /></h4>
        <br />
        <div class="paper" bind:this={paper}>
            <Pdf shows={previewShow ? [previewShow] : []} options={{...chordSheetOptions, chordSheet: true}} />
        </div>
    </div>
    <div style="display: flex;flex-direction: column;">
        <br />
        <br />
        <Button style="flex: 1;" on:click={() => paper.scrollBy(0, -paper.offsetHeight + 9.6)} dark><Icon id="up" white /></Button>
        <Button style="flex: 1;" on:click={() => paper.scrollBy(0, paper.offsetHeight - 7.001)} dark><Icon id="down" white /></Button>
    </div>
</div>

<style>
    .paper {
        background-color: white;
        aspect-ratio: 210/297;
        width: 800px;
        zoom: 0.4;
        overflow: auto;
    }

    .paper::-webkit-scrollbar {
        width: 20px;
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
</style>
