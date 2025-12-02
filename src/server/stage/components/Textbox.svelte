<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item } from "../../../types/Show"
    import Button from "../../common/components/Button.svelte"
    import Icon from "../../common/components/Icon.svelte"
    import autosize from "../../common/util/autosize"
    import { createVirtualBreaks } from "../../common/util/show"
    import { getStyles } from "../../common/util/style"
    import { getDynamicValue, replaceDynamicValues } from "../helpers/show"
    import Clock from "../items/Clock.svelte"
    import { send } from "../util/socket"
    import { dictionary, updateTransposed, variables } from "../util/stores"
    import ListView from "./ListView.svelte"

    export let showId: string
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
    export let clickRevealed: boolean = false
    export let revealed = -1

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
    $: lineRadius = item?.specialStyle?.lineRadius || 0
    $: lineBg = item?.specialStyle?.lineBg
    $: lineStyleBox = lineGap ? `gap: ${lineGap}px;` : ""
    $: lineStyle = (lineRadius ? `border-radius: ${lineRadius}px;` : "") + (lineBg ? `background: ${lineBg};` : "")

    // AUTO SIZE

    let loaded = false
    onMount(() => {
        loaded = true

        // update on first load
        setTimeout(calculateAutosize, 400)
    })

    let alignElem: HTMLElement | undefined

    $: if (autoSize && loaded) calculateAutosize()
    $: if ($variables) setTimeout(calculateAutosize, 50)
    let loopStop: any = null
    function calculateAutosize() {
        if (loopStop || !alignElem || !autoSize) return
        loopStop = setTimeout(() => (loopStop = null), 200)

        let type = item?.textFit || "shrinkToFit"
        let defaultFontSize
        let maxFontSize

        if (stageItem?.type !== "text") type = stageItem?.textFit || "growToFit"
        let itemFontSize = Number(getStyles(stageItem?.style, true)?.["font-size"] || "") || 100
        defaultFontSize = itemFontSize
        if (type === "growToFit" && itemFontSize !== 100) maxFontSize = itemFontSize

        let textQuery = ""
        if ((item.type || "text") === "text") {
            // elem = elem.querySelector(".align")
            textQuery = ".lines .break span"
        } else {
            // type = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }

        fontSize = autosize(alignElem, { type, textQuery, defaultFontSize, maxFontSize })
    }

    // CHORDS

    // WIP auto size here does not set correct size in stage output
    let chordLines: string[] = []
    $: if (chords && item.lines) createChordLines()
    function createChordLines() {
        chordLines = []
        if (!Array.isArray(item?.lines)) return

        item.lines.forEach((line, i) => {
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
            line.text.forEach(text => {
                let value = text.value.trim().replaceAll("\n", "") || "."

                let letters = value.split("")
                letters.forEach(letter => {
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

    let thisElem: HTMLElement | undefined
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

    function getCustomStyle(style: string) {
        if (!style) return

        // reset item styles (as it's set in parent item)
        style += "display: contents;"

        return style
    }

    // CHORDS TRANSPOSE

    let defaultChords: any = {}
    let amountTransposed: number = 0
    $: if (showId && chordLines.length && $updateTransposed) getTransposed()
    function getTransposed() {
        const transposed = JSON.parse(localStorage.transposed || "{}")
        if (typeof transposed[showId] === "number") transpose(transposed[showId])
    }
    function transpose(action: "up" | "down" | "reset" | number) {
        if (action === "reset") amountTransposed = 0
        else if (action === "up") amountTransposed++
        else if (action === "down") amountTransposed--
        else if (typeof action === "number") amountTransposed = action

        if (typeof action !== "number") updateTransposed.set($updateTransposed + 1)

        // save
        const transposed = JSON.parse(localStorage.transposed || "{}")
        transposed[showId] = amountTransposed
        localStorage.transposed = JSON.stringify(transposed)

        item.lines?.forEach(line => {
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

    // UPDATE DYNAMIC VALUES e.g. {time_} EVERY SECOND
    // & update instantly when variables or item change
    let updateDynamic = 0
    $: if ($variables || item) setTimeout(update)
    const dynamicInterval = setInterval(update, 1000)
    function update() {
        updateDynamic++
    }
    onDestroy(() => {
        clearInterval(dynamicInterval)
        if (eventTimeout) clearTimeout(eventTimeout)
        if (blockTimeout) clearTimeout(blockTimeout)
    })

    $: chordFontSize = chordLines.length ? (stageItem?.chords?.size || stageItem?.chordsData?.size || 60) * 0.65 : 0
    $: chordsStyle = `--chord-size: ${chordLines.length ? fontSize * (chordFontSize / 100) : "undefined"}px;--chord-color: ${stageItem?.chords?.color || stageItem?.chordsData?.color || "#FF851B"};`

    function press() {
        if (!item.button?.press) return
        send("RUN_ACTION", { id: item.button.press })
    }

    function release() {
        if (!item.button?.release) return
        send("RUN_ACTION", { id: item.button.release })
    }

    // Event deduplication variables
    let lastEventType: string = ""
    let eventTimeout: NodeJS.Timeout | null = null
    let isEventBlocked: boolean = false
    let blockTimeout: NodeJS.Timeout | null = null

    // Detect mobile browsers that fire both touch and pointer events
    const isMobileBrowser = typeof navigator !== "undefined" && (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || /SamsungBrowser/i.test(navigator.userAgent))

    function clearEventType() {
        lastEventType = ""
    }

    function setEventType(type: string) {
        lastEventType = type
        if (eventTimeout) clearTimeout(eventTimeout)
        // Clear the event type after a short delay to allow for proper event handling
        eventTimeout = setTimeout(clearEventType, 200)
    }

    function blockEvents() {
        isEventBlocked = true
        if (blockTimeout) clearTimeout(blockTimeout)
        // Block events for a shorter period - just enough to prevent double-firing
        blockTimeout = setTimeout(() => {
            isEventBlocked = false
        }, 100)
    }

    // Touch event handlers for mobile browsers (iOS Safari, Android Chrome, Samsung Internet, etc.)
    function handleTouchStart(e: TouchEvent) {
        // Block if events are currently blocked or wrong event type
        if (isEventBlocked || (lastEventType && lastEventType !== "touch")) return

        setEventType("touch")

        // Only handle press/release actions
        if (item.button?.press || item.button?.release) {
            // Prevent default only for press/release actions to stop ghost clicks
            if (isMobileBrowser) {
                e.preventDefault()
                e.stopPropagation()
            }
            blockEvents() // Block rapid-fire events
            press()
        }
        // For transpose/click actions, don't prevent default - let click events bubble
    }

    function handleTouchEnd(e: TouchEvent) {
        // Only handle if we're in a touch sequence
        if (lastEventType !== "touch") return

        // Only handle press/release actions
        if (item.button?.press || item.button?.release) {
            // Prevent default only for press/release actions
            if (isMobileBrowser) {
                e.preventDefault()
                e.stopPropagation()
            }
            release()
        }
        // For transpose/click actions, don't prevent default - let click events bubble
    }

    // Mouse event handlers for desktop compatibility (fallback for older browsers)
    function handleMouseDown() {
        // Skip on mobile or if wrong event type or events blocked
        if (isMobileBrowser || isEventBlocked || lastEventType === "pointer" || lastEventType === "touch") return

        setEventType("mouse")
        if (item.button?.press || item.button?.release) {
            blockEvents()
            press()
        }
    }

    function handleMouseUp() {
        // Only handle if we're in a mouse sequence and not mobile
        if (isMobileBrowser || lastEventType !== "mouse") return

        if (item.button?.press || item.button?.release) {
            release()
        }
    }

    // Pointer event handlers for modern browsers (preferred for desktop)
    function handlePointerDown(e: PointerEvent) {
        // Block if events are blocked
        if (isEventBlocked) return

        // On mobile, completely ignore pointer events if we have touch events
        if (isMobileBrowser) {
            if (e.pointerType === "touch") return // Touch events handle this
            // For non-touch pointer events on mobile (stylus, etc.)
            if (lastEventType === "touch") return
        }

        if (e.pointerType === "touch") {
            if (lastEventType === "touch") return
            setEventType("touch")
        } else {
            if (lastEventType === "mouse" || lastEventType === "touch") return
            setEventType("pointer")
        }

        if (item.button?.press || item.button?.release) {
            blockEvents()
            press()
        }
    }

    function handlePointerUp(e: PointerEvent) {
        // On mobile, ignore pointer events completely
        if (isMobileBrowser && e.pointerType === "touch") return

        if (e.pointerType === "touch" && lastEventType !== "touch") return
        if (e.pointerType !== "touch" && lastEventType !== "pointer") return

        if (item.button?.press || item.button?.release) {
            release()
        }
    }

    // Keyboard event handler for accessibility
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            press()
        }
    }

    function handleKeyUp(e: KeyboardEvent) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            release()
        }
    }
</script>

<svelte:window on:click={closeActions} />

<!-- bind:offsetHeight={height} -->
<div
    bind:this={thisElem}
    class="item"
    class:clicked={item.button?.press || item.button?.release}
    style={style ? getCustomStyle(itemStyle) : null}
    class:chords={chordLines.length}
    class:clickable={item.button?.press || item.button?.release}
    class:reveal={item.clickReveal && !clickRevealed}
    on:click={toggleActions}
    on:keydown={handleKeyDown}
    on:keyup={handleKeyUp}
    on:pointerdown={handlePointerDown}
    on:pointerup={handlePointerUp}
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
    on:mousedown={handleMouseDown}
    on:mouseup={handleMouseUp}
    role="button"
    tabindex={item.button?.press || item.button?.release ? 0 : -1}
>
    <!-- can have more actions here if needed -->
    {#if actionButtons && (chordLines.length || false)}
        <div class="actions">
            {#if chordLines.length}
                <div class="flex">
                    <p style="margin-inline-end: 8px;">Transpose</p>
                    <Button on:click={() => transpose("down")} title={$dictionary?.edit?.transpose_down} dark>{"-1"}</Button>
                    <Button on:click={() => transpose("reset")} title={$dictionary?.actions?.reset} dark>{"0"}</Button>
                    <Button on:click={() => transpose("up")} title={$dictionary?.edit?.transpose_up} dark>{"+1"}</Button>
                </div>
            {/if}
        </div>
    {/if}

    {#if item.lines}
        <div class="align" style={style ? item.align : null} bind:this={alignElem}>
            <div class="lines" style="{style ? lineStyleBox : ''}{chordsStyle}">
                {#each createVirtualBreaks(item.lines) as line, i}
                    {#if !maxLines || i < maxLines}
                        <!-- WIP chords are way bigger than stage preview for some reason -->
                        {#if chordLines[i]}
                            <div class:first={i === 0} class="break chords" style="--font-size: {fontSize}px;--offsetY: {stageItem?.chords?.offsetY || 0}px;">
                                {@html chordLines[i]}
                            </div>
                        {/if}
                        <div class="break" class:reveal={item?.lineReveal && revealed < i} style="{style ? lineStyle : ''}{style ? line.align : ''}">
                            {#each line.text || [] as text}
                                {@const value = text.value?.replaceAll("\n", "<br>") || "<br>"}
                                {#key updateDynamic}
                                    {#await replaceDynamicValues(value)}
                                        <span style="{style ? text.style + (fontSize ? 'font-size: ' + fontSize + 'px;' : '') : 'font-size: ' + fontSize + 'px;'}{customStyle}">{@html getDynamicValue(value)}</span>
                                    {:then newValue}
                                        <span style="{style ? text.style + (fontSize ? 'font-size: ' + fontSize + 'px;' : '') : 'font-size: ' + fontSize + 'px;'}{customStyle}">{@html newValue}</span>
                                    {/await}
                                {/key}
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

        /* click event */
        pointer-events: initial;
    }

    .item.reveal {
        outline: 1px solid red;
        opacity: 0.6;
    }
    .item .break.reveal {
        outline: 1px solid red;
        outline-offset: -2px;
        opacity: 0.7;
    }

    .clickable {
        cursor: pointer;
        user-select: none;
        touch-action: manipulation; /* Optimizes touch interactions */
        -webkit-touch-callout: none; /* Prevents iOS callout menu */
        -webkit-user-select: none; /* Additional iOS user-select prevention */
    }
    .clickable:active {
        filter: brightness(0.8);
    }

    /* iOS Safari specific optimizations */
    @supports (-webkit-touch-callout: none) {
        .clickable {
            -webkit-tap-highlight-color: transparent; /* Removes tap highlight */
        }
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

        /* reset */
        color: var(--text);
        font-weight: initial;
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
        font-weight: bold;

        transform: translate(0, calc(-55% - 2px - var(--offsetY)));
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

    .item.chords,
    .item.chords .align {
        overflow: visible;
    }
    .lines {
        line-height: calc(var(--chord-size) * 1.2 + 4px) !important;
    }

    /* custom svg icon */

    .customIcon,
    .customIcon :global(svg) {
        width: 100%;
        height: 100%;
    }
</style>
