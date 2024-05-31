<script lang="ts">
    import type { Item } from "../../../types/Show"
    import { activePopup, selected } from "../../stores"
    import { clone } from "../helpers/array"
    import { addChords } from "./scripts/chords"

    export let item: Item
    export let autoSize: number
    export let index: number
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        id: string
    }
    export let chordsMode: boolean = false

    // CHORDS

    let chordButtons: any[] = []
    function chordClick(e: any) {
        let add = e.target.closest(".add")
        if (add) {
            let pos = add.id.split("_")
            addChords(item, ref, index, Number(pos[0]), Number(pos[1]))
            return
        }

        let btn = e.target.closest(".button")
        if (!btn) return

        let data = chordButtons[btn.id]
        if (!data) return

        // for right click or rename click
        selected.set({ id: "chord", data: [{ chord: data.chord, index: data.lineIndex, slideId: ref.id, itemIndex: index }] })

        if (e.button !== 0) return
        // left click
        activePopup.set("rename")
    }

    let chordLines: string[] = []
    $: if (chordsMode && item?.lines) createChordLines()
    function createChordLines() {
        chordLines = []
        chordButtons = []

        item.lines!.forEach((line, i) => {
            if (!line.text) return

            let chords = clone(line.chords || [])

            let html = ""
            let currentIndex = 0
            line.text.forEach((text) => {
                if (!text.value) {
                    html += "<br>"
                    return
                }

                let value = text.value.trim().replaceAll("\n", "").replaceAll("&nbsp;", " ") || ""

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a: any) => a.pos === currentIndex)
                    if (chordIndex >= 0) {
                        let chord = chords[chordIndex]
                        chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                        let buttonIndex = chordButtons.length - 1
                        html += `<span id="${buttonIndex}" class="context #chord chord button">${chord.key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    let style = text.style
                    if (item.auto && autoSize) style += `font-size: ${autoSize}px;`
                    html += `<span id="${i}_${currentIndex}" class="invisible add" style="${style}">${letter}</span>`

                    currentIndex++
                })
            })

            if (!html) html += `<span class="invisible add"><br></span>`

            chords.forEach((chord: any, ci: number) => {
                chordButtons.push({ item, showRef: ref, itemIndex: index, chord, lineIndex: i })
                let buttonIndex = chordButtons.length - 1
                html += `<span id="${buttonIndex}" class="context #chord chord button" style="transform: translate(${60 * (ci + 1)}px, -80%);">${chord.key}</span>`
            })

            if (!html) return
            chordLines[i] = html
        })
    }
</script>

{#if item?.lines}
    <div class="edit chords" on:mousedown={chordClick}>
        {#each item.lines as line, i}
            <div class="break chordsBreak" style="{item?.specialStyle?.lineBg ? `background-color: ${item?.specialStyle?.lineBg};` : ''}{line.align || ''}">
                {@html chordLines[i]}
            </div>
        {/each}
    </div>
{/if}

<style>
    .chords :global(.chord) {
        position: absolute;
        transform: translateY(-100%);
        background-color: var(--primary-darker);
        /* color: var(--text); */
        font-size: 0.8em;
        border: 5px solid var(--secondary);
        text-shadow: none;
        z-index: 3;

        pointer-events: all;
    }
    .chords :global(.chord):hover {
        filter: brightness(1.2);
    }
    .chords :global(.chord)::after {
        content: "";
        position: absolute;
        bottom: -5px;
        left: 50%;
        transform: translate(-50%, 100%);
        width: 5px;
        height: 50px;
        background-color: var(--secondary);
        /* background-color: var(--secondary-opacity); */
    }
    /* .chordsText {
  position: absolute;
  width: 100%;
  color: transparent !important;
  user-select: none;
}
.chordsText:first-child {
  width: 100%;
} */

    /* chords */
    .edit.chords :global(.invisible) {
        opacity: 1;
        font-size: var(--font-size);
        line-height: 1.1em;
        background-color: rgb(255 255 255 / 0.1);
    }
    .edit.chords :global(.invisible):hover {
        opacity: 0.6;
        background-color: var(--secondary);
    }
    .edit.chords :global(.chord) {
        /* color: var(--chord-color);
      font-size: var(--chord-size) !important; */
        bottom: 0;
        transform: translate(-50%, -60%);
        z-index: 2;
        font-size: 60px !important;
        /* color: #FF851B; */

        line-height: initial;
        opacity: 0.9;
    }
    .edit.chords {
        /* line-height: 0.5em; */
        /* font-size: inherit; */
        position: absolute;
        /* pointer-events: none; */
    }

    .chordsBreak {
        position: relative;
        line-height: 0;

        /* fix letter spacing */
        /* letter-spacing: 0.3px; */ /* can't be lower */
        /* font-kerning: none; */
    }
</style>
