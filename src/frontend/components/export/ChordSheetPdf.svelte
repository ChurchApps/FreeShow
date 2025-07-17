<script lang="ts">
    import { EXPORT } from "../../../types/Channels"
    import type { Show } from "../../../types/Show"
    import { currentWindow } from "../../stores"
    import { send } from "../../utils/request"

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
            else send(EXPORT, ["DONE"], { path, name: shows[index - 1].name })
        }
    })

    let layoutSlides: any = {}

    $: if (shows.length) getRefs()

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
            show.meta = Object.values((show.meta || {}) as { [key: string]: string })
                .filter((a) => a.length)
                .join("; ")
        })

        if ($currentWindow === "pdf") exportPDF()
    }

    let index = 0
    function exportPDF() {
        setTimeout(
            () => {
                send(EXPORT, ["EXPORT"], { type: "pdf", path, name: shows[index].name })
            },
            20 * (pages + 1) + 400
        )
    }

    $: pages = shows.length ? Math.ceil(layoutSlides[shows[0].id!].length / (options.columnsPerPage || 1)) : 0

    // Extract all unique chords from the show
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

    // Get song key from metadata or first chord
    function getSongKey(show: Show): string {
        // Try to get from metadata first
        if (show.meta?.key) return show.meta.key
        
        // Get from first chord
        const chords = getShowChords(show)
        return chords.length > 0 ? chords[0] : "C"
    }

    // Group consecutive slides with same group name
    function groupSlidesBySection(slides: any[]): any[] {
        const sections: any[] = []
        let currentSection: any = null
        
        slides.forEach((slide) => {
            const groupName = slide.group || "Verse"
            
            if (!currentSection || currentSection.name !== groupName) {
                currentSection = {
                    name: groupName,
                    slides: []
                }
                sections.push(currentSection)
            }
            
            currentSection.slides.push(slide)
        })
        
        return sections
    }

    // Format lyrics with chord positions for chord sheet display
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

    // Create a line with chords positioned above the text
    function createChordLine(text: string, chords: any[]): string {
        // Create a generous character array for chord placement
        const chordArray = new Array(Math.max(text.length + 20, 80)).fill(" ")
        
        // Sort chords by position to handle overlaps properly
        const sortedChords = [...chords].sort((a, b) => (a.pos || 0) - (b.pos || 0))
        
        sortedChords.forEach((chord) => {
            const pos = Math.max(0, Math.min(chord.pos || 0, chordArray.length - (chord.key?.length || 0)))
            const chordStr = chord.key || ""
            
            // Place chord at position, ensuring it fits
            for (let i = 0; i < chordStr.length && pos + i < chordArray.length; i++) {
                chordArray[pos + i] = chordStr[i]
            }
        })
        
        return chordArray.join("").trimEnd()
    }
</script>

{#if shows.length}
    <main class="chord-sheet">
        {#each shows as show, showIndex}                <div class="page" style="margin: {options.margin || 20}px; --font-size: {options.fontSize || 12}px; --chord-font-size: {options.chordFontSize || 10}px; font-size: {options.fontSize || 12}px; line-height: {options.spacing || 1.5};">
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
                        {#if options.tempo && show.meta?.tempo}
                            <span class="tempo">Tempo: {show.meta.tempo}</span>
                        {/if}
                        {#if options.capo && show.meta?.capo}
                            <span class="capo">Capo: {show.meta.capo}</span>
                        {/if}
                    </div>
                </div>

                <!-- Chord chart sections -->
                <div class="chord-sections" style="columns: {options.columnsPerPage || 1};">
                    {#each groupSlidesBySection(layoutSlides[show.id] || []) as section}
                        <div class="section">
                            <h3 class="section-title">{section.name}</h3>
                            
                            {#each section.slides as slide}
                                <div class="verse">
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
                {#if getShowChords(show).length > 0}
                    <div class="chord-diagrams">
                        <h4>Chords Used:</h4>
                        <div class="chord-list">
                            {#each getShowChords(show) as chord}
                                <span class="chord-name">{chord}</span>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </main>
{/if}

<style>
    .chord-sheet {
        display: flex;
        flex-direction: column;
        position: relative;
        background-color: white;
        color: black;
        width: 100%;
        height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    }

    .page {
        width: 210mm;
        min-height: 297mm;
        background: white;
        display: flex;
        flex-direction: column;
        page-break-after: always;
    }

    .header {
        margin-bottom: 30px;
        border-bottom: 2px solid #333;
        padding-bottom: 15px;
    }

    .title {
        font-size: 24px;
        font-weight: bold;
        margin: 0 0 10px 0;
        text-align: center;
    }

    .song-info {
        display: flex;
        justify-content: space-around;
        flex-wrap: wrap;
        gap: 15px;
        font-size: 14px;
        color: #666;
    }

    .artist, .key, .tempo, .capo {
        font-weight: bold;
    }

    .chord-sections {
        flex: 1;
        column-gap: 30px;
        column-fill: auto;
    }

    .section {
        break-inside: avoid;
        margin-bottom: 25px;
    }

    .section-title {
        font-size: 16px;
        font-weight: bold;
        margin: 0 0 10px 0;
        color: #333;
        border-bottom: 1px solid #ccc;
        padding-bottom: 5px;
    }

    .verse {
        margin-bottom: 20px;
        break-inside: avoid;
    }

    .line {
        margin-bottom: 3px;
    }

    .line-content {
        margin: 0;
        font-size: inherit;
        line-height: 1.2;
        white-space: pre;
    }

    .chord-line .line-content {
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-weight: bold;
        color: #0066cc;
        font-size: var(--chord-font-size, 10px);
        margin-bottom: 1px;
    }

    /* Lyric lines use the normal font */
    .line:not(.chord-line) .line-content {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
    }

    .chord-diagrams {
        margin-top: auto;
        padding-top: 20px;
        border-top: 1px solid #ccc;
    }

    .chord-diagrams h4 {
        margin: 0 0 10px 0;
        font-size: 14px;
    }

    .chord-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .chord-name {
        background: #f0f0f0;
        padding: 4px 8px;
        border-radius: 3px;
        font-weight: bold;
        font-size: 12px;
    }

    /* Printing optimizations */
    @media print {
        .page {
            margin: 0;
            box-shadow: none;
        }
        
        .chord-sheet {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    }
</style>
