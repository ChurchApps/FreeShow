<script lang="ts">
    import { EXPORT } from "../../../types/Channels"
    import type { Show } from "../../../types/Show"
    import { currentWindow } from "../../stores"
    import { send } from "../../utils/request"
    import Textbox from "../slide/Textbox.svelte"
    import MediaItem from "../slide/views/MediaItem.svelte"
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
            if (options.oneFile) {
                send(EXPORT, ["DONE"], { name: options.name || shows[0]?.name || "Export" })
            } else {
                index++
                if (shows.length > index) exportPDF()
                else send(EXPORT, ["DONE"], { name: shows[index - 1]?.name || "" })
            }
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

    function getPagesForShow(show: Show, showOptions: any) {
        if (show && show.type === "section") return 1
        if (!show || !layoutSlides[show.id!]) return 0
        const slides = layoutSlides[show.id!]
        if (!slides.length) return 0
        const grid1 = showOptions.grid?.[1] || 6
        const grid0 = showOptions.grid?.[0] || 3
        const type = showOptions.type || "default"
        const divider = type === "default" ? 1 : type !== "text" ? grid0 : 1.5
        return Math.ceil(slides.length / grid1 / divider)
    }

    let index = 0
    function exportPDF() {
        const name = options.oneFile ? options.name || shows[0]?.name || "Export" : shows[index]?.name || ""
        const pagesCount = options.oneFile ? shows.reduce((sum, s) => sum + getPagesForShow(s, options), 0) : getPagesForShow(shows[index], options)
        // give time for any media to load as well
        setTimeout(() => send(EXPORT, ["EXPORT"], { type: "pdf", name, options: { type: options.type } }), 20 * (pagesCount + 1) + 1000)
    }

    $: renderedShows = options.oneFile ? shows : shows[index] ? [shows[index]] : []

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
    {#if shows.length}
        {#if options.type === "media"}
            {#each renderedShows as show}
                {#if show.type === "section"}
                    <Zoomed style="display: flex;justify-content: center;width: 100%;" let:ratio>
                        <div class="section-media-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: white; padding: 40px; box-sizing: border-box; background: {show.color || 'linear-gradient(135deg, #1e293b, #0f172a)'}; width: 1920px; height: 1080px; zoom: {1 / ratio}; position: relative; overflow: hidden;">
                            <div class="section-accent" style="width: 120px; height: 6px; background-color: rgba(255, 255, 255, 0.8); margin-bottom: 40px; border-radius: 3px;"></div>
                            <h1 style="font-size: 130px; font-weight: 800; text-transform: uppercase; letter-spacing: -3px; margin: 0 0 30px 0; text-shadow: 0 8px 24px rgba(0,0,0,0.4); color: white; font-family: sans-serif; line-height: 1.1;">{show.name}</h1>
                            {#if show.notes}
                                <div style="width: 300px; height: 2px; background-color: rgba(255,255,255,0.25); margin: 30px 0;"></div>
                                <p style="font-size: 50px; font-style: italic; color: rgba(255, 255, 255, 0.9); max-width: 80%; margin: 0; line-height: 1.5; text-shadow: 0 4px 12px rgba(0,0,0,0.3);">{show.notes}</p>
                            {/if}
                            {#if show.data?.time}
                                <div style="margin-top: 50px; font-size: 32px; background: rgba(255,255,255,0.15); color: #ffffff; padding: 12px 36px; border-radius: 40px; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; border: 2px solid rgba(255,255,255,0.25); text-shadow: 0 4px 8px rgba(0,0,0,0.2);">{show.data.time}</div>
                            {/if}
                        </div>
                    </Zoomed>
                {:else}
                    {#each layoutSlides[show.id || ""] as slide}
                        <Zoomed style="display: flex;justify-content: center;width: 100%;" let:ratio>
                            {#if show.media?.[slide.data?.background]?.path}
                                <div class="media" style="height: 100%;zoom: {1 / ratio};">
                                    <!-- {filter} {flipped} {fit} -->
                                    <MediaItem id="" item={{ style: "", type: "media", src: show.media[slide.data.background].path }} mirror />
                                </div>
                            {/if}

                            {#if slide.items}
                                {#each slide.items as item}
                                    <Textbox {item} ref={{ showId: show.id, id: slide.id }} chords={item.chords?.enabled} mirror />
                                {/each}
                            {/if}
                        </Zoomed>
                    {/each}
                {/if}
            {/each}
        {:else if options.type === "chordSheet"}
            <!-- Chord Sheet Export - Professional layout -->
            {#each renderedShows as show}
                <div class="page chord-sheet-page" style="padding: {options.margin || 20}px; --font-size: {options.fontSize || 12}px; --chord-font-size: {options.chordFontSize || 10}px; font-size: {options.fontSize || 12}px; line-height: {options.spacing || 1.5}; {show.type === 'section' || show.type === 'image' || show.type === 'video' || show.type === 'audio' ? 'justify-content: center; align-items: center; text-align: center; background: white;' : ''}">
                    {#if show.type === "section"}
                        <div class="section-chord-divider" style="max-width: 80%; width: 100%;">
                            {#if show.color}
                                <div style="width: 80px; height: 6px; background-color: {show.color}; margin: 0 auto 30px auto; border-radius: 3px;"></div>
                            {/if}
                            <h1 style="font-size: 3.5em; font-weight: 800; margin: 0 0 15px 0; color: #111; letter-spacing: -1px; text-transform: uppercase;">{show.name}</h1>
                            <div style="width: 150px; height: 1px; background-color: #ddd; margin: 25px auto;"></div>
                            {#if show.notes}
                                <p style="font-size: 1.2em; font-style: italic; color: #555; margin-bottom: 25px; line-height: 1.6;">{show.notes}</p>
                            {/if}
                            {#if show.data?.time}
                                <span style="display: inline-block; background-color: #f0f0f0; color: #333; padding: 6px 16px; border-radius: 20px; font-size: 0.9em; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; border: 1px solid #e0e0e0;">{show.data.time}</span>
                            {/if}
                        </div>
                    {:else if show.type === "image" || show.type === "video" || show.type === "audio"}
                        <div class="chord-sheet-media-divider" style="max-width: 80%; width: 100%; text-align: center; margin: auto 0; display: flex; flex-direction: column; align-items: center;">
                            <h1 style="font-size: 2.5em; font-weight: 700; color: #222; margin-bottom: 10px; text-transform: uppercase; letter-spacing: -0.5px;">[ {show.name} ]</h1>
                            <div style="font-size: 0.95em; color: #777; margin-bottom: 30px; text-transform: uppercase; font-weight: 600; letter-spacing: 1px;">Media Item ({show.type})</div>
                            {#if show.type === "image"}
                                <div style="max-width: 100%; height: 180mm; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; padding: 10px; border-radius: 8px; background: #fafafa; overflow: hidden; margin: 0 auto; box-sizing: border-box;">
                                    <img src={show.media[show.id].path} alt={show.name} style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                                </div>
                            {/if}
                        </div>
                    {:else}
                        <!-- Header -->
                        <div class="header">
                            {#if options.title && show.name}
                                <h1 class="title">{show.name}</h1>
                            {/if}

                            <div class="song-info">
                                {#if options.artist && show.meta?.artist}
                                    <span class="artist">by {show.meta.artist}</span>
                                {/if}
                                {#if options.key}
                                    <span class="key">Key: {getSongKey(show)}</span>
                                {/if}
                            </div>
                        </div>

                        <!-- Chord chart sections -->
                        <div class="chord-sections" style="columns: {options.columnsPerPage || 1}; column-gap: 25px; column-rule: 1px solid #eee;">
                            {#each groupSlidesBySection(layoutSlides[show.id] || []) as section, sectionIndex}
                                <div class="section" style="margin-bottom: {sectionIndex === groupSlidesBySection(layoutSlides[show.id] || []).length - 1 ? '8px' : '15px'};">
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
                        {#if options.showChords && getShowChords(show).length > 0}
                            <div class="chord-diagrams">
                                <h4>Chords Used:</h4>
                                <div class="chord-list">
                                    {#each getShowChords(show) as chord}
                                        <span class="chord-name">{chord}</span>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Notes section -->
                        {#if options.showNotes && (show.meta?.notes || getShowNotes(show))}
                            <div class="notes-section">
                                <h4>Notes:</h4>
                                <div class="notes-content">
                                    {show.meta?.notes || getShowNotes(show)}
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
            {/each}
        {:else}
            <!-- Normal PDF Export -->
            {#each renderedShows as show}
                {@const showPages = getPagesForShow(show, options)}
                <div class="show-container" class:flow={options.type === "slides" && show.type !== "section"} style="position: relative; {options.type !== 'text' || show.type === 'section' ? `height: calc(100vh * ${showPages});` : ''} page-break-after: always;">
                    {#if show.type === "section"}
                        <div class="section-page" style="background: {show.color ? show.color : 'linear-gradient(135deg, #1e293b, #0f172a)'};">
                            <!-- Premium decorative elements -->
                            <div class="section-accent" style="width: 80px; height: 4px; background-color: #ffffff; margin-bottom: 30px; border-radius: 2px; opacity: 0.8;"></div>
                            <h1 style="font-size: 54pt; font-weight: 800; text-transform: uppercase; letter-spacing: -2px; margin: 0 0 20px 0; color: #ffffff; text-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.1;">{show.name}</h1>
                            {#if show.notes}
                                <div style="width: 200px; height: 1px; background-color: rgba(255,255,255,0.25); margin: 25px 0;"></div>
                                <p style="font-size: 20pt; font-style: italic; color: rgba(255, 255, 255, 0.85); max-width: 80%; margin: 0; line-height: 1.5; text-shadow: 0 2px 6px rgba(0,0,0,0.2); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{show.notes}</p>
                            {/if}
                            {#if show.data?.time}
                                <div style="margin-top: 40px; font-size: 14pt; background: rgba(255,255,255,0.15); color: #ffffff; padding: 8px 24px; border-radius: 30px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; border: 1px solid rgba(255,255,255,0.25); text-shadow: 0 2px 4px rgba(0,0,0,0.15);">{show.data.time}</div>
                            {/if}
                        </div>
                    {:else}
                        {#if options.title}
                            <div style="position: absolute;width: 100%;">
                                <h1>{show.name}</h1>
                            </div>
                        {/if}
                        {#each layoutSlides[show.id || ""] as slide, i}
                            <div class="slide" class:padding={options.type !== "slides" ? i === 0 : i < options.grid[0]} style={options.type !== "text" ? `height: calc(100vh / ${options.grid[1]} - 0.1px);` + (options.type !== "slides" ? "" : `width: calc(100% / ${options.grid[0]});`) : ""}>
                            <!-- TODO: different slide heights! -->
                            <!-- style={settings.slides ? `height: calc(842pt / ${settings.grid[1]});` : "" + settings.text ? "" : `width: calc(100% / ${settings.grid[0]});`} -->
                            {#if options.groups}
                                <p class="group" style={options.type !== "text" ? "" : "padding: 0 60px;margin-top: -6px;"}>
                                    {slide.group ? getGroupName(show, slide.group, slide.id) : ""}
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
                                        {#if show.media?.[slide.data?.background]?.path}
                                            <div class="media" style="height: 100%;zoom: {1 / ratio};">
                                                <!-- {filter} {flipped} {fit} -->
                                                <!-- <Media path={show.media[slide.data.background].path || ""} mirror /> -->
                                                <MediaItem id="" item={{ style: "", type: "media", src: show.media[slide.data.background].path }} mirror />
                                            </div>
                                        {/if}

                                        {#if slide.items}
                                            {#each slide.items as item}
                                                <Textbox {item} ref={{ showId: show.id, id: slide.id }} chords={item.chords?.enabled} mirror />
                                            {/each}
                                        {/if}
                                    </Zoomed>
                                </div>
                            {/if}
                            {#if options.type !== "slides"}
                                <div class="text" class:margin={options.type === "text"}>
                                    <div style="position: relative;display: flex;flex-direction: column;align-items: center;justify-content: center;flex: 1;">
                                        {#if slide.items}
                                            {#each slide.items as item}
                                                {#if item.type === undefined || item.type === "text" || item.type === "timer"}
                                                    <Textbox {item} ref={{ showId: show.id, id: slide.id }} customFontSize={options.originalTextSize ? null : options.textSize} style={false} />
                                                {/if}
                                            {/each}
                                        {/if}

                                        {#if options.notes && slide.notes}
                                            <p class="notes">{slide.notes}</p>
                                        {/if}
                                    </div>
                                </div>
                            {/if}
                        </div>
                        {#if options.pageNumbers && i > 0 && i % options.grid[0] === 0 && i / options.grid[0] < showPages}
                            <div class="page" style="top: calc(100vh * {i / options.grid[0] - 0.012} - 30px)">
                                {i / options.grid[0]}/{showPages}
                            </div>
                        {/if}
                    {/each}
                    {#if options.pageNumbers && (layoutSlides[show.id || ""].length - 1) / (options.type !== "slides" ? 1 : options.grid[0]) / showPages < showPages}
                        <div class="page" style="top: calc(100vh * {showPages - 0.012} - 30px);">
                            {showPages}/{showPages}
                        </div>
                    {/if}
                    {/if}
                    {#if options.metadata}
                        <div style="position: absolute;top: calc(100vh * {showPages} - 25px);width: 100%;">
                            <p style="text-align: center;font-size: 12px;opacity: 0.8;">
                                <!-- metaDisplay is only used here temporarily -->
                                {show.metaDisplay}
                            </p>
                        </div>
                    {/if}
                </div>
            {/each}
        {/if}
    {/if}
</main>

<style>
    main {
        display: block;
        position: relative;
        background-color: white;
        color: black;
        width: 100%;
        height: auto;
        min-height: 100%;
        margin: 0;
        padding: 0;
    }

    main.flow {
        display: block;
    }

    .show-container {
        width: 100%;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        page-break-after: always;
        page-break-inside: avoid;
        margin: 0;
        padding: 0;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
    }

    .show-container.flow {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        align-content: flex-start;
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

    .section-page {
        width: 100%;
        height: 100%;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        box-sizing: border-box;
        padding: 60px;
        position: relative;
        overflow: hidden;
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
        flex-shrink: 0;
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

    .notes {
        width: 80%;
        font-size: 90px;
        text-align: center;
        font-style: italic;
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
