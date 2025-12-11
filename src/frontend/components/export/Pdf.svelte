<script lang="ts">
    import { EXPORT } from "../../../types/Channels"
    import type { Show } from "../../../types/Show"
    import { currentWindow } from "../../stores"
    import { send } from "../../utils/request"
    import Media from "../output/layers/Media.svelte"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"

    export let shows: Show[] = []
    export let options: any = {}
    export let path = ""

    window.api.receive(EXPORT, (a: any) => {
        if (a.channel === "PDF") {
            shows = a.data.shows
            options = a.data.options
            path = a.data.path
        } else if (a.channel === "NEXT") {
            index++
            if (shows.length > index) exportPDF()
            else send(EXPORT, ["DONE"], { name: shows[index - 1]?.name || "" })
        }
    })

    let layoutSlides: any = {}

    $: if (shows.length) getRefs()

    // WIP get ref...
    function getRefs() {
        shows.forEach((show: any) => {
            let a: any[] = []

            show.layouts?.[show.settings?.activeLayout]?.slides?.forEach((layoutSlide: any) => {
                let slide = show.slides[layoutSlide.id]
                if (!slide) return

                slide.data = layoutSlide
                a.push(slide)
                if (!slide.children) return

                slide.children.forEach((childId: string) => {
                    let slide = show.slides[childId]
                    slide.data = layoutSlide
                    a.push(slide)
                })
            })

            layoutSlides[show.id!] = a

            // Create a display string for metadata while preserving the original object
            const metaDisplay = Object.values((show.meta || {}) as { [key: string]: string })
                .filter((a) => a.length)
                .join("; ")

            // Preserve original meta object and add display string
            show.metaDisplay = metaDisplay
        })

        if ($currentWindow === "pdf") exportPDF()
    }

    let index = 0
    function exportPDF() {
        setTimeout(() => send(EXPORT, ["EXPORT"], { type: "pdf", name: shows[index]?.name || "" }), 20 * (pages + 1) + 400)
    }

    $: pages = shows.length ? Math.ceil(layoutSlides[shows[0].id!].length / options.grid[1] / (options.type === "default" ? 1 : options.type !== "text" ? options.grid[0] : 1.5)) : 0

    // dynamic counter
    function getGroupName(show: Show, group: string, slideID: string) {
        let name = group
        if (name) {
            let added: any = {}
            Object.entries(show.slides).forEach(([id, a]: any) => {
                if (added[a.group]) {
                    added[a.group]++
                    if (id === slideID) name += " #" + added[a.group]
                } else added[a.group] = 1
            })
        }
        return name
    }

    // Chord sheet helper functions
    function formatLyricsWithChords(slide: any): { text: string; isChord: boolean }[] {
        const lines: { text: string; isChord: boolean }[] = []

        slide.items?.forEach((item: any) => {
            item.lines?.forEach((line: any) => {
                if (!line.text || line.text.length === 0) return

                // Get text content
                let textContent = ""
                line.text.forEach((text: any) => {
                    textContent += text.value || ""
                })

                if (!textContent.trim()) return

                // If there are chords, create chord line above lyrics
                if (line.chords && line.chords.length > 0) {
                    const chordLine = createChordLine(textContent, line.chords)
                    if (chordLine.trim()) {
                        lines.push({ text: chordLine, isChord: true })
                    }
                }

                lines.push({ text: textContent, isChord: false })
            })
        })

        return lines
    }

    function getShowChords(show: Show): string[] {
        const chords = new Set<string>()

        Object.values(show.slides || {}).forEach((slide) => {
            slide.items?.forEach((item) => {
                item.lines?.forEach((line) => {
                    line.chords?.forEach((chord) => {
                        chords.add(chord.key)
                    })
                })
            })
        })

        return Array.from(chords).sort()
    }

    function getSongKey(show: Show): string {
        // First priority: explicit key in metadata
        if (show.meta?.key && show.meta.key.trim()) {
            return show.meta.key.trim()
        }

        // Second priority: derive from most common chord
        const chords = getShowChords(show)
        if (chords.length > 0) {
            // Find the most common chord (assuming it's likely the key)
            const chordCounts: { [key: string]: number } = {}

            Object.values(show.slides || {}).forEach((slide) => {
                slide.items?.forEach((item) => {
                    item.lines?.forEach((line) => {
                        line.chords?.forEach((chord) => {
                            const key = chord.key || chord.chord || ""
                            if (key) {
                                chordCounts[key] = (chordCounts[key] || 0) + 1
                            }
                        })
                    })
                })
            })

            // Return the most frequent chord
            const mostCommon = Object.entries(chordCounts).sort(([, a], [, b]) => b - a)[0]

            if (mostCommon) {
                return mostCommon[0]
            }

            // Fallback to first chord
            return chords[0]
        }

        // Final fallback
        return "C"
    }

    function getShowNotes(show: Show): string {
        // Get notes from the active layout
        const activeLayoutId = show.settings?.activeLayout
        if (activeLayoutId && show.layouts?.[activeLayoutId]?.notes) {
            return show.layouts[activeLayoutId].notes.trim()
        }

        // Fallback to first layout with notes
        if (show.layouts) {
            for (const layout of Object.values(show.layouts)) {
                if (layout.notes && layout.notes.trim()) {
                    return layout.notes.trim()
                }
            }
        }

        return ""
    }

    function createChordLine(text: string, chords: any[]): string {
        // Create a generous character array for chord placement
        const chordArray = new Array(Math.max(text.length + 20, 80)).fill(" ")

        // Sort chords by position to handle overlaps properly
        const sortedChords = [...chords].sort((a, b) => (a.pos || 0) - (b.pos || 0))

        sortedChords.forEach((chord) => {
            const pos = Math.max(0, Math.min(chord.pos || 0, chordArray.length - (chord.chord || chord.key || "").length))
            const chordStr = chord.chord || chord.key || ""

            // Place chord at position, ensuring it fits
            for (let i = 0; i < chordStr.length && pos + i < chordArray.length; i++) {
                chordArray[pos + i] = chordStr[i]
            }
        })

        return chordArray.join("").trimEnd()
    }

    function groupSlidesBySection(slides: any[]): any[] {
        const sections: any[] = []

        // Create a map to track slide numbers for each group
        const groupCounts: { [key: string]: number } = {}

        slides.forEach((slide) => {
            const groupName = slide.group || "Verse"

            // Increment the count for this group
            groupCounts[groupName] = (groupCounts[groupName] || 0) + 1

            // Create individual section for each slide with numbered title
            const numberedName = `${groupName} ${groupCounts[groupName]}`

            const section = {
                name: numberedName,
                slides: [slide]
            }

            sections.push(section)
        })

        return sections
    }
