<script lang="ts">
    import { onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import autosize, { AutosizeTypes } from "../helpers/autosize"
    import { getStyles } from "../helpers/style"
    import Clock from "../items/Clock.svelte"
    import Button from "./Button.svelte"
    import Icon from "./Icon.svelte"
    import ListView from "./ListView.svelte"

    export let item: Item
    export let stageItem: any = {}
    export let style: boolean = true
    export let autoStage: boolean = true
    export let chords: boolean = false
    export let fontSize: number = 0
    export let autoSize: boolean = true
    export let ratio: number = 1
    export let maxLines: number = 0 // stage next item preview
    export let customStyle: string = ""

    // dynamic resolution
    let resolution = { width: window.innerWidth, height: window.innerHeight }
    let itemStyle = item.style
    let itemStyles: any = getStyles(item.style, true)
    // custom dynamic size
    let newSizes = `;
    top: ${Math.min(itemStyles.top, (itemStyles.top / 1080) * resolution.height)}px;
    left: ${Math.min(itemStyles.left, (itemStyles.left / 1920) * resolution.width)}px;
    width: ${Math.min(itemStyles.width, (itemStyles.width / 1920) * resolution.width)}px;
    height: ${Math.min(itemStyles.height, (itemStyles.height / 1080) * resolution.height)}px;
  `
    if (autoStage) itemStyle = itemStyle + newSizes

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg

    // AUTO SIZE

    let loaded = false
    onMount(() => {
        loaded = true
    })

    let alignElem: any

    $: if (autoSize && loaded) calculateAutosize()
    let loopStop: any = null
    function calculateAutosize() {
        if (loopStop) return
        loopStop = setTimeout(() => (loopStop = null), 200)

        let type: AutosizeTypes = "growToFit"
        let textQuery = ""
        if ((item.type || "text") === "text") {
            // elem = elem.querySelector(".align")
            textQuery = ".lines .break span"
        } else {
            // type = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }

        fontSize = autosize(alignElem, { type, textQuery })
    }

    // CHORDS

    // WIP auto size here does not set correct size in stage output
    let chordLines: string[] = []
    $: if (chords && item.lines) createChordLines()
    function createChordLines() {
        chordLines = []

        item.lines!.forEach((line, i) => {
            if (!line.chords?.length || !line.text) return

            let chords = JSON.parse(JSON.stringify(line.chords || []))
            let negativeChords = chords.filter((chord: any) => chord.pos < 0)
            chords = chords.filter((chord: any) => chord.pos >= 0)

            let html = ""

            //add negative chords at the beginning of the line
            negativeChords
                .sort((a: any, b: any) => b.pos - a.pos)
                .forEach((chord: any, i: number) => {
                    html += `<span class="chord" style="transform: translateX(calc(-100% - ${60 * (i + 1)}px));">${chord.key}</span>`
                })

            let index = 0
            line.text.forEach((text) => {
                let value = text.value.trim().replaceAll("\n", "") || "."

                let letters = value.split("")
                letters.forEach((letter) => {
                    let chordIndex = chords.findIndex((a: any) => a.pos === index)
                    if (chordIndex >= 0) {
                        html += `<span class="chord">${chords[chordIndex].key}</span>`
                        chords.splice(chordIndex, 1)
                    }

                    html += `<span class="invisible">${letter}</span>`

                    index++
                })
            })

            chords
                .sort((a: any, b: any) => a.pos - b.pos)
                .forEach((chord: any, i: number) => {
                    html += `<span class="chord" style="transform: translateX(${60 * (i + 1)}px);">${chord.key}</span>`
                })

            if (!html) return
            chordLines[i] = html
        })
    }

    let thisElem: any
    let actionButtons: boolean = false
    function toggleActions(e: any) {
        if (e.target.closest("button")) return

        if (actionButtons) {
            setTimeout(() => {
                actionButtons = false
            }, 20)
        } else {
            actionButtons = true
        }
    }

    function closeActions(e: any) {
        if (e.target.closest("button") || e.target.closest(".item") === thisElem) return

        setTimeout(() => {
            actionButtons = false
        }, 20)
    }

    // CHORDS TRANSPOSE

    let defaultChords: any = {}
    let amountTransposed: number = 0
    function transpose(action: "up" | "down" | "reset") {
        if (action === "reset") amountTransposed = 0
        else if (action === "up") amountTransposed++
        else if (action === "down") amountTransposed--

        item.lines!.forEach((line) => {
            if (!line.chords?.length || !line.text) return

            let chords = JSON.parse(JSON.stringify(line.chords || []))
            chords?.forEach((chord: any) => {
                if (!defaultChords[chord.id]) defaultChords[chord.id] = chord.key

                let rootNote = defaultChords[chord.id]

                if (action === "reset") {
                    chord.key = rootNote
                    return
                }

                chord.key = transposeChord(rootNote, amountTransposed)
            })

            line.chords = chords
        })

        createChordLines()
    }

    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    function transposeChord(chord: string, semitones: number) {
        // split the chord into root note, bass note, and chord quality
        let [rootNote, bassNote, chordQuality] = chord.match(/([A-G]#?)(\/[A-G]#?)?(.*)/)?.slice(1) || []

        const transposedRootNote = transposeNote(rootNote)
        if (bassNote) bassNote = "/" + transposeNote(bassNote.slice(1))

        function transposeNote(note: string) {
            let index = notes.indexOf(note.toUpperCase())
            let transposedIndex = (index + semitones) % 12
            if (transposedIndex < 0) transposedIndex += 12

            return notes[transposedIndex]
        }

        return transposedRootNote + (bassNote || "") + chordQuality
    }
</script>

<svelte:window on:click={closeActions} />

<!-- bind:offsetHeight={height} -->
<div bind:this={thisElem} class="item" style={style ? itemStyle : null} on:click={toggleActions}>
    <!-- can have more actions here if needed -->
    {#if actionButtons && (chordLines.length || false)}
        <div class="actions">
            {#if chordLines.length}
                <div class="flex">
                    <p style="margin-right: 8px;">Transpose</p>
                    <Button on:click={() => transpose("down")} title="Down one" dark>{"-1"}</Button>
                    <Button on:click={() => transpose("reset")} title="Reset" dark>{"0"}</Button>
                    <Button on:click={() => transpose("up")} title="Up one" dark>{"+1"}</Button>
                </div>
            {/if}
        </div>
    {/if}

    {#if item.lines}
        <div class="align" style={style ? item.align : null} bind:this={alignElem}>
            <div class="lines" style={style && lineGap ? `gap: ${lineGap}px;` : ""}>
                {#each item.lines as line, i}
                    {#if !maxLines || i < maxLines}
                        <!-- WIP chords are way bigger than stage preview for some reason -->
                        {#if chordLines[i]}
                            <div class:first={i === 0} class="break chords" style="--chord-size: {stageItem?.chordsData?.size || 30}px;--chord-color: {stageItem?.chordsData?.color || '#FF851B'};--font-size: {fontSize}px;">
                                {@html chordLines[i]}
                            </div>
                        {/if}
                        <div class="break" style="{style && lineBg ? `background-color: ${lineBg};` : ''}{style ? line.align : ''}">
                            {#each line.text || [] as text}
                                <span style="{style ? text.style + (fontSize ? 'font-size: ' + fontSize + 'px;' : '') : 'font-size: ' + fontSize + 'px;'}{customStyle}">{@html text.value.replaceAll("\n", "<br>") || "<br>"}</span>
                            {/each}
                        </div>
                    {/if}
                {/each}
            </div>
        </div>
    {:else if item?.type === "list"}
        <ListView list={item.list} />
        <!-- {:else if item?.type === "media"}
        {#if item.src}
            {#if getMediaType(getExtension(item.src)) === "video"}
                <video src={item.src} muted={true}>
                    <track kind="captions" />
                </video>
            {:else}
                <Image src={item.src} alt="" style="width: 100%;height: 100%;object-fit: {item.fit || 'contain'};filter: {item.filter};{item.flipped ? 'transform: scaleX(-1);' : ''}" />
            {/if}
        {/if} -->
        <!-- {:else if item?.type === "camera"} -->
        <!-- {:else if item?.type === "timer"}
        <Timer {item} id={item.timerId || ""} {today} style="font-size: {fontSize}px;" /> -->
    {:else if item?.type === "clock"}
        <Clock autoSize={fontSize} {...item.clock} />
        <!-- {:else if item?.type === "events"}
        <DynamicEvents {...item.events} /> -->
        <!-- {:else if item?.type === "variable"}
        <Variable {item} style="font-size: {fontSize}px;" /> -->
        <!-- {:else if item?.type === "mirror"}
        <Mirror {item} {ref} {ratio} index={slideIndex} /> -->
    {:else if item?.type === "icon"}
        {#if item.customSvg}
            <div class="customIcon">
                {@html item.customSvg}
            </div>
        {:else}
            <Icon style="zoom: {1 / ratio};" id={item.id || ""} fill white custom />
        {/if}
    {/if}
</div>

<style>
    /* default stage item */
    .item {
        color: white;
        /* font-size: 100px; */
        font-family: unset;
        line-height: 1.1;
        /* -webkit-text-stroke-color: #000000;
        text-shadow: 2px 2px 10px #000000; */

        /* border-style: solid;
        border-width: 0px;
        border-color: #ffffff; */

        height: 150px;
        width: 400px;
    }

    .actions {
        position: absolute;
        bottom: 0;
        left: 50%;
        /* transform: translate(-50%, 100%); */
        transform: translateX(-50%);

        /* background-color: rgb(0 0 0 / 0.5); */
        background-color: var(--primary);
        padding: 5px 10px;
        font-size: 0.8em;
        z-index: 5;
    }

    .flex {
        display: flex;
        align-items: center;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .lines {
        /* overflow-wrap: break-word;
    font-size: 0; */
        width: 100%;

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
    }

    .break {
        width: 100%;

        font-size: 0; /* auto size fix */
        /* height: 100%; */
        user-select: text;

        overflow-wrap: break-word;
        /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
    }

    /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

    .break :global(span) {
        font-size: 100px;
    }

    /* chords */
    .break.chords :global(.invisible) {
        opacity: 0;
        font-size: var(--font-size);
        line-height: 0;
    }
    .break.chords :global(.chord) {
        position: absolute;
        color: var(--chord-color);
        font-size: var(--chord-size) !important;

        transform: translate(-50%, -20%);
        line-height: initial;
        z-index: 2;
    }
    .break.chords {
        line-height: 0.5em;
        max-height: 15px;
        position: relative;

        /* reset */
        font-weight: normal;
        font-style: normal;
    }
    .break.chords.first {
        line-height: var(--chord-size) !important;
    }

    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