</script>

<main class:flow={options.type === "slides"} class:chord-sheet={options.type === "chordSheet"}>
    {#if shows.length && shows[index]}
        {#if options.type === "chordSheet"}
            <!-- Chord Sheet Export - Professional layout -->
            <div class="page chord-sheet-page" style="padding: {options.margin || 20}px; --font-size: {options.fontSize || 12}px; --chord-font-size: {options.chordFontSize || 10}px; font-size: {options.fontSize || 12}px; line-height: {options.spacing || 1.5};">
                <!-- Header -->
                <div class="header">
                    {#if options.title && shows[index].name}
                        <h1 class="title">{shows[index].name}</h1>
                    {/if}

                    <div class="song-info">
                        {#if options.artist && shows[index].meta?.artist}
                            <span class="artist">by {shows[index].meta.artist}</span>
                        {/if}
                        {#if options.key}
                            <span class="key">Key: {getSongKey(shows[index])}</span>
                        {/if}
                    </div>
                </div>

                <!-- Chord chart sections -->
                <div class="chord-sections" style="columns: {options.columnsPerPage || 1}; column-gap: 25px; column-rule: 1px solid #eee;">
                    {#each groupSlidesBySection(layoutSlides[shows[index].id] || []) as section, sectionIndex}
                        <div class="section" style="margin-bottom: {sectionIndex === groupSlidesBySection(layoutSlides[shows[index].id] || []).length - 1 ? '8px' : '15px'};">
                            <h3 class="section-title">{section.name}</h3>

                            {#each section.slides as slide, slideIndex}
                                <div class="verse" style="margin-bottom: {slideIndex === section.slides.length - 1 ? '8px' : '12px'};">
                                    {#each formatLyricsWithChords(slide) as line}
                                        {#if line.text.trim()}
                                            <div class="line" class:chord-line={line.isChord}>
                                                <pre class="line-content">{line.text}</pre>
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            {/each}
                        </div>
                    {/each}
                </div>

                <!-- Chord diagram area (if space permits) -->
                {#if options.showChords && getShowChords(shows[index]).length > 0}
                    <div class="chord-diagrams">
                        <h4>Chords Used:</h4>
                        <div class="chord-list">
                            {#each getShowChords(shows[index]) as chord}
                                <span class="chord-name">{chord}</span>
                            {/each}
                        </div>
                    </div>
                {/if}

                <!-- Notes section -->
                {#if options.showNotes && (shows[index].meta?.notes || getShowNotes(shows[index]))}
                    <div class="notes-section">
                        <h4>Notes:</h4>
                        <div class="notes-content">
                            {shows[index].meta?.notes || getShowNotes(shows[index])}
                        </div>
                    </div>
                {/if}
            </div>
        {:else}
            <!-- Normal PDF Export -->
            {#if options.title}
                <div style="position: absolute;width: 100%;">
                    <h1>{shows[index].name}</h1>
                </div>
            {/if}
            {#each layoutSlides[shows[index].id || ""] as slide, i}
                <div class="slide" class:padding={options.type !== "slides" ? i === 0 : i < options.grid[0]} style={options.type !== "text" ? `height: calc(842pt / ${options.grid[1]} - 0.1px);` + (options.type !== "slides" ? "" : `width: calc(100% / ${options.grid[0]});`) : ""}>
                    <!-- TODO: different slide heights! -->
                    <!-- style={settings.slides ? `height: calc(842pt / ${settings.grid[1]});` : "" + settings.text ? "" : `width: calc(100% / ${settings.grid[0]});`} -->
                    {#if options.groups}
                        <p class="group" style={options.type !== "text" ? "" : "padding: 0 60px;margin-top: -6px;"}>
                            {slide.group ? getGroupName(shows[index], slide.group, slide.id) : ""}
                        </p>
                    {/if}
                    {#if options.numbers}
                        <p class="number" style={options.type !== "text" ? "" : "padding: 0 60px;margin-top: -6px;"}>
                            {i + 1}
                        </p>
                    {/if}
                    {#if options.type !== "text"}
                        <div class="slides" class:invert={options.invert}>
                            <Zoomed style="display: flex;justify-content: center;width: 100%;" let:ratio>
                                {#if shows[index].media?.[slide.data?.background]?.path}
                                    <div class="media" style="height: 100%;zoom: {1 / ratio};">
                                        <!-- {filter} {flipped} {fit} -->
                                        <Media path={shows[index].media[slide.data.background].path || ""} mirror />
                                    </div>
                                {/if}

                                {#if slide.items}
                                    {#each slide.items as item}
                                        <Textbox {item} ref={{ showId: shows[index].id, id: slide.id }} chords={item.chords?.enabled} />
                                    {/each}
                                {/if}
                            </Zoomed>
                        </div>
                    {/if}
                    {#if options.type !== "slides"}
                        <div class="text" class:margin={options.type === "text"}>
                            {#if slide.items}
                                {#each slide.items as item}
                                    {#if item.type === undefined || item.type === "text" || item.type === "timer"}
                                        <Textbox {item} ref={{ showId: shows[index].id, id: slide.id }} customFontSize={options.originalTextSize ? null : options.textSize} style={false} />
                                    {/if}
                                {/each}
                            {/if}
                        </div>
                    {/if}
                </div>
                {#if options.pageNumbers && i > 0 && i % options.grid[0] === 0 && i / options.grid[0] < pages}
                    <div class="page" style="top: calc(842pt * {i / options.grid[0] - 0.012} - 30px)">
                        {i / options.grid[0]}/{pages}
                    </div>
                {/if}
            {/each}
            {#if options.pageNumbers && (layoutSlides[shows[index].id || ""].length - 1) / (options.type !== "slides" ? 1 : options.grid[0]) / pages < pages}
                <div class="page" style="top: calc(842pt * {pages - 0.012} - 30px);">
                    {pages}/{pages}
                </div>
            {/if}
            {#if options.metadata}
                <div style="position: absolute;top: calc(842pt * {pages} - 25px);width: 100%;">
                    <p style="text-align: center;font-size: 12px;opacity: 0.8;">
                        {shows[index].metaDisplay}
                    </p>
                </div>
            {/if}
        {/if}
    {/if}
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        position: relative;
        background-color: white;
        color: black;
        /* scroll-snap-type: y mandatory; */
        /* page-break-inside: avoid;
    max-height: inherit; */
    }

    main.flow {
        flex-direction: row;
        flex-wrap: wrap;
    }

    h1 {
        zoom: 0.5;
        margin: 20px;
        text-align: center;
        color: black;
    }

    .slide {
        display: flex;
        position: relative;
        /* page-break-before: always; */
    }
    .slide.padding {
        padding-top: 30px;
    }

    .slide .group {
        position: absolute;
        font-weight: bold;
        padding: 0 10px;
    }
    .slide .number {
        position: absolute;
        inset-inline-end: 0px;
        padding: 0 10px;
    }

    .slides {
        display: flex;
        align-self: center;
        justify-content: center;
        flex: 1;
        margin: 10px;
    }
    .flow .slides {
        margin: 40px 10px;
    }
    .slides.invert {
        filter: invert(1);
    }

    .text {
        display: flex;
        flex: 2;
        margin: 10px;
        zoom: 0.2;
    }
    .text :global(.align) {
        text-align: start;
    }

    .text.margin {
        margin: 50px 200px;
        zoom: 0.3;
    }

    /* @page {
    size: 595pt 842pt;
  } */

    .page {
        position: absolute;
        inset-inline-end: 10px;
        /* transform: translateY(-30px); */
    }

    /* Professional chord sheet layout styles */
    .chord-sheet-page {
        width: 100%;
        max-width: 210mm;
        min-height: 297mm;
        background: white;
        display: flex;
        flex-direction: column;
        page-break-after: always;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        box-sizing: border-box;
        padding: 0;
        margin: 0;
    }

    .header {
        margin-bottom: 20px;
        border-bottom: 2px solid #333;
        padding-bottom: 15px;
    }

    .title {
        font-size: 3em;
        font-weight: bold;
        margin: 0 0 10px 0;
        text-align: center;
        color: black;
    }

    .song-info {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        gap: 15px;
        font-size: 14px;
        color: #666;
    }

    .artist,
    .key {
        font-weight: bold;
    }

    .chord-sections {
        flex: 1;
        column-fill: balance;
        overflow: hidden;
        orphans: 2;
        widows: 2;
    }

    .section {
        break-inside: avoid;
        margin-bottom: 15px;
        page-break-inside: avoid;
        orphans: 2;
        widows: 2;
    }

    .section-title {
        font-size: 14px;
        font-weight: bold;
        margin: 0 0 6px 0;
        color: #333;
        border-bottom: 1px solid #ccc;
        padding-bottom: 3px;
    }

    .verse {
        margin-bottom: 12px;
        break-inside: avoid;
        page-break-inside: avoid;
        orphans: 2;
        widows: 2;
    }

    .verse:last-child {
        margin-bottom: 8px;
    }

    .line {
        margin-bottom: 2px;
    }

    .line-content {
        margin: 0;
        font-size: inherit;
        line-height: 1.3;
        white-space: pre;
        overflow: hidden;
    }

    .chord-line .line-content {
        font-family: "Consolas", "Monaco", "Courier New", monospace;
        font-weight: bold;
        color: #0066cc;
        font-size: var(--chord-font-size, 10px);
        margin-bottom: 1px;
        line-height: 1.1;
    }

    /* Lyric lines use the normal font */
    .line:not(.chord-line) .line-content {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
        line-height: 1.4;
    }

    .chord-diagrams {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #ccc;
        break-inside: avoid;
        page-break-inside: avoid;
    }

    .chord-diagrams h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: black;
        font-weight: bold;
    }

    .chord-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .chord-name {
        background: #f0f0f0;
        padding: 3px 6px;
        border-radius: 3px;
        font-weight: bold;
        font-size: 10px;
        border: 1px solid #ddd;
    }

    .notes-section {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #ccc;
        break-inside: avoid;
        page-break-inside: avoid;
    }

    .notes-section h4 {
        margin: 0 0 8px 0;
        font-size: 12px;
        color: black;
        font-weight: bold;
    }

    .notes-content {
        font-size: 11px;
        line-height: 1.4;
        color: #444;
        white-space: pre-wrap;
        word-wrap: break-word;
    }
</style>
